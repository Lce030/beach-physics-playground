import type { Body } from 'matter-js';

import type { ObjectKind } from '../../physics/types';
import { drawBeachBall } from './beachBall';
import { drawCoconut } from './coconut';
import { drawCrab } from './crab';
import { drawMetalBucket } from './metalBucket';
import { drawSurfboard } from './surfboard';
import { drawUmbrella } from './umbrella';

/**
 * The minimum a drawer needs. Not just a body: the crab keeps its legs as
 * separate bodies. A SceneObject satisfies this as-is.
 */
export interface DrawTarget {
  readonly body: Body;
  readonly extraBodies: readonly Body[];
}

/**
 * Draws one object in world coordinates. Matter bodies are read-only here:
 * physics never picks colours and rendering never moves a body.
 */
export type ObjectDrawer = (
  ctx: CanvasRenderingContext2D,
  target: DrawTarget,
  timeMs: number,
) => void;

export const DRAWERS: Record<ObjectKind, ObjectDrawer> = {
  beachBall: drawBeachBall,
  coconut: drawCoconut,
  metalBucket: drawMetalBucket,
  surfboard: drawSurfboard,
  umbrella: drawUmbrella,
  crab: drawCrab,
};
