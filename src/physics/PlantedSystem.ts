import {
  Composite,
  Constraint,
  Events,
  type Composite as MatterComposite,
  type Engine,
  type IEventCollision,
} from 'matter-js';

import type { PlantedProfile } from './bodies';
import type { Terrain } from './Terrain';
import type { SceneObject } from './types';

interface Planting {
  readonly object: SceneObject;
  readonly profile: PlantedProfile;
  /** Both anchors. A single one would leave it free to rotate. */
  readonly constraints: readonly Constraint[];
  /** Where it was planted. Fixed even as the umbrella leans. */
  readonly anchorX: number;
  /** Sand height when it was planted. */
  readonly plantedGroundY: number;
}

/**
 * Objects planted in the sand.
 *
 * Two anchors rather than one: a single anchor is an inverted pendulum pinned
 * at the tip and topples immediately. The anchors follow the terrain surface,
 * since sand can be dug out and piled back.
 *
 * Three separate signals can pull one loose: stretch, impact and digging.
 */
export class PlantedSystem {
  private readonly plantings: Planting[] = [];

  constructor(
    engine: Engine,
    private readonly world: MatterComposite,
    private readonly terrain: Terrain,
  ) {
    Events.on(engine, 'collisionStart', (event: IEventCollision<Engine>) => {
      this.handleImpacts(event);
    });
  }

  plant(object: SceneObject, profile: PlantedProfile, footOffsetY: number): void {
    const anchorX = object.body.position.x;
    const groundY = this.terrain.surfaceYAt(anchorX);

    const constraints = [-profile.rootSpread, profile.rootSpread].map((offset) =>
      Constraint.create({
        pointA: { x: anchorX + offset, y: groundY },
        bodyB: object.body,
        pointB: { x: offset, y: footOffsetY },
        length: 0,
        stiffness: profile.rootStiffness,
        damping: 0.35,
        render: { visible: false },
      }),
    );

    Composite.add(this.world, constraints);
    this.plantings.push({ object, profile, constraints, anchorX, plantedGroundY: groundY });
  }

  /** Runs once per substep, like the water. */
  apply(): void {
    for (let i = this.plantings.length - 1; i >= 0; i -= 1) {
      const planting = this.plantings[i];
      if (!planting) continue;

      const { profile, constraints, anchorX, plantedGroundY } = planting;
      const groundY = this.terrain.surfaceYAt(anchorX);

      // Anchors follow the sand: pile it up and the umbrella rises too.
      for (const constraint of constraints) constraint.pointA.y = groundY;

      // Has the sand been dug out from under it?
      if (groundY - plantedGroundY > profile.uprootDig) {
        this.uprootAt(i);
        continue;
      }

      // Is something pulling on it?
      if (this.maxStretch(planting) > profile.uprootStretch) {
        this.uprootAt(i);
      }
    }
  }

  /** How far the anchored point has drifted from its place in the sand. */
  private maxStretch(planting: Planting): number {
    const body = planting.object.body;
    let worst = 0;

    for (const constraint of planting.constraints) {
      // pointB already arrives in world orientation: Matter rotates it.
      const worldX = body.position.x + constraint.pointB.x;
      const worldY = body.position.y + constraint.pointB.y;
      worst = Math.max(
        worst,
        Math.hypot(worldX - constraint.pointA.x, worldY - constraint.pointA.y),
      );
    }

    return worst;
  }

  /**
   * A hard enough hit knocks it loose. Measured by collision speed, since the
   * anchors are rigid enough that impacts barely stretch them.
   */
  private handleImpacts(event: IEventCollision<Engine>): void {
    for (const pair of event.pairs) {
      // For compound bodies the pair points at the part, not the parent.
      const a = pair.bodyA.parent;
      const b = pair.bodyB.parent;

      // Static bodies do not count, or settling onto the sand would uproot it.
      if (a.isStatic || b.isStatic) continue;

      const index = this.plantings.findIndex(
        (planting) => planting.object.body === a || planting.object.body === b,
      );
      if (index < 0) continue;

      const planting = this.plantings[index];
      if (!planting) continue;

      const speed = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
      if (speed > planting.profile.uprootImpact) this.uprootAt(index);
    }
  }

  /** Drops an object's anchors, on removal or on being torn out. */
  release(object: SceneObject): void {
    const index = this.plantings.findIndex((planting) => planting.object === object);
    if (index >= 0) this.uprootAt(index);
  }

  private uprootAt(index: number): void {
    const planting = this.plantings[index];
    if (!planting) return;
    for (const constraint of planting.constraints) {
      Composite.remove(this.world, constraint, true);
    }
    this.plantings.splice(index, 1);
  }

  /** Still planted? */
  isPlanted(object: SceneObject): boolean {
    return this.plantings.some((planting) => planting.object === object);
  }

  clear(): void {
    while (this.plantings.length > 0) this.uprootAt(this.plantings.length - 1);
  }
}
