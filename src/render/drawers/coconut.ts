
import type { DrawTarget } from './index';
import { COCONUT_RADIUS } from '../../physics/bodies/coconut';

/** Fibrous brown shell with the three eyes, rotating with the body. */
export function drawCoconut(ctx: CanvasRenderingContext2D, { body }: DrawTarget): void {
  const radius = body.circleRadius ?? COCONUT_RADIUS;

  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);

  const shell = ctx.createRadialGradient(
    -radius * 0.3,
    -radius * 0.35,
    radius * 0.15,
    0,
    0,
    radius * 1.1,
  );
  shell.addColorStop(0, '#a9784c');
  shell.addColorStop(0.6, '#7c5433');
  shell.addColorStop(1, '#4d3220');
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = shell;
  ctx.fill();

  // Fibres, following the grain.
  ctx.strokeStyle = 'rgba(60,38,22,0.35)';
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 5; i += 1) {
    const offset = -radius * 0.6 + (i * radius * 1.2) / 4;
    ctx.beginPath();
    ctx.moveTo(offset, -radius * 0.92);
    ctx.quadraticCurveTo(offset * 1.6, 0, offset, radius * 0.92);
    ctx.stroke();
  }

  // The three eyes.
  ctx.fillStyle = 'rgba(45,28,16,0.85)';
  const eyes: Array<[number, number]> = [
    [-radius * 0.3, -radius * 0.42],
    [radius * 0.28, -radius * 0.44],
    [0, -radius * 0.12],
  ];
  for (const [ex, ey] of eyes) {
    ctx.beginPath();
    ctx.arc(ex, ey, radius * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Specular highlight, fixed in screen space.
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.beginPath();
  ctx.ellipse(-radius * 0.34, -radius * 0.4, radius * 0.26, radius * 0.15, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,240,220,0.32)';
  ctx.fill();
  ctx.restore();
}
