import type { DrawTarget } from './index';
import { SURFBOARD } from '../../physics/bodies/surfboard';

const HALF_LENGTH = SURFBOARD.length / 2;
const HALF_WIDTH = SURFBOARD.width / 2;

/**
 * Capsule outline matching the body, plus the stripe and the fin.
 */
export function drawSurfboard(ctx: CanvasRenderingContext2D, { body }: DrawTarget): void {
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);

  const outline = (): void => {
    ctx.beginPath();
    ctx.moveTo(-HALF_LENGTH + HALF_WIDTH, -HALF_WIDTH);
    ctx.lineTo(HALF_LENGTH - HALF_WIDTH, -HALF_WIDTH);
    ctx.arc(HALF_LENGTH - HALF_WIDTH, 0, HALF_WIDTH, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(-HALF_LENGTH + HALF_WIDTH, HALF_WIDTH);
    ctx.arc(-HALF_LENGTH + HALF_WIDTH, 0, HALF_WIDTH, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
  };

  // Fin, behind the board.
  ctx.beginPath();
  ctx.moveTo(-HALF_LENGTH * 0.62, HALF_WIDTH - 2);
  ctx.lineTo(-HALF_LENGTH * 0.72, HALF_WIDTH + 13);
  ctx.lineTo(-HALF_LENGTH * 0.5, HALF_WIDTH - 1);
  ctx.closePath();
  ctx.fillStyle = '#3f6f86';
  ctx.fill();

  outline();
  const board = ctx.createLinearGradient(0, -HALF_WIDTH, 0, HALF_WIDTH);
  board.addColorStop(0, '#fdfbf4');
  board.addColorStop(0.55, '#f0e7d2');
  board.addColorStop(1, '#cbbb9c');
  ctx.fillStyle = board;
  ctx.fill();
  ctx.strokeStyle = 'rgba(80,70,50,0.4)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Stripe and bands, clipped to the outline.
  ctx.save();
  outline();
  ctx.clip();
  ctx.fillStyle = '#ef6f5e';
  ctx.fillRect(-HALF_LENGTH, -3.2, SURFBOARD.length, 6.4);
  ctx.fillStyle = '#2fa8b8';
  for (const offset of [-0.5, -0.34]) {
    ctx.fillRect(HALF_LENGTH * offset, -HALF_WIDTH, 7, SURFBOARD.width);
  }
  ctx.restore();

  // Resin highlight.
  ctx.beginPath();
  ctx.ellipse(HALF_LENGTH * 0.18, -HALF_WIDTH * 0.45, HALF_LENGTH * 0.3, 2.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();

  ctx.restore();
}
