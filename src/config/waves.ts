import { WATER } from './scene';

/**
 * Wave height at a given x and time.
 *
 * Shared by rendering and physics on purpose: if the water is drawn wavy but
 * buoyancy uses a flat line, objects hover above the crests.
 */
export function waveOffsetAt(x: number, timeMs: number): number {
  return Math.sin(x * 0.018 + timeMs * 0.0016) * 2.6 + Math.sin(x * 0.041 - timeMs * 0.0026) * 1.4;
}

/** Absolute y of the water surface at that x. */
export function waterSurfaceAt(x: number, timeMs: number): number {
  return WATER.surfaceY + waveOffsetAt(x, timeMs);
}
