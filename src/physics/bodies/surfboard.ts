import { Bodies, type Body } from 'matter-js';

export const SURFBOARD = {
  length: 132,
  width: 24,
} as const;

/**
 * Surfboard: long, flat and very light. Dropped on edge it rights itself,
 * and its surface area makes it the most wind-sensitive object here.
 */
export function createSurfboard(x: number, y: number): Body {
  return Bodies.rectangle(x, y, SURFBOARD.length, SURFBOARD.width, {
    label: 'surfboard',
    chamfer: { radius: SURFBOARD.width / 2 },
    density: 0.00055,
    restitution: 0.2,
    friction: 0.35,
    frictionStatic: 0.6,
    frictionAir: 0.014,
  });
}
