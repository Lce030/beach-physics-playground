/**
 * Scene geometry and constants, in world units.
 *
 * The world has a fixed logical size (1280x720). The canvas is scaled to fit
 * its container, but physics always runs in these units so the simulation
 * behaves identically on any screen.
 */

export const WORLD = {
  width: 1280,
  height: 720,
} as const;

/**
 * Terrain profile, seen from the side.
 *
 *   dry beach            ramp            seabed
 *  ───────────────\
 *   (sandTopY)     \____
 *                        (seabedY) ──────────────
 *
 * The waterline crosses the ramp; that crossing is the shore.
 */
export const TERRAIN = {
  sandTopY: 495,
  rampStartX: 700,
  rampEndX: 880,
  seabedY: 615,
} as const;

/** Sea level. */
export const WATER = {
  surfaceY: 540,
} as const;

/** Cap on simultaneous objects. */
export const MAX_BODIES = 40;

/** Fixed simulation step: 60 Hz. Never variable. */
export const FIXED_TIMESTEP_MS = 1000 / 60;
/** Max substeps per frame, so a slow machine cannot block the thread. */
export const MAX_SUBSTEPS = 5;

export const PALETTE = {
  skyTop: '#3f7fd4',
  skyMid: '#7fc4e8',
  skyBottom: '#d9f0f7',
  sun: '#fff3c4',
  sandLight: '#f3dfae',
  sandMid: '#e6c98c',
  sandShadow: '#cfae6f',
  wetSand: '#c9a774',
  waterDeep: '#1d6f93',
  waterShallow: '#54b6c9',
  waterSurface: '#8fdfe6',
  foam: '#ffffff',
} as const;

/**
 * Diggable terrain: a heightmap sampled every `columnWidth` px. Physics is
 * rebuilt only for the columns that change.
 *
 * One height per column means relief but no tunnels or caves.
 */
export const TERRAIN_GRID = {
  columnWidth: 16,
  minSurfaceY: 200,
  maxSurfaceY: WORLD.height - 45,
  /** Steepest stable slope for dry sand (~35°); above it the pile collapses. */
  reposeSlope: 0.72,
  /** How much of the excess slope is corrected per substep. */
  settleRate: 0.35,
} as const;

/** The shovel: a round brush that moves sand from one place to another. */
export const SHOVEL = {
  radius: 54,
  /** Terrain pixels moved per millisecond at the centre of the brush. */
  speed: 0.14,
  /** How much sand fits in the shovel, in px² of cross-section. */
  capacity: 24000,
} as const;

/**
 * Wind. `strength` runs from -1 (out to sea) to 1 (towards the beach).
 *
 * The push is computed from frontal area and applied as a force rather than an
 * acceleration, so mass enters the equation on its own: a beach ball flies and
 * a metal bucket does not budge, with no per-type exceptions.
 */
export const WIND = {
  /** Force per pixel of frontal area and unit of wind. */
  force: 0.0000042,
  /** How far above the centre the push lands, as a fraction of body height. */
  leverage: 0.3,
  gustSpeed: 0.00022,
} as const;
