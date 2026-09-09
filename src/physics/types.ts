import type { Body, Constraint } from 'matter-js';

/** Object types the palette can create. */
export type ObjectKind = 'beachBall' | 'coconut' | 'metalBucket' | 'umbrella' | 'crab' | 'surfboard';

/** A scene object: stable identity plus its Matter bodies. */
export interface SceneObject {
  readonly id: number;
  readonly kind: ObjectKind;
  /** Main body: drives position, angle, grabbing and buoyancy. */
  readonly body: Body;
  /** Loose bodies joined by constraints, such as the crab legs. */
  readonly extraBodies: readonly Body[];
  readonly constraints: readonly Constraint[];
}

/**
 * Data hung off body.plugin, including unrotated measurements that buoyancy
 * needs on every substep.
 */
export interface BeachPlugin {
  kind: ObjectKind;
  id: number;
  /** frictionAir in air, so it can be restored on leaving the water. */
  baseFrictionAir: number;
  halfWidth: number;
  halfHeight: number;
  /** Submerged fraction on the previous substep, used to detect splashes. */
  submerged: number;
  /**
   * Effective water density, fixed at creation. Derived from mass each step,
   * a filling bucket would gain buoyancy as fast as weight and never sink.
   */
  waterDensity: number;
  /** Mass of the empty body, so contents can be added on top. */
  baseMass: number;
  /** Water held inside, in px² of cross-section. Zero for non-containers. */
  contents: number;
}

export function readPlugin(body: Body): BeachPlugin | null {
  const plugin = (body.plugin as { beach?: BeachPlugin } | undefined)?.beach;
  return plugin ?? null;
}

export function writePlugin(body: Body, data: BeachPlugin): void {
  (body.plugin as { beach?: BeachPlugin }).beach = data;
}
