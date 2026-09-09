import { TERRAIN_GRID, WATER, WORLD } from '../config/scene';
import { waveOffsetAt } from '../config/waves';
import { NODE_COUNT, type Terrain } from './Terrain';

const { columnWidth } = TERRAIN_GRID;

/** How much water levels out between neighbouring columns per substep. */
const FLOW_RATE = 0.42;
/** How much the sand soaks up per substep, in px of depth. */
const SOAK_RATE = 0.012;
/** Below this, a puddle counts as dry. */
const MIN_DEPTH = 0.35;

/**
 * Water depth per column, on the same grid as the sand, so the sea and a
 * poured puddle are the same system.
 *
 * The sea is the boundary condition: any column whose sand sits below sea
 * level is refilled to it every step.
 */
export class WaterTable {
  /** Water depth over the sand, in px, per node. */
  private readonly depth = new Float64Array(NODE_COUNT);

  constructor(private readonly terrain: Terrain) {
    this.reset();
  }

  get depths(): Readonly<Float64Array> {
    return this.depth;
  }

  /** Water depth at any x, interpolated between nodes. */
  depthAt(x: number): number {
    const position = clamp(x / columnWidth, 0, NODE_COUNT - 1);
    const index = Math.min(Math.floor(position), NODE_COUNT - 2);
    const t = position - index;
    const a = this.depth[index] ?? 0;
    const b = this.depth[index + 1] ?? 0;
    return a + (b - a) * t;
  }

  hasWaterAt(x: number): boolean {
    return this.depthAt(x) > MIN_DEPTH;
  }

  /**
   * Water surface y at that x. Returns the sand itself when dry, so check
   * hasWaterAt first.
   */
  surfaceYAt(x: number): number {
    return this.terrain.surfaceYAt(x) - this.depthAt(x);
  }

  /**
   * How much swell shows here. A shallow puddle should not have sea waves.
   */
  waveFactorAt(x: number): number {
    return clamp((this.depthAt(x) - 6) / 40, 0, 1);
  }

  /**
   * Water surface including swell, shared by physics and rendering.
   */
  animatedSurfaceYAt(x: number, timeMs: number): number {
    return this.surfaceYAt(x) + waveOffsetAt(x, timeMs) * this.waveFactorAt(x);
  }

  /** Pours water at an x, in px² of cross-section. */
  pour(x: number, amount: number): void {
    const index = Math.round(clamp(x / columnWidth, 0, NODE_COUNT - 1));
    const current = this.depth[index];
    if (current === undefined) return;
    this.depth[index] = current + amount / columnWidth;
  }

  /** Runs once per substep, like the other systems. */
  update(): void {
    this.applySea();
    // Opposite directions: a single sweep skews the puddle before it levels.
    this.flow(1);
    this.flow(-1);
    this.soak();
  }

  reset(): void {
    this.depth.fill(0);
    this.applySea();
  }

  // ------------------------------------------------------------------ internal

  /**
   * Wherever the sand is below sea level, depth is whatever reaches it. This
   * is what fills a freshly dug channel.
   */
  private applySea(): void {
    for (let i = 0; i < NODE_COUNT; i += 1) {
      const ground = this.terrain.heights[i] ?? 0;
      if (ground > WATER.surfaceY) this.depth[i] = ground - WATER.surfaceY;
    }
  }

  /**
   * Passes half the difference in water top between neighbours. Works in
   * height above the world floor, not screen y, to keep the signs readable.
   */
  private flow(direction: 1 | -1): void {
    const from = direction > 0 ? 0 : NODE_COUNT - 2;
    const to = direction > 0 ? NODE_COUNT - 1 : -1;

    for (let i = from; i !== to; i += direction) {
      const depthA = this.depth[i] ?? 0;
      const depthB = this.depth[i + 1] ?? 0;
      if (depthA <= 0 && depthB <= 0) continue;

      const topA = WORLD.height - (this.terrain.heights[i] ?? 0) + depthA;
      const topB = WORLD.height - (this.terrain.heights[i + 1] ?? 0) + depthB;
      const difference = topA - topB;
      if (Math.abs(difference) < 0.01) continue;

      // Never move more water than the giving side actually has.
      const move = clamp(
        (difference / 2) * FLOW_RATE,
        -depthB * FLOW_RATE,
        depthA * FLOW_RATE,
      );

      this.depth[i] = depthA - move;
      this.depth[i + 1] = depthB + move;
    }
  }

  /** Sand drinks puddles slowly. The sea is unaffected. */
  private soak(): void {
    for (let i = 0; i < NODE_COUNT; i += 1) {
      const ground = this.terrain.heights[i] ?? 0;
      if (ground > WATER.surfaceY) continue;

      const current = this.depth[i] ?? 0;
      if (current <= 0) continue;
      this.depth[i] = current <= MIN_DEPTH ? 0 : current - SOAK_RATE;
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
