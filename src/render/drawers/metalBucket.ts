import type { Body } from 'matter-js';
import type { DrawTarget } from './index';
import {
  BUCKET_CAPACITY,
  BUCKET_HALF_HEIGHT,
  BUCKET_HANDLE,
  BUCKET_HALF_WIDTH,
} from '../../physics/bodies/metalBucket';
import { readPlugin } from '../../physics/types';

const TOP = -BUCKET_HALF_HEIGHT;
const BOTTOM = BUCKET_HALF_HEIGHT;
const TOP_HALF = BUCKET_HALF_WIDTH;
const BOTTOM_HALF = BUCKET_HALF_WIDTH * 0.72;

/** Inner face of the pail, inset by the wall thickness. */
const INTERIOR = [
  { x: -TOP_HALF + 3, y: TOP + 1 },
  { x: TOP_HALF - 3, y: TOP + 1 },
  { x: BOTTOM_HALF - 3, y: BOTTOM - 3 },
  { x: -BOTTOM_HALF + 3, y: BOTTOM - 3 },
] as const;

/**
 * Water inside the bucket. The surface has to stay horizontal however the
 * bucket is tilted, so the clip rotates with the body and the fill does not.
 *
 * Called with the context already translated and rotated.
 */
function drawContents(ctx: CanvasRenderingContext2D, body: Body): void {
  const plugin = readPlugin(body);
  if (!plugin || plugin.contents <= 0) return;

  const fill = Math.min(1, plugin.contents / BUCKET_CAPACITY);
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);

  // Vertical extent of the rotated interior; the level moves between them.
  let top = Infinity;
  let bottom = -Infinity;
  for (const point of INTERIOR) {
    const y = point.x * sin + point.y * cos;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }
  const level = bottom - fill * (bottom - top);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(INTERIOR[0].x, INTERIOR[0].y);
  for (const point of INTERIOR.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.clip();

  ctx.rotate(-body.angle);
  ctx.fillStyle = 'rgba(72,168,196,0.85)';
  ctx.fillRect(-60, level, 120, 140);
  ctx.beginPath();
  ctx.moveTo(-60, level);
  ctx.lineTo(60, level);
  ctx.strokeStyle = 'rgba(210,247,255,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/**
 * Galvanised bucket, drawn with the same trapezoid the body uses.
 */
export function drawMetalBucket(
  ctx: CanvasRenderingContext2D,
  { body, extraBodies }: DrawTarget,
): void {
  const handle = extraBodies[0];
  if (handle) drawHandle(ctx, body, handle);

  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);

  // Pail.
  ctx.beginPath();
  ctx.moveTo(-TOP_HALF, TOP);
  ctx.lineTo(TOP_HALF, TOP);
  ctx.lineTo(BOTTOM_HALF, BOTTOM);
  ctx.lineTo(-BOTTOM_HALF, BOTTOM);
  ctx.closePath();

  const metal = ctx.createLinearGradient(-TOP_HALF, 0, TOP_HALF, 0);
  metal.addColorStop(0, '#8c99a6');
  metal.addColorStop(0.28, '#d7dee5');
  metal.addColorStop(0.55, '#a8b4c0');
  metal.addColorStop(1, '#6f7c89');
  ctx.fillStyle = metal;
  ctx.fill();
  ctx.strokeStyle = 'rgba(45,60,75,0.55)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  drawContents(ctx, body);

  // Horizontal ribs.
  ctx.strokeStyle = 'rgba(70,88,105,0.35)';
  ctx.lineWidth = 1.2;
  for (const t of [0.35, 0.68]) {
    const y = TOP + (BOTTOM - TOP) * t;
    const half = TOP_HALF + (BOTTOM_HALF - TOP_HALF) * t;
    ctx.beginPath();
    ctx.moveTo(-half, y);
    ctx.lineTo(half, y);
    ctx.stroke();
  }

  // Rim ellipse, kept inside the polygon. Matter only grabs a body when the
  // click is within its vertices, so anything drawn outside is dead to the
  // mouse.
  ctx.beginPath();
  ctx.ellipse(0, TOP + 5, TOP_HALF * 0.99, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#5d6a77';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, TOP + 5, TOP_HALF * 0.85, 3.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#3f4a55';
  ctx.fill();

  ctx.restore();
}

/** A local point on a body, in world coordinates. */
function toWorld(body: Body, localX: number, localY: number): { x: number; y: number } {
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);
  return {
    x: body.position.x + localX * cos - localY * sin,
    y: body.position.y + localX * sin + localY * cos,
  };
}

/**
 * The handle, drawn between the two rim rivets and the ends of the articulated
 * bar, so it nods with the real body rather than being pinned to the pail.
 */
function drawHandle(ctx: CanvasRenderingContext2D, shell: Body, handle: Body): void {
  const { halfSpan, thickness } = BUCKET_HANDLE;
  const rivetY = -BUCKET_HALF_HEIGHT + 2;

  const leftRivet = toWorld(shell, -halfSpan, rivetY);
  const rightRivet = toWorld(shell, halfSpan, rivetY);
  const leftTop = toWorld(handle, -halfSpan, 0);
  const rightTop = toWorld(handle, halfSpan, 0);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(leftRivet.x, leftRivet.y);
  ctx.quadraticCurveTo(leftTop.x, leftTop.y, (leftTop.x + rightTop.x) / 2, (leftTop.y + rightTop.y) / 2);
  ctx.quadraticCurveTo(rightTop.x, rightTop.y, rightRivet.x, rightRivet.y);
  ctx.strokeStyle = '#7e8b98';
  ctx.lineWidth = thickness;
  ctx.stroke();

  // Metal highlight.
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = thickness * 0.35;
  ctx.stroke();

  // Rivets.
  for (const rivet of [leftRivet, rightRivet]) {
    ctx.beginPath();
    ctx.arc(rivet.x, rivet.y, thickness * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = '#5d6a77';
    ctx.fill();
  }

  ctx.restore();
}
