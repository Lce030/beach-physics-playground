import { Body, Composite, Vertices, type Composite as MatterComposite } from 'matter-js';

import { SHOVEL, TERRAIN_GRID, WATER, WORLD } from '../config/scene';
import { initialSurfaceYAt } from '../config/terrain';

export type PaintMode = 'dig' | 'fill';

const { columnWidth, minSurfaceY, maxSurfaceY, reposeSlope, settleRate } = TERRAIN_GRID;

/** Column (body) and node (height) counts. There is one more node than columns. */
export const COLUMN_COUNT = Math.round(WORLD.width / columnWidth);
export const NODE_COUNT = COLUMN_COUNT + 1;

/** How far down each column reaches. Off-screen, so never seen. */
const COLUMN_BOTTOM = WORLD.height + 80;

const COLUMN_OPTIONS = {
  isStatic: true,
  friction: 0.92,
  frictionStatic: 1,
  restitution: 0.05,
  label: 'terrain',
};

/**
 * Diggable terrain as a heightmap. nodes[i] is the surface y at
 * x = i * columnWidth, and each column is one static quad spanning two nodes,
 * so the drawn surface and the colliding one are the same line.
 *
 * Digging rebuilds only the columns that changed. One height per column means
 * relief but no tunnels.
 */
export class Terrain {
  private readonly nodes = new Float64Array(NODE_COUNT);
  private readonly bodies: Array<Body | null> = new Array<Body | null>(COLUMN_COUNT).fill(null);
  private readonly dirty = new Set<number>();

  /** Sand the shovel is carrying, in px² of cross-section. */
  private carriedSand = 0;

  constructor(private readonly world: MatterComposite) {
    this.reset();
  }

  // --------------------------------------------------------------------- state

  /** Heights for rendering. Read-only: the renderer never moves terrain. */
  get heights(): Readonly<Float64Array> {
    return this.nodes;
  }

  get carried(): number {
    return this.carriedSand;
  }

  get carriedRatio(): number {
    return this.carriedSand / SHOVEL.capacity;
  }

  /** Surface y at any x, interpolated between nodes. */
  surfaceYAt(x: number): number {
    const position = clamp(x / columnWidth, 0, COLUMN_COUNT);
    const index = Math.min(Math.floor(position), COLUMN_COUNT - 1);
    const t = position - index;
    const a = this.nodes[index] ?? maxSurfaceY;
    const b = this.nodes[index + 1] ?? maxSurfaceY;
    return a + (b - a) * t;
  }

  /** Is the sand at this x below sea level? */
  hasWaterAt(x: number): boolean {
    return this.surfaceYAt(x) > WATER.surfaceY;
  }

  /**
   * Left edge of the submerged stretch reaching the right side of the world.
   * Searched from the right so a dug puddle is not mistaken for the shore.
   */
  get shoreX(): number {
    let i = NODE_COUNT - 1;
    if ((this.nodes[i] ?? 0) <= WATER.surfaceY) return WORLD.width;
    while (i > 0 && (this.nodes[i - 1] ?? 0) > WATER.surfaceY) i -= 1;
    return i * columnWidth;
  }

  // -------------------------------------------------------------------- edits

  /**
   * Moves sand with the shovel. The cursor y sets the target depth, and sand
   * is conserved: only what the shovel holds can be dropped again.
   */
  paint(mode: PaintMode, x: number, y: number, deltaMs: number): number {
    const step = SHOVEL.speed * Math.min(deltaMs, 50);
    const radius = SHOVEL.radius;
    const first = Math.max(0, Math.ceil((x - radius) / columnWidth));
    const last = Math.min(NODE_COUNT - 1, Math.floor((x + radius) / columnWidth));

    let moved = 0;

    for (let i = first; i <= last; i += 1) {
      const height = this.nodes[i];
      if (height === undefined) continue;

      const normalized = (i * columnWidth - x) / radius;
      const falloff = 1 - normalized * normalized;
      if (falloff <= 0) continue;

      const budget = step * falloff;
      let delta: number;

      if (mode === 'dig') {
        // The cursor has to be inside the sand to dig.
        const target = Math.min(y, maxSurfaceY);
        if (target <= height) continue;
        const room = (SHOVEL.capacity - this.carriedSand) / columnWidth;
        if (room <= 0) break;
        delta = Math.min(target - height, budget, room);
        this.nodes[i] = height + delta;
        this.carriedSand += delta * columnWidth;
      } else {
        const target = Math.max(y, minSurfaceY);
        if (target >= height) continue;
        const available = this.carriedSand / columnWidth;
        if (available <= 0) break;
        delta = Math.min(height - target, budget, available);
        this.nodes[i] = height - delta;
        this.carriedSand -= delta * columnWidth;
      }

      moved += delta * columnWidth;
      this.markNodeDirty(i);
    }

    this.carriedSand = clamp(this.carriedSand, 0, SHOVEL.capacity);
    return moved;
  }

  /**
   * Angle of repose: neighbours differing by more than dry sand holds collapse
   * into the gap. An exchange, so the total is preserved.
   */
  settle(): void {
    const maxDrop = columnWidth * reposeSlope;

    for (let i = 0; i < COLUMN_COUNT; i += 1) {
      const left = this.nodes[i];
      const right = this.nodes[i + 1];
      if (left === undefined || right === undefined) continue;

      const difference = left - right;
      if (Math.abs(difference) <= maxDrop) continue;

      // Half the excess each way, damped so the collapse is visible.
      const move = (Math.abs(difference) - maxDrop) * settleRate * 0.5;
      if (difference > 0) {
        // The left node sits lower, so sand slides into it from the right.
        this.nodes[i] = left - move;
        this.nodes[i + 1] = right + move;
      } else {
        this.nodes[i] = left + move;
        this.nodes[i + 1] = right - move;
      }

      this.markNodeDirty(i);
      this.markNodeDirty(i + 1);
    }
  }

  /** Rebuilds only the bodies of the columns that changed. */
  rebuildDirty(): void {
    if (this.dirty.size === 0) return;

    for (const column of this.dirty) {
      const previous = this.bodies[column];
      if (previous) Composite.remove(this.world, previous, true);

      const body = this.createColumnBody(column);
      this.bodies[column] = body;
      Composite.add(this.world, body);
    }

    this.dirty.clear();
  }

  /** Restores the starting profile and empties the shovel. */
  reset(): void {
    for (let i = 0; i < NODE_COUNT; i += 1) {
      this.nodes[i] = clamp(initialSurfaceYAt(i * columnWidth), minSurfaceY, maxSurfaceY);
    }
    this.carriedSand = 0;
    for (let column = 0; column < COLUMN_COUNT; column += 1) this.dirty.add(column);
    this.rebuildDirty();
  }

  // ------------------------------------------------------------------ internal

  private markNodeDirty(node: number): void {
    if (node > 0) this.dirty.add(node - 1);
    if (node < COLUMN_COUNT) this.dirty.add(node);
  }

  /**
   * One column quad, clockwise as Matter expects. Absolute vertices with
   * position set to their centroid, which is where setVertices puts them back.
   */
  private createColumnBody(column: number): Body {
    const x0 = column * columnWidth;
    const x1 = x0 + columnWidth;
    const vertices = [
      { x: x0, y: this.nodes[column] ?? maxSurfaceY },
      { x: x1, y: this.nodes[column + 1] ?? maxSurfaceY },
      { x: x1, y: COLUMN_BOTTOM },
      { x: x0, y: COLUMN_BOTTOM },
    ];

    return Body.create({
      ...COLUMN_OPTIONS,
      position: Vertices.centre(vertices),
      vertices,
    });
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
