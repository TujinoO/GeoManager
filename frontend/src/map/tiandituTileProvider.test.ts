import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RequestStartScheduler,
  TiandituTileProvider,
  parseRetryAfterMs,
} from "./tiandituTileProvider.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("TiandituTileProvider", () => {
  it("paces request starts across vector and label provider instances", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const starts: number[] = [];
    const scheduler = new RequestStartScheduler({
      maxConcurrentRequests: 4,
    });
    const fetchImpl = vi.fn(async () => {
      starts.push(Date.now());
      return tileResponse(200);
    });
    const vector = provider({ scheduler, fetchImpl });
    const labels = provider({ scheduler, fetchImpl });

    const requests = [
      vector.loadTile(tile(1), loadOptions("vec", new AbortController())),
      labels.loadTile(tile(2), loadOptions("cva", new AbortController())),
      vector.loadTile(tile(3), loadOptions("vec", new AbortController())),
    ];

    await vi.advanceTimersByTimeAsync(299);
    expect(starts).toEqual([10_000, 10_150]);
    await vi.advanceTimersByTimeAsync(1);
    await Promise.all(requests);
    expect(starts).toEqual([10_000, 10_150, 10_300]);
    scheduler.dispose();
  });

  it("pauses the shared vector and label queue after any 429", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(30_000);
    const starts: Array<{ layer: string; at: number }> = [];
    let vectorAttempts = 0;
    const scheduler = new RequestStartScheduler({
      minStartIntervalMs: 150,
      maxConcurrentRequests: 4,
    });
    const fetchImpl = vi.fn(async (url: string) => {
      const layer = url.includes("/cva") ? "cva" : "vec";
      starts.push({ layer, at: Date.now() });
      if (layer === "vec" && vectorAttempts++ === 0) {
        return tileResponse(429, { "retry-after": "1" });
      }
      return tileResponse(200);
    });
    const vector = provider({ scheduler, fetchImpl });
    const labels = provider({ scheduler, fetchImpl });

    const loads = [
      vector.loadTile(tile(1), loadOptions("vec", new AbortController())),
      labels.loadTile(tile(2), loadOptions("cva", new AbortController())),
    ];

    await vi.advanceTimersByTimeAsync(999);
    expect(starts).toEqual([{ layer: "vec", at: 30_000 }]);
    await vi.advanceTimersByTimeAsync(1);
    expect(starts).toEqual([
      { layer: "vec", at: 30_000 },
      { layer: "cva", at: 31_000 },
    ]);
    await vi.advanceTimersByTimeAsync(150);
    await Promise.all(loads);
    expect(starts).toEqual([
      { layer: "vec", at: 30_000 },
      { layer: "cva", at: 31_000 },
      { layer: "vec", at: 31_150 },
    ]);
    scheduler.dispose();
  });

  it("honors Retry-After before retrying a 429 response", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(20_000);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tileResponse(429, { "retry-after": "2" }))
      .mockResolvedValueOnce(tileResponse(200));
    const load = provider({
      scheduler: new RequestStartScheduler({ minStartIntervalMs: 0 }),
      fetchImpl,
    }).loadTile(tile(1), loadOptions("vec", new AbortController()));

    await vi.advanceTimersByTimeAsync(1_999);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(load).resolves.toMatchObject({
      data: expect.any(ArrayBuffer),
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("uses bounded exponential delay when Retry-After is absent", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tileResponse(429))
      .mockResolvedValueOnce(tileResponse(200));
    const load = provider({
      scheduler: new RequestStartScheduler({ minStartIntervalMs: 0 }),
      fetchImpl,
      baseRetryDelayMs: 250,
      maxRetryDelayMs: 1_000,
    }).loadTile(tile(1), loadOptions("vec", new AbortController()));

    await vi.advanceTimersByTimeAsync(249);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await load;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("stops after the retry limit and raises a structured redacted 429 error", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => tileResponse(429));
    const load = provider({
      scheduler: new RequestStartScheduler({ minStartIntervalMs: 0 }),
      fetchImpl,
      maxRetries: 2,
      baseRetryDelayMs: 10,
      maxRetryDelayMs: 20,
    }).loadTile(
      tile(1),
      loadOptions("vec?tk=must-not-appear", new AbortController()),
    );
    const rejection = expect(load).rejects.toMatchObject({
      name: "TiandituTileHttpError",
      status: 429,
      statusCode: 429,
      attempts: 3,
    });

    await vi.runAllTimersAsync();
    await rejection;
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    await expect(load).rejects.not.toThrow(/must-not-appear/);
  });

  it("removes an aborted request while it is queued", async () => {
    vi.useFakeTimers();
    const scheduler = new RequestStartScheduler({
      minStartIntervalMs: 1_000,
      maxConcurrentRequests: 2,
    });
    const first = scheduler.schedule(
      async () => "first",
      new AbortController().signal,
    );
    const queuedController = new AbortController();
    const queued = scheduler.schedule(
      async () => "queued",
      queuedController.signal,
    );

    queuedController.abort();
    await expect(queued).rejects.toMatchObject({ name: "AbortError" });
    await expect(first).resolves.toBe("first");
    await vi.runAllTimersAsync();
    scheduler.dispose();
  });

  it("passes cancellation through to an in-flight fetch", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    const load = provider({
      scheduler: new RequestStartScheduler({ minStartIntervalMs: 0 }),
      fetchImpl,
    }).loadTile(tile(1), loadOptions("vec", controller));

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    controller.abort();
    await expect(load).rejects.toMatchObject({ name: "AbortError" });
  });

  it("parses both Retry-After seconds and HTTP dates", () => {
    expect(parseRetryAfterMs("1.5", 0)).toBe(1_500);
    expect(parseRetryAfterMs("Thu, 01 Jan 1970 00:00:03 GMT", 1_000)).toBe(
      2_000,
    );
    expect(parseRetryAfterMs("invalid", 0)).toBeNull();
  });
});

function provider(dependencies: Record<string, unknown>) {
  return new TiandituTileProvider({}, dependencies);
}

function tile(x: number) {
  return { z: 3, x, y: 2 };
}

function loadOptions(layer: string, controller: AbortController) {
  return {
    request: { url: `https://tiles.example.test/${layer}` },
    signal: controller.signal,
  };
}

function tileResponse(status: number, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 429 ? "Too Many Requests" : "OK",
    headers: new Headers(headers),
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  } as Response;
}
