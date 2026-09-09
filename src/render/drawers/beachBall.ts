
import type { DrawTarget } from './index';
import { BEACH_BALL_RADIUS } from '../../physics/bodies/beachBall';

const PANEL_COLORS = ['#ff5f6d', '#ffffff', '#ffd166', '#ffffff', '#2ec4b6', '#ffffff'] as const;

/**
 * Coloured panels rotate with the body, so its spin is readable. The
 * specular highlight does not, since the light comes from the sun.
 */
export function drawBeachBall(ctx: CanvasRenderingContext2D, { body }: DrawTarget): void {
  const radius = body.circleRadius ?? BEACH_BALL_RADIUS;
  const { x, y } = body.position;

  ctx.save();
  ctx.translate(x, y);

  // Panels, rotating with the body.
  ctx.save();
  ctx.rotate(body.angle);
  const step = (Math.PI * 2) / PANEL_COLORS.length;
  PANEL_COLORS.forEach((color, index) => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, index * step, (index + 1) * step);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  });

  // White cap in the middle.
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = '#fdfdfd';
  ctx.fill();
  ctx.restore();

  // Volume: darken the lower right edge.
  const shade = ctx.createRadialGradient(
    -radius * 0.35,
    -radius * 0.4,
    radius * 0.1,
    0,
    0,
    radius * 1.05,
  );
  shade.addColorStop(0, 'rgba(255,255,255,0.35)');
  shade.addColorStop(0.55, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(20,40,60,0.28)');
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = shade;
  ctx.fill();

  // Soft outline.
  ctx.beginPath();
  ctx.arc(0, 0, radius - 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(40,60,80,0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Specular highlight, fixed in screen space.
  ctx.beginPath();
  ctx.ellipse(-radius * 0.36, -radius * 0.42, radius * 0.24, radius * 0.16, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fill();

  ctx.restore();
}
