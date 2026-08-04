const defaultMinStartIntervalMs = 100;
const defaultMaxConcurrentRequests = 6;
const defaultMinConcurrentRequests = 2;
const defaultMaxAdaptiveStartIntervalMs = 600;
const defaultRecoverySuccessThreshold = 16;
const defaultMaxRetries = 2;
const defaultBaseRetryDelayMs = 1_000;
const defaultMaxRetryDelayMs = 10_000;
// Tianditu browser keys validate the request source. Send only the platform
// origin across sites, never the current path or query string.
const tiandituReferrerPolicy = "strict-origin-when-cross-origin";

export class TiandituTileHttpError extends Error {
  constructor(response, attempts, retryAfterMs = null) {
    const statusText = response.statusText?.trim();
    super(
      `Tianditu tile request failed (HTTP ${response.status}${statusText ? ` ${statusText}` : ""})`,
    );
    this.name = "TiandituTileHttpError";
    this.status = response.status;
    this.statusCode = response.status;
    this.attempts = attempts;
    this.retryAfterMs = retryAfterMs;
  }
}

export class RequestStartScheduler {
  constructor({
    minStartIntervalMs = defaultMinStartIntervalMs,
    maxConcurrentRequests = defaultMaxConcurrentRequests,
    minConcurrentRequests = defaultMinConcurrentRequests,
    maxAdaptiveStartIntervalMs = defaultMaxAdaptiveStartIntervalMs,
    recoverySuccessThreshold = defaultRecoverySuccessThreshold,
    now = () => Date.now(),
    setTimer = (callback, delayMs) => setTimeout(callback, delayMs),
    clearTimer = (timerId) => clearTimeout(timerId),
  } = {}) {
    this.baseMinStartIntervalMs = Math.max(0, minStartIntervalMs);
    this.minStartIntervalMs = this.baseMinStartIntervalMs;
    this.baseMaxConcurrentRequests = Math.max(1, maxConcurrentRequests);
    this.maxConcurrentRequests = this.baseMaxConcurrentRequests;
    this.minConcurrentRequests = Math.min(
      this.baseMaxConcurrentRequests,
      Math.max(1, minConcurrentRequests),
    );
    this.maxAdaptiveStartIntervalMs = Math.max(
      this.baseMinStartIntervalMs,
      maxAdaptiveStartIntervalMs,
    );
    this.recoverySuccessThreshold = Math.max(
      1,
      Math.floor(recoverySuccessThreshold),
    );
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.queue = [];
    this.activeRequests = 0;
    this.nextStartAt = 0;
    this.timerId = null;
    this.successfulRequestsSinceRateLimit = 0;
    this.rateLimitPenaltyUntil = 0;
  }

  schedule(run, signal) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(createAbortError());
        return;
      }

      const job = {
        run,
        signal,
        resolve,
        reject,
        state: "queued",
        onAbort: null,
      };
      job.onAbort = () => {
        if (job.state !== "queued") return;
        job.state = "cancelled";
        const index = this.queue.indexOf(job);
        if (index >= 0) this.queue.splice(index, 1);
        reject(createAbortError());
        this.drain();
      };
      signal.addEventListener("abort", job.onAbort, { once: true });
      this.queue.push(job);
      this.drain();
    });
  }

  deferFor(delayMs) {
    const deferredStartAt = this.now() + Math.max(0, delayMs);
    if (deferredStartAt <= this.nextStartAt) return;
    this.nextStartAt = deferredStartAt;
    if (this.timerId !== null) {
      this.clearTimer(this.timerId);
      this.timerId = null;
    }
    this.drain();
  }

  recordRateLimit(delayMs) {
    const now = this.now();
    const normalizedDelayMs = Math.max(0, delayMs);
    const isExistingBurst = now < this.rateLimitPenaltyUntil;
    this.rateLimitPenaltyUntil = Math.max(
      this.rateLimitPenaltyUntil,
      now + normalizedDelayMs,
    );
    this.successfulRequestsSinceRateLimit = 0;

    if (!isExistingBurst) {
      const doubledIntervalMs =
        this.minStartIntervalMs > 0 ? this.minStartIntervalMs * 2 : 1;
      this.minStartIntervalMs = Math.min(
        this.maxAdaptiveStartIntervalMs,
        Math.max(this.baseMinStartIntervalMs, doubledIntervalMs),
      );
      this.maxConcurrentRequests = Math.max(
        this.minConcurrentRequests,
        Math.ceil(this.maxConcurrentRequests / 2),
      );
    }

    this.deferFor(normalizedDelayMs);
  }

  recordSuccess() {
    if (this.now() < this.rateLimitPenaltyUntil) return;
    if (
      this.minStartIntervalMs === this.baseMinStartIntervalMs &&
      this.maxConcurrentRequests === this.baseMaxConcurrentRequests
    ) {
      this.successfulRequestsSinceRateLimit = 0;
      this.rateLimitPenaltyUntil = 0;
      return;
    }

    this.successfulRequestsSinceRateLimit += 1;
    if (this.successfulRequestsSinceRateLimit < this.recoverySuccessThreshold) {
      return;
    }

    this.successfulRequestsSinceRateLimit = 0;
    this.minStartIntervalMs = Math.max(
      this.baseMinStartIntervalMs,
      Math.ceil(this.minStartIntervalMs / 2),
    );
    this.maxConcurrentRequests = Math.min(
      this.baseMaxConcurrentRequests,
      this.maxConcurrentRequests + 1,
    );
    if (
      this.minStartIntervalMs === this.baseMinStartIntervalMs &&
      this.maxConcurrentRequests === this.baseMaxConcurrentRequests
    ) {
      this.rateLimitPenaltyUntil = 0;
    }
    this.drain();
  }

  drain() {
    if (this.timerId !== null) return;
    if (this.activeRequests >= this.maxConcurrentRequests) return;

    while (this.queue.length > 0 && this.queue[0].state !== "queued") {
      this.queue.shift();
    }
    const job = this.queue[0];
    if (!job) return;

    const waitMs = Math.max(0, this.nextStartAt - this.now());
    if (waitMs > 0) {
      this.timerId = this.setTimer(() => {
        this.timerId = null;
        this.drain();
      }, waitMs);
      return;
    }

    this.queue.shift();
    job.state = "active";
    if (job.onAbort) {
      job.signal.removeEventListener("abort", job.onAbort);
    }
    this.activeRequests += 1;
    this.nextStartAt = this.now() + this.minStartIntervalMs;

    Promise.resolve()
      .then(() => {
        if (job.signal.aborted) throw createAbortError();
        return job.run();
      })
      .then(job.resolve, job.reject)
      .finally(() => {
        job.state = "settled";
        this.activeRequests -= 1;
        this.drain();
      });

    this.drain();
  }

  dispose() {
    if (this.timerId !== null) {
      this.clearTimer(this.timerId);
      this.timerId = null;
    }
    for (const job of this.queue.splice(0)) {
      job.state = "cancelled";
      if (job.onAbort) {
        job.signal.removeEventListener("abort", job.onAbort);
      }
      job.reject(createAbortError());
    }
  }
}

export function parseRetryAfterMs(value, now = Date.now()) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1_000);
  }
  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) return null;
  return Math.max(0, retryAt - now);
}

export function abortableDelay(delayMs, signal) {
  if (signal.aborted) return Promise.reject(createAbortError());
  return new Promise((resolve, reject) => {
    const timerId = setTimeout(
      () => {
        signal.removeEventListener("abort", handleAbort);
        resolve();
      },
      Math.max(0, delayMs),
    );
    const handleAbort = () => {
      clearTimeout(timerId);
      reject(createAbortError());
    };
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

const sharedScheduler = new RequestStartScheduler();

export class TiandituTileProvider {
  constructor(_sourceOptions = {}, dependencies = {}) {
    this.scheduler = dependencies.scheduler ?? sharedScheduler;
    this.fetchImpl =
      dependencies.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.maxRetries = dependencies.maxRetries ?? defaultMaxRetries;
    this.baseRetryDelayMs =
      dependencies.baseRetryDelayMs ?? defaultBaseRetryDelayMs;
    this.maxRetryDelayMs =
      dependencies.maxRetryDelayMs ?? defaultMaxRetryDelayMs;
    this.now = dependencies.now ?? (() => Date.now());
    this.delay = dependencies.delay ?? abortableDelay;
  }

  async loadTile(_tile, { request, signal }) {
    let retryAfterMs = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const { response, data } = await this.scheduler.schedule(async () => {
        const response = await this.fetchImpl(
          request.url,
          requestInit(request, signal),
        );
        return {
          response,
          data: response.ok ? await response.arrayBuffer() : null,
        };
      }, signal);

      if (response.ok) {
        this.scheduler.recordSuccess();
        return {
          data,
          expires: response.headers.get("expires") ?? undefined,
          cacheControl: response.headers.get("cache-control") ?? undefined,
        };
      }

      retryAfterMs = parseRetryAfterMs(
        response.headers.get("retry-after"),
        this.now(),
      );
      if (response.status !== 429) {
        throw new TiandituTileHttpError(response, attempt + 1, retryAfterMs);
      }

      const exponentialDelay = Math.min(
        this.baseRetryDelayMs * 2 ** attempt,
        this.maxRetryDelayMs,
      );
      const retryDelayMs = Math.min(
        retryAfterMs ?? exponentialDelay,
        this.maxRetryDelayMs,
      );
      this.scheduler.recordRateLimit(retryDelayMs);
      if (attempt >= this.maxRetries) {
        throw new TiandituTileHttpError(response, attempt + 1, retryAfterMs);
      }
      await this.delay(retryDelayMs, signal);
    }

    throw new Error("Unreachable Tianditu tile retry state");
  }
}

function requestInit(request, signal) {
  return {
    signal,
    headers: request.headers,
    method: request.method,
    body: request.body,
    credentials: request.credentials,
    referrerPolicy: tiandituReferrerPolicy,
  };
}

function createAbortError() {
  if (typeof DOMException === "function") {
    return new DOMException("The operation was aborted", "AbortError");
  }
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

export default TiandituTileProvider;
