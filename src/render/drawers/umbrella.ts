import type { Body } from 'matter-js';

import type { DrawTarget } from './index';
import { UMBRELLA } from '../../physics/bodies/umbrella';

const PANEL_COLORS = ['#ef5350', '#fdfdfd', '#ef5350', '#fdfdfd', '#ef5350', '#fdfdfd'] as const;

/**
 * Drawn from the same measurements the body was built with, so the canopy and
 * mast on screen are the two parts that actually collide.
 */
export function drawUmbrella(ctx: CanvasRenderingContext2D, { body }: DrawTarget): void {
  const { mastHeight, mastWidth, canopyRadius, canopyHeight } = UMBRELLA;

  // The body sits on its centre of mass; draw relative to the planted tip.
  const foot = footOffset(body);

  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);
  ctx.translate(0, foot);

  // Mast.
  const pole = ctx.createLinearGradient(-mastWidth / 2, 0, mastWidth / 2, 0);
  pole.addColorStop(0, '#8d6e4f');
  pole.addColorStop(0.4, '#c8a479');
  pole.addColorStop(1, '#7a5c40');
  ctx.fillStyle = pole;
  ctx.fillRect(-mastWidth / 2, -mastHeight, mastWidth, mastHeight);

  // Canopy panels.
  const canopyCenterY = -mastHeight + canopyHeight;
  const segments = PANEL_COLORS.length;
  for (let i = 0; i < segments; i += 1) {
    const from = Math.PI + (i / segments) * Math.PI;
    const to = Math.PI + ((i + 1) / segments) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(0, canopyCenterY);
    ctx.ellipse(0, canopyCenterY, canopyRadius, canopyHeight, 0, from, to);
    ctx.closePath();
    ctx.fillStyle = PANEL_COLORS[i] ?? '#ef5350';
    ctx.fill();
  }

  // Inner shading, for volume.
  const shade = ctx.createLinearGradient(0, canopyCenterY - canopyHeight, 0, canopyCenterY);
  shade.addColorStop(0, 'rgba(255,255,255,0.28)');
  shade.addColorStop(1, 'rgba(30,50,70,0.18)');
  ctx.beginPath();
  ctx.ellipse(0, canopyCenterY, canopyRadius, canopyHeight, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = shade;
  ctx.fill();

  // Scalloped edge.
  ctx.beginPath();
  ctx.moveTo(-canopyRadius, canopyCenterY);
  for (let i = 0; i < 6; i += 1) {
    const x0 = -canopyRadius + (i * canopyRadius * 2) / 6;
    const x1 = -canopyRadius + ((i + 1) * canopyRadius * 2) / 6;
    ctx.quadraticCurveTo((x0 + x1) / 2, canopyCenterY + 7, x1, canopyCenterY);
  }
  ctx.strokeStyle = 'rgba(120,40,40,0.55)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Finial.
  ctx.beginPath();
  ctx.arc(0, canopyCenterY - canopyHeight - 2, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#8d6e4f';
  ctx.fill();

  ctx.restore();
}

/**
 * Local distance from the centre of mass to the planted tip. Taken from the
 * body rather than hard-coded, since a compound centre of mass shifts with the
 * densities of its parts.
 */
function footOffset(body: Body): number {
  const mast = body.parts.length > 1 ? body.parts[1] : body;
  if (!mast) return UMBRELLA.mastHeight / 2;

  const dx = mast.position.x - body.position.x;
  const dy = mast.position.y - body.position.y;
  // Undo the body rotation to get the local offset.
  const localY = -dx * Math.sin(body.angle) + dy * Math.cos(body.angle);
  return localY + UMBRELLA.mastHeight / 2;
}
