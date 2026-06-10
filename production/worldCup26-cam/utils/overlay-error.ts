import { Signal } from '@angular/core';
import {
  WorldCup26CamOverlayDescriptor,
  WORLD_CUP26_CAM_OVERLAY_DESCRIPTORS,
  WORLD_CUP26_CAM_OVERLAY_STATES,
  WorldCup26CamOverlayStateValue,
} from 'src/app/feature-modules/worldCup26-cam/defines/defines';
export type WorldCup26CamOverlayState = WorldCup26CamOverlayStateValue | null;
export type WorldCup26CamOverlay = WorldCup26CamOverlayDescriptor | null;
export function resolveWorldCup26CamOverlayState(signals: {
  noTrials: Signal<boolean>;
  isEligible: Signal<boolean>;
  timeout: Signal<boolean>;
  hasError: Signal<boolean>;
}): WorldCup26CamOverlayState {
  if (signals.noTrials()) {
    return WORLD_CUP26_CAM_OVERLAY_STATES.NO_TRIALS;
  }
  if (!signals.isEligible()) {
    return WORLD_CUP26_CAM_OVERLAY_STATES.NOT_ELIGIBLE;
  }
  if (signals.hasError()) {
    return WORLD_CUP26_CAM_OVERLAY_STATES.DEFAULT;
  }
  if (signals.timeout()) {
    return WORLD_CUP26_CAM_OVERLAY_STATES.TIMEOUT;
  }
  return null;
}
export function resolveWorldCup26CamOverlay(signals: {
  noTrials: Signal<boolean>;
  isEligible: Signal<boolean>;
  hasError: Signal<boolean>;
  timeout: Signal<boolean>;
}): WorldCup26CamOverlay {
  const overlayState = resolveWorldCup26CamOverlayState(signals);
  return overlayState ? WORLD_CUP26_CAM_OVERLAY_DESCRIPTORS[overlayState] : null;
}
