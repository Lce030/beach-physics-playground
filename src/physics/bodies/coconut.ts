import { Bodies, type Body } from 'matter-js';

/** Coconut: dense, barely bounces, rolls well. Floats half submerged. */
export const COCONUT_RADIUS = 23;

export function createCoconut(x: number, y: number): Body {
  return Bodies.circle(x, y, COCONUT_RADIUS, {
    label: 'coconut',
    density: 0.0016,
    restitution: 0.28,
    friction: 0.35,
    frictionStatic: 0.6,
    frictionAir: 0.008,
  });
}
