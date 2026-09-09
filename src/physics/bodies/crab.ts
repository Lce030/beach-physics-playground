import { Bodies, Body, Constraint, type Body as MatterBody, type Constraint as MatterConstraint } from 'matter-js';

export const CRAB = {
  shellWidth: 46,
  shellHeight: 26,
  legLength: 20,
  legThickness: 5,
  /** X offsets where the legs attach to the shell. */
  legAnchors: [-17, -6, 6, 17],
} as const;

/**
 * Crab: shell plus articulated legs.
 *
 * The legs are separate bodies joined by constraints, not parts, so they hang
 * and drag behind. Every piece shares a negative collision group, which in
 * Matter means they never collide with each other.
 */
export function createCrab(x: number, y: number): {
  body: MatterBody;
  extraBodies: MatterBody[];
  constraints: MatterConstraint[];
} {
  const { shellWidth, shellHeight, legLength, legThickness, legAnchors } = CRAB;
  const group = Body.nextGroup(true);

  const shell = Bodies.rectangle(x, y, shellWidth, shellHeight, {
    label: 'crab',
    chamfer: { radius: 11 },
    collisionFilter: { group },
    density: 0.0016,
    friction: 0.7,
    frictionAir: 0.02,
    restitution: 0.1,
  });

  const legs: MatterBody[] = [];
  const constraints: MatterConstraint[] = [];

  for (const offsetX of legAnchors) {
    // Legs start splayed outwards so the crab rests on its tips rather than
    // sitting on its shell.
    const splay = Math.sign(offsetX) * 0.6;
    const leg = Bodies.rectangle(
      x + offsetX + Math.sin(splay) * legLength * 0.5,
      y + shellHeight / 2 + Math.cos(splay) * legLength * 0.5,
      legThickness,
      legLength,
      {
        label: 'crabLeg',
        chamfer: { radius: 2 },
        collisionFilter: { group },
        // Dense on purpose: a big mass ratio to the shell makes the
        // constraint solver unstable.
        density: 0.004,
        friction: 0.9,
        frictionAir: 0.06,
        restitution: 0,
      },
    );
    Body.setAngle(leg, splay);
    legs.push(leg);

    const jointA = { x: offsetX, y: shellHeight / 2 - 2 };
    const tipB = { x: 0, y: legLength / 2 };

    // 1) The joint: holds the leg to the shell by its upper end.
    constraints.push(
      Constraint.create({
        bodyA: shell,
        pointA: jointA,
        bodyB: leg,
        pointB: { x: 0, y: -legLength / 2 },
        length: 0,
        stiffness: 0.9,
        damping: 0.2,
        render: { visible: false },
      }),
    );

    // 2) A slack spring to the tip, giving the leg a rest pose. On the joint
    // alone it hangs from one point and spins without limit.
    const muscleA = { x: offsetX * 0.5, y: -shellHeight / 2 };
    const restLength = Math.hypot(
      jointA.x + Math.sin(splay) * legLength - muscleA.x,
      jointA.y + Math.cos(splay) * legLength - muscleA.y,
    );
    constraints.push(
      Constraint.create({
        bodyA: shell,
        pointA: muscleA,
        bodyB: leg,
        pointB: tipB,
        length: restLength,
        stiffness: 0.25,
        damping: 0.12,
        render: { visible: false },
      }),
    );
  }

  return { body: shell, extraBodies: legs, constraints };
}
