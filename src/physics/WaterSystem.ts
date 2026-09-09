import { Body, type Engine } from 'matter-js';

import { BLUEPRINTS } from './bodies';
import type { WaterTable } from './WaterTable';
import { readPlugin, type SceneObject } from './types';

export interface SplashEvent {
  readonly x: number;
  readonly y: number;
  /** 0..1, from how hard the impact was. */
  readonly strength: number;
  /** Width of what entered: a bucket splashes more than a coconut. */
  readonly width: number;
}

/**
 * Points along the body where buoyancy is sampled. A single point acts on the
 * centre of mass and produces no torque, so nothing would ever right itself.
 */
const BUOYANCY_SAMPLES: number = 3;

/** Horizontal surface sway, as a fraction of g. */
const SWAY = 0.09;

/** Minimum downward speed (px/step) that counts as a splash. */
const SPLASH_SPEED = 1.6;

/**
 * Buoyancy, viscous drag and splash detection. Runs once per substep.
 */
export class WaterSystem {
  private readonly splashListeners = new Set<(event: SplashEvent) => void>();

  constructor(
    private readonly engine: Engine,
    private readonly water: WaterTable,
  ) {}

  onSplash(listener: (event: SplashEvent) => void): () => void {
    this.splashListeners.add(listener);
    return () => {
      this.splashListeners.delete(listener);
    };
  }

  apply(objects: readonly SceneObject[]): void {
    const time = this.engine.timing.timestamp;
    const gravity = this.engine.gravity.y * this.engine.gravity.scale;

    for (const { body } of objects) {
      const plugin = readPlugin(body);
      if (!plugin || body.isStatic) continue;

      const profile = BLUEPRINTS[plugin.kind].water;
      const { halfWidth, halfHeight } = plugin;

      // Water density was fixed when the body was created. See BeachPlugin.
      const waterDensity = plugin.waterDensity;
      const sliceArea = body.area / BUOYANCY_SAMPLES;

      const cos = Math.cos(body.angle);
      const sin = Math.sin(body.angle);

      let submergedTotal = 0;

      for (let i = 0; i < BUOYANCY_SAMPLES; i += 1) {
        // Points spread along the body local x axis, rotated with it.
        const t = BUOYANCY_SAMPLES === 1 ? 0 : (i / (BUOYANCY_SAMPLES - 1)) * 2 - 1;
        const offset = t * halfWidth * 0.7;
        const px = body.position.x + offset * cos;
        const py = body.position.y + offset * sin;

        // Lift only where there is water, sea or puddle alike.
        if (!this.water.hasWaterAt(px)) continue;

        const surface = this.water.animatedSurfaceYAt(px, time);
        const ratio = clamp((py + halfHeight - surface) / (halfHeight * 2), 0, 1);
        if (ratio <= 0) continue;

        submergedTotal += ratio;

        const buoyancy = waterDensity * sliceArea * ratio * gravity;
        Body.applyForce(body, { x: px, y: py }, { x: 0, y: -buoyancy });
      }

      const submerged = submergedTotal / BUOYANCY_SAMPLES;

      // frictionAir interpolated between air and water. Matter applies it to
      // angular velocity too.
      body.frictionAir =
        plugin.baseFrictionAir + (profile.drag - plugin.baseFrictionAir) * submerged;

      // Sway for what is half in, half out. The wave travels shorewards so
      // floating objects beach themselves.
      if (submerged > 0.05 && submerged < 0.95) {
        const sway = Math.cos(body.position.x * 0.02 + time * 0.0022) * SWAY;
        Body.applyForce(body, body.position, { x: sway * body.mass * gravity, y: 0 });
      }

      // Splash: crossing the surface downwards fast enough.
      if (plugin.submerged < 0.06 && submerged >= 0.06 && body.velocity.y > SPLASH_SPEED) {
        this.emitSplash({
          x: body.position.x,
          y: this.water.animatedSurfaceYAt(body.position.x, time),
          strength: Math.min(1, body.velocity.y / 14),
          width: halfWidth * 2,
        });
      }

      plugin.submerged = submerged;
    }
  }

  private emitSplash(event: SplashEvent): void {
    for (const listener of this.splashListeners) listener(event);
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
