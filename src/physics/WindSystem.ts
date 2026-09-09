import { Body, type Engine } from 'matter-js';

import { WIND } from '../config/scene';
import { verticalExtent } from './geometry';
import { readPlugin, type SceneObject } from './types';

/**
 * Viento.
 *
 * Pushes by frontal area as a force, not an acceleration, so mass enters the
 * equation on its own. Runs once per substep.
 */
export class WindSystem {
  /** -1 (out to sea) to 1 (towards the beach). */
  private target = 0;
  private auto = false;

  constructor(private readonly engine: Engine) {}

  setStrength(value: number): void {
    this.target = clamp(value, -1, 1);
  }

  setAuto(enabled: boolean): void {
    this.auto = enabled;
  }

  /** Wind right now. In auto mode it drifts on its own. */
  get strength(): number {
    if (!this.auto) return this.target;

    // Two sines: irregular-looking but deterministic, so the streaks can be
    // drawn in phase.
    const time = this.engine.timing.timestamp;
    const gust =
      Math.sin(time * WIND.gustSpeed) * 0.62 + Math.sin(time * WIND.gustSpeed * 2.7) * 0.3;
    return clamp(gust, -1, 1);
  }

  apply(objects: readonly SceneObject[]): void {
    const wind = this.strength;
    if (Math.abs(wind) < 0.01) return;

    for (const { body, extraBodies } of objects) {
      const plugin = readPlugin(body);
      if (!plugin || body.isStatic) continue;

      // Nothing blows underwater; the submerged part is sheltered.
      const exposure = 1 - plugin.submerged;
      if (exposure <= 0.02) continue;

      // Rotated sail area: flat on the sand a board barely catches wind, on
      // edge it becomes a sail.
      const sail = verticalExtent(body);
      this.push(body, sail, wind * exposure, sail / 2);

      // Loose parts get their share, which is why crab legs sway in a gust.
      for (const part of extraBodies) {
        const height = verticalExtent(part);
        this.push(part, height, wind * exposure, height / 2);
      }
    }
  }

  private push(body: Body, frontalArea: number, wind: number, halfHeight: number): void {
    const force = frontalArea * wind * WIND.force;
    Body.applyForce(
      body,
      { x: body.position.x, y: body.position.y - halfHeight * WIND.leverage },
      { x: force, y: 0 },
    );
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
