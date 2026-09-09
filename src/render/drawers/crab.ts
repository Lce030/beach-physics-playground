import type { Body } from 'matter-js';

import type { DrawTarget } from './index';
import { CRAB } from '../../physics/bodies/crab';

const SHELL = '#e2603c';
const SHELL_DARK = '#b8462a';

/**
 * Each leg is drawn where its body actually is, not in a scripted pose. That
 * is all the animation there is.
 */
export function drawCrab(ctx: CanvasRenderingContext2D, { body, extraBodies }: DrawTarget): void {
  for (const [index, leg] of extraBodies.entries()) {
    drawLeg(ctx, leg, index === 0 || index === extraBodies.length - 1);
  }
  drawShell(ctx, body);
}

function drawLeg(ctx: CanvasRenderingContext2D, leg: Body, isClaw: boolean): void {
  const { legLength, legThickness } = CRAB;

  ctx.save();
  ctx.translate(leg.position.x, leg.position.y);
  ctx.rotate(leg.angle);

  ctx.beginPath();
  ctx.roundRect?.(-legThickness / 2, -legLength / 2, legThickness, legLength, legThickness / 2);
  if (!ctx.roundRect) ctx.rect(-legThickness / 2, -legLength / 2, legThickness, legLength);
  ctx.fillStyle = SHELL_DARK;
  ctx.fill();

  // The outer legs carry the claws.
  if (isClaw) {
    ctx.beginPath();
    ctx.ellipse(0, legLength / 2, legThickness * 1.5, legThickness * 1.9, 0, 0, Math.PI * 2);
    ctx.fillStyle = SHELL;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-legThickness * 1.2, legLength / 2 + legThickness * 1.4);
    ctx.lineTo(0, legLength / 2 + legThickness * 0.2);
    ctx.lineTo(legThickness * 1.2, legLength / 2 + legThickness * 1.4);
    ctx.strokeStyle = SHELL_DARK;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  ctx.restore();
}

function drawShell(ctx: CanvasRenderingContext2D, body: Body): void {
  const { shellWidth, shellHeight } = CRAB;

  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);

  // Shell: the same chamfered rectangle as the body.
  ctx.beginPath();
  ctx.roundRect?.(-shellWidth / 2, -shellHeight / 2, shellWidth, shellHeight, 11);
  if (!ctx.roundRect) ctx.rect(-shellWidth / 2, -shellHeight / 2, shellWidth, shellHeight);
  const shell = ctx.createLinearGradient(0, -shellHeight / 2, 0, shellHeight / 2);
  shell.addColorStop(0, '#f4805c');
  shell.addColorStop(0.55, SHELL);
  shell.addColorStop(1, SHELL_DARK);
  ctx.fillStyle = shell;
  ctx.fill();
  ctx.strokeStyle = 'rgba(110,40,20,0.5)';
  ctx.lineWidth = 1.3;
  ctx.stroke();

  // Eyes, pupils low so it looks at the ground.
  for (const side of [-1, 1]) {
    const eyeX = side * shellWidth * 0.19;
    const eyeY = -shellHeight * 0.22;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 4.4, 0, Math.PI * 2);
    ctx.fillStyle = '#fffdf8';
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,40,20,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(eyeX, eyeY + 1.2, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#2b1a12';
    ctx.fill();
  }

  // Shell highlight.
  ctx.beginPath();
  ctx.ellipse(-shellWidth * 0.16, -shellHeight * 0.3, shellWidth * 0.2, 3, -0.25, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fill();

  ctx.restore();
}
