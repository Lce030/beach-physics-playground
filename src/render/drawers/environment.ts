import { PALETTE, TERRAIN_GRID, WATER, WORLD } from '../../config/scene';
import type { WaterTable } from '../../physics/WaterTable';
import type { Terrain } from '../../physics/Terrain';

const { columnWidth } = TERRAIN_GRID;

/** Deterministic PRNG, so the sand texture does not flicker between frames. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Grains spread across the whole band where sand can be. They are clipped to
 * the terrain silhouette, so digging needs no recalculation.
 */
const SAND_GRAINS = (() => {
  const random = seededRandom(20240617);
  return Array.from({ length: 460 }, () => ({
    x: random() * WORLD.width,
    y: TERRAIN_GRID.minSurfaceY + random() * (WORLD.height - TERRAIN_GRID.minSurfaceY),
    r: 0.7 + random() * 1.6,
    alpha: 0.06 + random() * 0.12,
  }));
})();

const SHELLS = (() => {
  const random = seededRandom(777);
  return Array.from({ length: 7 }, () => ({
    x: 60 + random() * 560,
    rot: (random() - 0.5) * 1.2,
    size: 3 + random() * 3,
  }));
})();

export function drawSky(ctx: CanvasRenderingContext2D): void {
  const sky = ctx.createLinearGradient(0, 0, 0, WATER.surfaceY);
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(0.55, PALETTE.skyMid);
  sky.addColorStop(1, PALETTE.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  // Sun and halo.
  const sunX = WORLD.width * 0.82;
  const sunY = 110;
  const halo = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 170);
  halo.addColorStop(0, 'rgba(255,246,200,0.85)');
  halo.addColorStop(1, 'rgba(255,246,200,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(sunX - 180, sunY - 180, 360, 360);

  ctx.beginPath();
  ctx.arc(sunX, sunY, 46, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.sun;
  ctx.fill();
}

/**
 * Distant sea behind the beach. Full width, drawn under the sand, so digging
 * cannot expose the straight edge where it used to stop.
 */
export function drawHorizonSea(ctx: CanvasRenderingContext2D): void {
  const band = ctx.createLinearGradient(0, WATER.surfaceY - 26, 0, WATER.surfaceY + 8);
  band.addColorStop(0, 'rgba(70,160,190,0.55)');
  band.addColorStop(1, PALETTE.waterShallow);
  ctx.fillStyle = band;
  ctx.fillRect(0, WATER.surfaceY - 26, WORLD.width, 34);
}

/**
 * Traces the terrain silhouette. Only lineTo: a moveTo in here would split
 * the caller's path in two.
 */
function traceSurface(ctx: CanvasRenderingContext2D, terrain: Terrain, offsetY = 0): void {
  const heights = terrain.heights;
  for (let i = 0; i < heights.length; i += 1) {
    ctx.lineTo(i * columnWidth, (heights[i] ?? 0) + offsetY);
  }
}

export function drawSand(ctx: CanvasRenderingContext2D, terrain: Terrain): void {
  ctx.beginPath();
  ctx.moveTo(0, WORLD.height);
  ctx.lineTo(0, terrain.heights[0] ?? 0);
  traceSurface(ctx, terrain);
  ctx.lineTo(WORLD.width, WORLD.height);
  ctx.closePath();

  const sand = ctx.createLinearGradient(0, TERRAIN_GRID.minSurfaceY, 0, WORLD.height);
  sand.addColorStop(0, PALETTE.sandLight);
  sand.addColorStop(0.45, PALETTE.sandMid);
  sand.addColorStop(1, PALETTE.sandShadow);
  ctx.fillStyle = sand;
  ctx.fill();

  // Clip to the silhouette so the texture stays on the terrain.
  ctx.save();
  ctx.clip();

  // Wet sand fades in from the left and runs to the end of the world. As a
  // fixed-width band its right edge showed up as a line once you dug nearby.
  const shore = terrain.shoreX;
  const wet = ctx.createLinearGradient(shore - 90, 0, shore + 60, 0);
  wet.addColorStop(0, 'rgba(201,167,116,0)');
  wet.addColorStop(1, 'rgba(150,118,80,0.55)');
  ctx.fillStyle = wet;
  ctx.fillRect(shore - 90, 0, WORLD.width - (shore - 90), WORLD.height);

  // Granos.
  for (const grain of SAND_GRAINS) {
    ctx.beginPath();
    ctx.arc(grain.x, grain.y, grain.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(120,92,55,${grain.alpha})`;
    ctx.fill();
  }

  // Shells sit on the current surface, so they follow the sand as it moves.
  for (const shell of SHELLS) {
    ctx.save();
    ctx.translate(shell.x, terrain.surfaceYAt(shell.x) + 3);
    ctx.rotate(shell.rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, shell.size * 1.6, shell.size, 0, Math.PI, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,250,240,0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,160,130,0.9)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();

  // Highlight along the top edge, outside the clip so it shows in full.
  ctx.beginPath();
  ctx.moveTo(0, (terrain.heights[0] ?? 0) + 1.5);
  traceSurface(ctx, terrain, 1.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

/**
 * Contiguous stretches of x with water on them. Taken from the per-column
 * depth, so sea, channel and puddle all come out of the same code.
 */
function waterRuns(water: WaterTable): Array<{ x0: number; x1: number }> {
  const depths = water.depths;
  const runs: Array<{ x0: number; x1: number }> = [];
  let start: number | null = null;

  for (let i = 0; i < depths.length; i += 1) {
    const wet = (depths[i] ?? 0) > 0.35;
    if (wet && start === null) start = Math.max(0, (i - 0.5) * columnWidth);
    else if (!wet && start !== null) {
      runs.push({ x0: start, x1: (i - 0.5) * columnWidth });
      start = null;
    }
  }
  if (start !== null) runs.push({ x0: start, x1: WORLD.width });

  return runs;
}

/**
 * Drawn after the objects and semi-transparent, so anything submerged shows
 * through without masks. Painted per stretch rather than as one rectangle.
 */
export function drawWater(
  ctx: CanvasRenderingContext2D,
  terrain: Terrain,
  water: WaterTable,
  timeMs: number,
): void {
  // Same function buoyancy uses, or objects hover above the crests.
  const surfaceAt = (x: number): number => water.animatedSurfaceYAt(x, timeMs);

  const gradient = ctx.createLinearGradient(0, WATER.surfaceY, 0, WORLD.height);
  gradient.addColorStop(0, 'rgba(126,214,222,0.62)');
  gradient.addColorStop(0.5, 'rgba(50,150,180,0.7)');
  gradient.addColorStop(1, 'rgba(20,90,125,0.8)');

  for (const run of waterRuns(water)) {
    ctx.beginPath();
    ctx.moveTo(run.x0, surfaceAt(run.x0));
    for (let x = run.x0; x < run.x1; x += 12) ctx.lineTo(x, surfaceAt(x));
    ctx.lineTo(run.x1, surfaceAt(run.x1));
    // Back along the bottom, following the terrain.
    for (let x = run.x1; x > run.x0; x -= 12) ctx.lineTo(x, terrain.surfaceYAt(x));
    ctx.lineTo(run.x0, terrain.surfaceYAt(run.x0));
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Glints, clipped to this stretch so they cannot land on dry sand.
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const y = WATER.surfaceY + 16 + i * 26;
      const offset = Math.sin(timeMs * 0.0011 + i) * 40;
      ctx.beginPath();
      ctx.moveTo(run.x0 + 60 + offset + i * 30, y);
      ctx.lineTo(run.x0 + 170 + offset + i * 30, y);
      ctx.stroke();
    }
    ctx.restore();

    // Surface highlight.
    ctx.beginPath();
    ctx.moveTo(run.x0, surfaceAt(run.x0));
    for (let x = run.x0; x <= run.x1; x += 12) ctx.lineTo(x, surfaceAt(x));
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/**
 * Wind streaks. The only visual cue when nothing light is on screen, so they
 * fade in with strength rather than always showing.
 */
export function drawWindStreaks(ctx: CanvasRenderingContext2D, wind: number, timeMs: number): void {
  const strength = Math.abs(wind);
  if (strength < 0.06) return;

  const direction = Math.sign(wind);
  const speed = 0.22 + strength * 0.5;
  const length = 40 + strength * 90;

  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';

  for (let i = 0; i < 7; i += 1) {
    const y = 60 + i * 46 + Math.sin(timeMs * 0.0008 + i) * 8;
    // Each streak crosses the world and reappears on the other side.
    const travel = (timeMs * speed * direction + i * 640) % (WORLD.width + 400);
    const x = direction > 0 ? travel - 200 : WORLD.width + 200 - travel;

    ctx.globalAlpha = 0.1 + strength * 0.16;
    ctx.lineWidth = 1.4 + (i % 3) * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + length * direction, y + Math.sin(i) * 3);
    ctx.stroke();
  }

  ctx.restore();
}

/** Fixed clouds. Deterministic so they do not jitter between frames. */
const CLOUDS = (() => {
  const random = seededRandom(31415);
  return Array.from({ length: 5 }, (_, index) => ({
    x: 90 + index * 250 + random() * 90,
    y: 70 + random() * 110,
    scale: 0.65 + random() * 0.75,
    /** How much it shifts with the mouse. */
    depth: 0.25 + random() * 0.75,
  }));
})();

/**
 * Parallax clouds. The offset is measured from the centre of the world in
 * world units, so the effect is the same at any canvas size.
 */
export function drawClouds(
  ctx: CanvasRenderingContext2D,
  pointer: { x: number; y: number } | null,
): void {
  const offsetX = pointer ? (pointer.x - WORLD.width / 2) / WORLD.width : 0;
  const offsetY = pointer ? (pointer.y - WORLD.height / 2) / WORLD.height : 0;

  ctx.save();
  for (const cloud of CLOUDS) {
    const x = cloud.x - offsetX * 46 * cloud.depth;
    const y = cloud.y - offsetY * 16 * cloud.depth;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(cloud.scale, cloud.scale);
    ctx.globalAlpha = 0.55 + cloud.depth * 0.3;
    ctx.fillStyle = '#ffffff';

    // Three lumps and a base.
    ctx.beginPath();
    ctx.arc(-32, 6, 22, 0, Math.PI * 2);
    ctx.arc(-4, -8, 30, 0, Math.PI * 2);
    ctx.arc(30, 4, 24, 0, Math.PI * 2);
    ctx.ellipse(0, 16, 56, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
  ctx.restore();
}

/**
 * Foam where water meets sand. Placed on the edge of every water stretch, so
 * a dug puddle gets it as much as the sea.
 */
export function drawFoam(ctx: CanvasRenderingContext2D, water: WaterTable, timeMs: number): void {
  ctx.save();
  ctx.fillStyle = '#ffffff';

  for (const run of waterRuns(water)) {
    for (const edge of [run.x0, run.x1]) {
      // The last stretch ends at the world frame, not at a shore.
      if (edge >= WORLD.width - 1) continue;

      for (let i = 0; i < 9; i += 1) {
        const spread = (i / 8 - 0.5) * 96;
        const x = edge + spread;
        const phase = timeMs * 0.0026 + i * 1.7 + edge * 0.03;
        const life = (Math.sin(phase) + 1) / 2;
        if (life < 0.18) continue;

        const y = water.animatedSurfaceYAt(x, timeMs) + Math.sin(phase * 1.3) * 3;
        const radius = (1.6 + life * 4.4) * (1 - Math.abs(spread) / 70);
        if (radius <= 0.4) continue;

        ctx.globalAlpha = 0.16 + life * 0.45;
        ctx.beginPath();
        ctx.ellipse(x, y, radius, radius * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}
