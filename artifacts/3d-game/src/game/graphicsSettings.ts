import { useSyncExternalStore } from 'react';

/**
 * Player-facing graphics / world-time preferences (phone → Settings).
 * The quality preset decides every expensive feature in one place so
 * low-end laptops and phones stay smooth.
 */
export type QualityLevel = 'low' | 'medium' | 'high';
export type QualityChoice = 'auto' | QualityLevel;
export type TimeMode = 'cycle' | 'day' | 'night';

export interface GraphicsSettings {
  quality: QualityChoice;
  timeMode: TimeMode;
  /** Rain-slick streets: puddles + glossy asphalt that reflect the sky and lights. */
  wetStreets: boolean;
}

export interface QualityProfile {
  level: QualityLevel;
  dpr: [number, number];
  shadows: boolean;
  shadowMapSize: number;
  shadowRange: number;
  antialias: boolean;
  /** Resolution of the prefiltered environment cubemap used for reflections. */
  envSize: number;
  /** Clear-coat car paint (MeshPhysicalMaterial) instead of plain standard paint. */
  physicalPaint: boolean;
  /** Max number of real point lights (street lamps) placed near the player at night. */
  lampLights: number;
  /** Car-headlight spotlights on the player vehicle at night. */
  headlightSpots: boolean;
  /** Distance where vehicles swap from detailed to low-poly meshes. */
  carLod: number;
  /** Vehicles beyond this distance are hidden entirely. */
  carCull: number;
  /** Fraction of ambient traffic spawned (1 = full). */
  trafficDensity: number;
}

const PROFILES: Record<QualityLevel, QualityProfile> = {
  low: { level: 'low', dpr: [0.75, 1], shadows: false, shadowMapSize: 512, shadowRange: 30, antialias: false, envSize: 64, physicalPaint: false, lampLights: 0, headlightSpots: false, carLod: 28, carCull: 140, trafficDensity: 0.55 },
  medium: { level: 'medium', dpr: [1, 1.25], shadows: true, shadowMapSize: 1024, shadowRange: 42, antialias: true, envSize: 128, physicalPaint: false, lampLights: 2, headlightSpots: true, carLod: 45, carCull: 220, trafficDensity: 0.8 },
  high: { level: 'high', dpr: [1, 1.6], shadows: true, shadowMapSize: 2048, shadowRange: 55, antialias: true, envSize: 256, physicalPaint: true, lampLights: 4, headlightSpots: true, carLod: 70, carCull: 320, trafficDensity: 1 },
};

const STORAGE_KEY = 'american-dream-graphics-v1';
export const DEFAULT_GRAPHICS: GraphicsSettings = { quality: 'auto', timeMode: 'cycle', wetStreets: false };

/** Best-guess device class: phones and low-memory / low-core machines get lighter settings. */
export function detectQuality(): QualityLevel {
  if (typeof navigator === 'undefined') return 'medium';
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const cores = nav.hardwareConcurrency || 4;
  const memory = nav.deviceMemory ?? 8;
  if (coarse) return memory >= 6 && cores >= 8 ? 'medium' : 'low';
  if (cores <= 4 || memory <= 4) return 'low';
  if (cores >= 8 && memory >= 8) return 'high';
  return 'medium';
}

function read(): GraphicsSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return { ...DEFAULT_GRAPHICS };
    const p = JSON.parse(raw) as Partial<GraphicsSettings>;
    return {
      quality: p.quality === 'low' || p.quality === 'medium' || p.quality === 'high' ? p.quality : 'auto',
      timeMode: p.timeMode === 'day' || p.timeMode === 'night' ? p.timeMode : 'cycle',
      wetStreets: Boolean(p.wetStreets),
    };
  } catch {
    return { ...DEFAULT_GRAPHICS };
  }
}

let current = read();
const detected = detectQuality();
const listeners = new Set<() => void>();

export function getGraphicsSettings() {
  return current;
}

export function updateGraphicsSettings(patch: Partial<GraphicsSettings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* private mode — keep in-session */
  }
  listeners.forEach((l) => l());
}

export function resolveQuality(settings: GraphicsSettings = current): QualityProfile {
  return PROFILES[settings.quality === 'auto' ? detected : settings.quality];
}

export const detectedQuality = detected;

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useGraphicsSettings(): GraphicsSettings {
  return useSyncExternalStore(subscribe, getGraphicsSettings, getGraphicsSettings);
}
