import type { BasemapId } from "./basemapCatalog";
import type { ActiveBasemapDescriptor } from "./basemapStatus";

export const rateLimitRecoveryCooldownMs = 30_000;

export const rateLimitRecoverySwitchOptions = {
  persist: false,
  announce: false,
  rollbackOnFailure: false,
} as const;

export interface BasemapRateLimitRecoveryState {
  descriptor: ActiveBasemapDescriptor | null;
  inFlight: boolean;
  suppressUntil: number;
}

export function shouldSuppressRecoveredBasemapRateLimitError({
  recovery,
  now,
  isRateLimitError,
  matchesRecoveryDescriptor,
}: {
  recovery: BasemapRateLimitRecoveryState;
  now: number;
  isRateLimitError: boolean;
  matchesRecoveryDescriptor: boolean;
}) {
  return Boolean(
    (recovery.inFlight || now < recovery.suppressUntil) &&
    recovery.descriptor &&
    isRateLimitError &&
    matchesRecoveryDescriptor,
  );
}

export function shouldBlockRateLimitedBasemapSelection(
  recovery: BasemapRateLimitRecoveryState,
  targetId: BasemapId,
  now: number,
) {
  return Boolean(
    recovery.descriptor?.id === targetId &&
    (recovery.inFlight || now < recovery.suppressUntil),
  );
}

export function canRunRateLimitRecovery({
  recovery,
  failedDescriptor,
  failedBasemapId,
  activeBasemapId,
  activeGeneration,
  basemapSwitching,
  drawModeActive,
  basemapSwitchDisabled,
}: {
  recovery: BasemapRateLimitRecoveryState;
  failedDescriptor: ActiveBasemapDescriptor;
  failedBasemapId: BasemapId;
  activeBasemapId: BasemapId;
  activeGeneration: number;
  basemapSwitching: boolean;
  drawModeActive: boolean;
  basemapSwitchDisabled: boolean;
}) {
  return (
    recovery.inFlight &&
    recovery.descriptor?.id === failedDescriptor.id &&
    recovery.descriptor.generation === failedDescriptor.generation &&
    activeBasemapId === failedBasemapId &&
    activeGeneration === failedDescriptor.generation &&
    !basemapSwitching &&
    !drawModeActive &&
    !basemapSwitchDisabled
  );
}
