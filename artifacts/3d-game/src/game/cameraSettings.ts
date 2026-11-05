import { useSyncExternalStore } from 'react';

/** Player-facing camera preferences, edited from the phone's Settings tab. */
export type CameraMode = 'third' | 'first';

export interface CameraSettings {
  mode: CameraMode;
  /** Multiplier applied to mouse / swipe look speed (0.25 – 3). */
  sensitivity: number;
  invertY: boolean;
}

const STORAGE_KEY = 'american-dream-camera-v1';
export const SENSITIVITY_MIN = 0.25;
export const SENSITIVITY_MAX = 3;
export const DEFAULT_CAMERA_SETTINGS: CameraSettings = { mode: 'third', sensitivity: 1, invertY: false };

function read(): CameraSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return { ...DEFAULT_CAMERA_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<CameraSettings>;
    const sensitivity = Number(parsed.sensitivity);
    return {
      mode: parsed.mode === 'first' ? 'first' : 'third',
      sensitivity: Number.isFinite(sensitivity)
        ? Math.min(SENSITIVITY_MAX, Math.max(SENSITIVITY_MIN, sensitivity))
        : DEFAULT_CAMERA_SETTINGS.sensitivity,
      invertY: Boolean(parsed.invertY),
    };
  } catch {
    return { ...DEFAULT_CAMERA_SETTINGS };
  }
}

let current: CameraSettings = read();
const listeners = new Set<() => void>();

export function getCameraSettings(): CameraSettings {
  return current;
}

export function updateCameraSettings(patch: Partial<CameraSettings>) {
  current = { ...current, ...patch };
  current.sensitivity = Math.min(SENSITIVITY_MAX, Math.max(SENSITIVITY_MIN, current.sensitivity));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable (private mode) — keep the in-session value */
  }
  listeners.forEach((listener) => listener());
}

export function resetCameraSettings() {
  updateCameraSettings({ ...DEFAULT_CAMERA_SETTINGS });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCameraSettings(): CameraSettings {
  return useSyncExternalStore(subscribe, getCameraSettings, getCameraSettings);
}
