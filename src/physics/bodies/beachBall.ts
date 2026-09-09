import { Bodies, type Body } from 'matter-js';

/**
 * Beach ball: light, very bouncy, low rolling friction. Low density with
 * slightly high frictionAir reads as inflatable rather than solid.
 */
export const BEACH_BALL_RADIUS = 34;

export function createBeachBall(x: number, y: number): Body {
  return Bodies.circle(x, y, BEACH_BALL_RADIUS, {
    label: 'beachBall',
    density: 0.0006,
    restitution: 0.72,
    friction: 0.02,
    frictionStatic: 0.1,
    frictionAir: 0.012,
    slop: 0.02,
  });
}
