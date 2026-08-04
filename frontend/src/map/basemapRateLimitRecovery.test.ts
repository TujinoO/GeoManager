import { describe, expect, it } from "vitest";
import { createBasemapCatalog } from "./basemapCatalog";
import {
  canRunRateLimitRecovery,
  rateLimitRecoverySwitchOptions,
  shouldBlockRateLimitedBasemapSelection,
  shouldSuppressRecoveredBasemapRateLimitError,
  type BasemapRateLimitRecoveryState,
} from "./basemapRateLimitRecovery";
import {
  resolveBasemapRateLimitFallback,
  resolveBasemapTechnicalFallback,
} from "./basemapSwitch";
import type { ActiveBasemapDescriptor } from "./basemapStatus";

const descriptor: ActiveBasemapDescriptor = {
  id: "tianditu-vector",
  generation: 7,
  sourceIds: ["basemap-tianditu-vector", "basemap-tianditu-labels"],
  requireAllSourceIds: true,
  resourceMarkers: ["tianditu.gov.cn"],
};

function recovery(
  overrides: Partial<BasemapRateLimitRecoveryState> = {},
): BasemapRateLimitRecoveryState {
  return {
    descriptor,
    inFlight: true,
    reason: "rate-limit",
    suppressUntil: 31_000,
    ...overrides,
  };
}

describe("Tianditu rate-limit recovery invariants", () => {
  it("suppresses a late 429 while the recovery transaction is still in flight after 30 seconds", () => {
    expect(
      shouldSuppressRecoveredBasemapRateLimitError({
        recovery: recovery(),
        now: 31_001,
        isRateLimitError: true,
        matchesRecoveryDescriptor: true,
      }),
    ).toBe(true);
    expect(
      shouldSuppressRecoveredBasemapRateLimitError({
        recovery: recovery({ inFlight: false }),
        now: 31_001,
        isRateLimitError: true,
        matchesRecoveryDescriptor: true,
      }),
    ).toBe(false);
  });

  it.each([
    { drawModeActive: true, basemapSwitchDisabled: false },
    { drawModeActive: false, basemapSwitchDisabled: true },
  ])("does not switch while drawing or exporting: %o", (locks) => {
    expect(
      canRunRateLimitRecovery({
        recovery: recovery(),
        failedDescriptor: descriptor,
        failedBasemapId: "tianditu-vector",
        activeBasemapId: "tianditu-vector",
        activeGeneration: 7,
        basemapSwitching: false,
        ...locks,
      }),
    ).toBe(false);
  });

  it("suppresses repeated sustained failures with the same single-flight cooldown", () => {
    const sustainedRecovery = recovery({
      inFlight: false,
      reason: "sustained-failure",
    });
    expect(
      shouldSuppressRecoveredBasemapRateLimitError({
        recovery: sustainedRecovery,
        now: 30_999,
        isRateLimitError: false,
        isSustainedFailure: true,
        matchesRecoveryDescriptor: true,
      }),
    ).toBe(true);
    expect(
      shouldSuppressRecoveredBasemapRateLimitError({
        recovery: sustainedRecovery,
        now: 30_999,
        isRateLimitError: true,
        isSustainedFailure: false,
        matchesRecoveryDescriptor: true,
      }),
    ).toBe(true);
  });

  it("uses only Tianditu -> Mapbox -> OSM when Mapbox recovery fails", () => {
    const catalog = createBasemapCatalog({
      mapboxAccessToken: "test-public-token",
      tiandituKey: "test-public-key",
    });
    const primary = resolveBasemapRateLimitFallback(catalog, "tianditu-vector");
    const technical = resolveBasemapTechnicalFallback(catalog, primary!.id);

    expect([primary?.id, technical?.id]).toEqual(["mapbox-satellite", "osm"]);
    expect(technical?.id).not.toBe("tianditu-vector");
  });

  it("never persists the automatic recovery choice", () => {
    expect(rateLimitRecoverySwitchOptions).toEqual({
      persist: false,
      announce: false,
      rollbackOnFailure: false,
    });
  });

  it("blocks reselecting Tianditu throughout its cooldown", () => {
    expect(
      shouldBlockRateLimitedBasemapSelection(
        recovery({ inFlight: false }),
        "tianditu-vector",
        30_999,
      ),
    ).toBe(true);
    expect(
      shouldBlockRateLimitedBasemapSelection(
        recovery({ inFlight: false }),
        "tianditu-vector",
        31_000,
      ),
    ).toBe(false);
  });
});
