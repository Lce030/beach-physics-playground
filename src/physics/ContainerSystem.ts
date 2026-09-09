import { Body, type Engine } from 'matter-js';

import { BLUEPRINTS } from './bodies';
import type { WaterTable } from './WaterTable';
import { readPlugin, type SceneObject } from './types';

export interface PourEvent {
  /** Lip the water leaves from. */
  readonly x: number;
  readonly y: number;
  /** Water poured on this substep, in px². */
  readonly amount: number;
  /** Which way the stream falls; the bucket may be on its side. */
  readonly directionX: number;
}

/**
 * Containers that fill and empty.
 *
 * Mouth under water and it fills; tilted past what the fill level holds and it
 * spills from the lower lip. Contents add real mass.
 */
export class ContainerSystem {
  private readonly pourListeners = new Set<(event: PourEvent) => void>();

  constructor(
    private readonly engine: Engine,
    private readonly water: WaterTable,
  ) {}

  onPour(listener: (event: PourEvent) => void): () => void {
    this.pourListeners.add(listener);
    return () => {
      this.pourListeners.delete(listener);
    };
  }

  apply(objects: readonly SceneObject[], deltaMs: number): void {
    const time = this.engine.timing.timestamp;

    for (const { body } of objects) {
      const plugin = readPlugin(body);
      if (!plugin) continue;

      const profile = BLUEPRINTS[plugin.kind].container;
      if (!profile) continue;

      const before = plugin.contents;
      const tilt = normalizeAngle(body.angle);
      const fill = plugin.contents / profile.capacity;
      const spillAngle =
        profile.spillAngleEmpty + (profile.spillAngleFull - profile.spillAngleEmpty) * fill;
      const excessTilt = Math.abs(tilt) - spillAngle;

      // Mouth: the centre of the top edge, rotated with the body.
      const mouthX = body.position.x - Math.sin(body.angle) * plugin.halfHeight;
      const mouthY = body.position.y - Math.cos(body.angle) * plugin.halfHeight;

      const underWater =
        this.water.hasWaterAt(mouthX) && mouthY > this.water.animatedSurfaceYAt(mouthX, time);

      if (underWater && excessTilt <= 0) {
        plugin.contents = Math.min(
          profile.capacity,
          plugin.contents + profile.flowRate * deltaMs,
        );
      } else if (excessTilt > 0 && plugin.contents > 0) {
        // The further over it goes, the faster it empties.
        const rate = profile.flowRate * Math.min(1, excessTilt / 0.6);
        const poured = Math.min(plugin.contents, rate * deltaMs);
        plugin.contents -= poured;

        // Water leaves from whichever of the two rim lips is lower.
        const lipDirection = tilt > 0 ? 1 : -1;
        const lipX = mouthX + Math.cos(body.angle) * plugin.halfWidth * lipDirection;
        const lipY = mouthY + Math.sin(body.angle) * plugin.halfWidth * lipDirection;
        // Poured water joins the terrain water table rather than vanishing.
        this.water.pour(lipX, poured);
        this.emitPour({ x: lipX, y: lipY, amount: poured, directionX: lipDirection });
      }

      if (plugin.contents !== before) {
        // Matter recalculates inertia too, so a full bucket is harder to tip.
        Body.setMass(body, plugin.baseMass + plugin.contents * profile.contentDensity);
      }
    }
  }

  private emitPour(event: PourEvent): void {
    for (const listener of this.pourListeners) listener(event);
  }
}

/** Wraps an angle into [-PI, PI] to measure real tilt. */
function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
