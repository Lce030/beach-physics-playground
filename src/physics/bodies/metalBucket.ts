import {
  Bodies,
  Body,
  Constraint,
  type Body as MatterBody,
  type Constraint as MatterConstraint,
} from 'matter-js';

export const BUCKET_HALF_WIDTH = 25;
export const BUCKET_HALF_HEIGHT = 24;
/** How much water fits, in px² of cross-section. Used by physics and render. */
export const BUCKET_CAPACITY = 1500;

/** Handle measurements, shared by the body and the drawing. */
export const BUCKET_HANDLE = {
  /** Half the gap between the two rim rivets. */
  halfSpan: BUCKET_HALF_WIDTH * 0.82,
  /** How far the arc rises above the rim. */
  rise: 21,
  thickness: 4.5,
} as const;

/**
 * Metal bucket with an articulated handle.
 *
 * The handle is a separate body on two constraints, so it lags and nods as the
 * bucket moves. Being a real body it can also be grabbed, which a drawn-on
 * handle could not.
 */
export function createMetalBucket(
  x: number,
  y: number,
): { body: MatterBody; extraBodies: MatterBody[]; constraints: MatterConstraint[] } {
  const group = Body.nextGroup(true);
  const { halfSpan, rise, thickness } = BUCKET_HANDLE;

  const shell = Bodies.fromVertices(
    x,
    y,
    [
      [
        { x: -BUCKET_HALF_WIDTH, y: -BUCKET_HALF_HEIGHT },
        { x: BUCKET_HALF_WIDTH, y: -BUCKET_HALF_HEIGHT },
        { x: BUCKET_HALF_WIDTH * 0.72, y: BUCKET_HALF_HEIGHT },
        { x: -BUCKET_HALF_WIDTH * 0.72, y: BUCKET_HALF_HEIGHT },
      ],
    ],
    {
      label: 'metalBucket',
      collisionFilter: { group },
      density: 0.0042,
      restitution: 0.06,
      friction: 0.65,
      frictionStatic: 0.9,
      frictionAir: 0.01,
    },
  );

  // A bar at the height of the arc's apex. It is drawn as an arc, but the bar
  // is what collides and what the mouse grabs.
  const handle = Bodies.rectangle(
    x,
    y - BUCKET_HALF_HEIGHT - rise,
    halfSpan * 2,
    thickness,
    {
      label: 'bucketHandle',
      chamfer: { radius: thickness / 2 },
      collisionFilter: { group },
      // Heavy on purpose, like the crab legs, for solver stability.
      density: 0.011,
      friction: 0.4,
      frictionAir: 0.05,
      restitution: 0,
    },
  );

  // Two rivets, one at each end of the rim, with a little give so the handle
  // can nod and swing without coming off or spinning.
  const constraints = [-1, 1].map((side) =>
    Constraint.create({
      bodyA: shell,
      pointA: { x: side * halfSpan, y: -BUCKET_HALF_HEIGHT + 2 },
      bodyB: handle,
      // Tied at the tip of the handle leg, rise px below the bar. Tying the
      // bar itself lets gravity fold the handle into the bucket.
      pointB: { x: side * halfSpan, y: rise },
      length: 0,
      stiffness: 0.45,
      damping: 0.12,
      render: { visible: false },
    }),
  );

  return { body: shell, extraBodies: [handle], constraints };
}
