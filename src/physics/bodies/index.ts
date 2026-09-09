import type { Body, Constraint } from 'matter-js';

import type { ObjectKind } from '../types';
import { BEACH_BALL_RADIUS, createBeachBall } from './beachBall';
import { COCONUT_RADIUS, createCoconut } from './coconut';
import { CRAB, createCrab } from './crab';
import { BUCKET_CAPACITY, BUCKET_HALF_WIDTH, createMetalBucket } from './metalBucket';
import { SURFBOARD, createSurfboard } from './surfboard';
import { UMBRELLA, createUmbrella } from './umbrella';

/**
 * What a blueprint produces. Most objects are a single body; a crab is
 * several joined by constraints.
 */
export interface BodyAssembly {
  /** Main body: drives position, angle and grabbing. */
  readonly body: Body;
  /** Loose bodies joined by constraints, such as legs. */
  readonly extraBodies?: readonly Body[];
  readonly constraints?: readonly Constraint[];
  /** Planted objects only: distance from centre of mass to the tip. */
  readonly footOffsetY?: number;
}

/**
 * floatFraction is how much of the object sits submerged at rest. Above 1 it
 * cannot displace enough water and sinks.
 */
export interface WaterProfile {
  readonly floatFraction: number;
  /** frictionAir when fully submerged: how thick the water feels. */
  readonly drag: number;
}

/** What an object needs in order to hold water. */
export interface ContainerProfile {
  /** How much water fits, in px² of cross-section. */
  readonly capacity: number;
  /**
   * Tilt at which it starts spilling, full and empty. Interpolated by fill
   * level, so tilting sheds the excess and settles.
   */
  readonly spillAngleFull: number;
  readonly spillAngleEmpty: number;
  /** Density of the water it carries, for the extra weight. */
  readonly contentDensity: number;
  /** Fill and empty rate, in px² per millisecond. */
  readonly flowRate: number;
}

/**
 * Joint limit for constraint-linked parts. Matter has none, so a hard push
 * flips a part over and it stays there.
 */
export interface ArticulationProfile {
  /** Maximum rotation of a part relative to the main body, in radians. */
  readonly maxRelativeAngle: number;
}

/** Objects planted in the sand, such as the umbrella. */
export interface PlantedProfile {
  /**
   * Stiffness of the two anchors. Lower values sway more.
   */
  readonly rootStiffness: number;
  /** Gap between the two anchors, in px. Wider is stiffer. */
  readonly rootSpread: number;
  /**
   * How far the anchor may drift before tearing out. The "being pulled" signal.
   */
  readonly uprootStretch: number;
  /**
   * Relative speed of an impact that knocks it loose. Separate from stretch
   * because rigid anchors barely stretch under a hit.
   */
  readonly uprootImpact: number;
  /** Pixels of sand that must be removed underneath to unseat it. */
  readonly uprootDig: number;
}

/**
 * Everything the app needs about an object type. The palette and the renderer
 * derive from this, never from a duplicated list.
 */
export interface BodyBlueprint {
  readonly kind: ObjectKind;
  readonly label: string;
  readonly hint: string;
  /** Rough radius, only for the drag preview. */
  readonly previewRadius: number;
  readonly water: WaterProfile;
  readonly container?: ContainerProfile;
  readonly planted?: PlantedProfile;
  readonly articulation?: ArticulationProfile;
  create(x: number, y: number): BodyAssembly;
}

export const BLUEPRINTS: Record<ObjectKind, BodyBlueprint> = {
  beachBall: {
    kind: 'beachBall',
    label: 'Beach ball',
    hint: 'Light · floats high',
    previewRadius: BEACH_BALL_RADIUS,
    water: { floatFraction: 0.22, drag: 0.12 },
    create: (x, y) => ({ body: createBeachBall(x, y) }),
  },
  coconut: {
    kind: 'coconut',
    label: 'Coconut',
    hint: 'Dense · floats half submerged',
    previewRadius: COCONUT_RADIUS,
    water: { floatFraction: 0.58, drag: 0.16 },
    create: (x, y) => ({ body: createCoconut(x, y) }),
  },
  metalBucket: {
    kind: 'metalBucket',
    label: 'Metal bucket',
    hint: 'Sinks · scoops water',
    previewRadius: BUCKET_HALF_WIDTH,
    water: { floatFraction: 1.9, drag: 0.3 },
    container: {
      capacity: BUCKET_CAPACITY,
      spillAngleFull: 0.55,
      spillAngleEmpty: 1.35,
      contentDensity: 0.0022,
      flowRate: 3.2,
    },
    // The handle swings, but cannot fold flat across the mouth.
    articulation: { maxRelativeAngle: 0.85 },
    create: createMetalBucket,
  },
  surfboard: {
    kind: 'surfboard',
    label: 'Surfboard',
    hint: 'Floats flat · catches the wind',
    previewRadius: SURFBOARD.length / 2,
    water: { floatFraction: 0.26, drag: 0.15 },
    create: (x, y) => ({ body: createSurfboard(x, y) }),
  },
  umbrella: {
    kind: 'umbrella',
    label: 'Umbrella',
    hint: 'Planted · falls if knocked over',
    previewRadius: UMBRELLA.canopyRadius,
    water: { floatFraction: 0.45, drag: 0.2 },
    planted: {
      rootStiffness: 0.18,
      rootSpread: 8,
      uprootStretch: 14,
      uprootImpact: 9,
      uprootDig: 26,
    },
    create: createUmbrella,
  },
  crab: {
    kind: 'crab',
    label: 'Crab',
    hint: 'Articulated legs',
    previewRadius: CRAB.shellWidth / 2,
    water: { floatFraction: 0.7, drag: 0.22 },
    // Legs bend a long way, but never tumble right over.
    articulation: { maxRelativeAngle: 1.3 },
    create: createCrab,
  },
};

export const BLUEPRINT_LIST: readonly BodyBlueprint[] = Object.values(BLUEPRINTS);
