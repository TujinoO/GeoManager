import type { BasemapId } from "./basemapCatalog";
import type { ActiveBasemapDescriptor } from "./basemapStatus";

export const rateLimitRecoveryCooldownMs = 30_000;

export const rateLimitRecoverySwitchOptions = {
  persist: false,
  announce: false,
  rollbackOnFailure: false,
} as const;

export type BasemapRecoveryReason = "rate-limit" | "sustained-failure";

export interface BasemapRateLimitRecoveryState {
  descriptor: ActiveBasemapDescriptor | null;
  inFlight: boolean;
  reason: BasemapRecoveryReason;
  suppressUntil: number;
}

export function shouldSuppressRecoveredBasemapRateLimitError({
  recovery,
  now,
  isRateLimitError,
  isSustainedFailure = false,
  matchesRecoveryDescriptor,
}: {
  recovery: BasemapRateLimitRecoveryState;
  now: number;
  isRateLimitError: boolean;
  isSustainedFailure?: boolean;
  matchesRecoveryDescriptor: boolean;
}) {
  return Boolean(
    recovery.descriptor &&
    matchesRecoveryDescriptor &&
    (recovery.inFlight || now < recovery.suppressUntil) &&
    (isRateLimitError || isSustainedFailure),
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
