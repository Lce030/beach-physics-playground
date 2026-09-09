import { TERRAIN } from './scene';

/**
 * Starting beach profile. It seeds the heightmap on boot; from then on the
 * live terrain owns the shape.
 */
export function initialSurfaceYAt(x: number): number {
  if (x <= TERRAIN.rampStartX) return TERRAIN.sandTopY;
  if (x >= TERRAIN.rampEndX) return TERRAIN.seabedY;
  const t = (x - TERRAIN.rampStartX) / (TERRAIN.rampEndX - TERRAIN.rampStartX);
  return TERRAIN.sandTopY + t * (TERRAIN.seabedY - TERRAIN.sandTopY);
}
