import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BasemapSourceLoadCycle,
  BasemapTileRequestTimings,
  probePlatformHealth,
} from "./useBasemapStatus";

afterEach(() => {
  vi.useRealTimers();
});

describe("BasemapTileRequestTimings", () => {
  it("removes a completed or failed tile timing when it is consumed", () => {
    const timings = new BasemapTileRequestTimings();
    timings.start("tile-a", 120);

    expect(timings.finish("tile-a")).toBe(120);
    expect(timings.finish("tile-a")).toBeUndefined();
  });

  it("evicts the oldest unfinished tile at the capacity limit", () => {
    const timings = new BasemapTileRequestTimings(2);
    timings.start("tile-a", 100);
    timings.start("tile-b", 200);
    timings.start("tile-c", 300);

    expect(timings.finish("tile-a")).toBeUndefined();
    expect(timings.finish("tile-b")).toBe(200);
    expect(timings.finish("tile-c")).toBe(300);
  });
});

describe("BasemapSourceLoadCycle", () => {
  it("waits for every active source before reporting ready", () => {
    const cycle = new BasemapSourceLoadCycle(["tianditu-vec", "tianditu-cva"]);

    cycle.loading("tianditu-vec");
    cycle.loading("tianditu-cva");
    expect(cycle.loaded("tianditu-vec")).toBe(false);
    expect(cycle.loaded("tianditu-cva")).toBe(true);
  });

  it("does not let idle recover a failed load cycle", () => {
    const sources = ["tianditu-vec", "tianditu-cva"];
    const cycle = new BasemapSourceLoadCycle(sources);

    cycle.fail(sources);

    expect(cycle.hasFailure()).toBe(true);
    expect(cycle.completeFromMapLifecycle(sources)).toBe(false);
    expect(cycle.hasFailure()).toBe(true);
  });

  it("requires a complete successful round after an error", () => {
    const sources = ["tianditu-vec", "tianditu-cva"];
    const cycle = new BasemapSourceLoadCycle(sources);

    expect(cycle.loaded("tianditu-vec", sources)).toBe(false);
    cycle.fail(sources);
    expect(cycle.loaded("tianditu-cva", sources)).toBe(false);
    expect(cycle.completeFromMapLifecycle(sources)).toBe(false);
    expect(cycle.loaded("tianditu-vec", sources)).toBe(true);
    expect(cycle.hasFailure()).toBe(false);
  });

  it("allows an explicit retry to begin a fresh recovery cycle", () => {
    const sources = ["tianditu-vec", "tianditu-cva"];
    const cycle = new BasemapSourceLoadCycle(sources);
    cycle.fail(sources);

    cycle.reset(sources);

    expect(cycle.hasFailure()).toBe(false);
    expect(cycle.completeFromMapLifecycle(sources)).toBe(true);
  });
});

describe("probePlatformHealth", () => {
  it("reports a real request timeout as unreachable", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );

    const resultPromise = probePlatformHealth({
      fetchImpl,
      timeoutMs: 5_000,
    });
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(resultPromise).resolves.toEqual({
      status: "unreachable",
      latencyMs: null,
    });
  });

  it("keeps a superseded request distinct from a timeout", async () => {
    const externalController = new AbortController();
    const fetchImpl = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );

    const resultPromise = probePlatformHealth({
      fetchImpl,
      signal: externalController.signal,
    });
    externalController.abort();

    await expect(resultPromise).resolves.toEqual({
      status: "cancelled",
      latencyMs: null,
    });
  });

  it("returns measured latency for a successful health response", async () => {
    const samples = [100, 145];
    const result = await probePlatformHealth({
      fetchImpl: vi.fn(async () => new Response("{}", { status: 200 })),
      now: () => samples.shift() ?? 145,
    });

    expect(result).toEqual({ status: "reachable", latencyMs: 45 });
  });
});
