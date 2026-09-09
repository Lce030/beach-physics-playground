import { BLUEPRINTS } from '../physics/bodies';
import type { ObjectKind } from '../physics/types';
import { DRAWERS } from './drawers';

/**
 * Palette thumbnail. Reuses the scene drawer against a throwaway body that
 * never enters the world, so the palette cannot drift from the real look.
 */
export function renderThumbnail(canvas: HTMLCanvasElement, kind: ObjectKind, size: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);

  const assembly = BLUEPRINTS[kind].create(0, 0);
  const target = { body: assembly.body, extraBodies: assembly.extraBodies ?? [] };
  // Measure the whole assembly, or the crab loses its legs off-frame.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const part of [target.body, ...target.extraBodies]) {
    minX = Math.min(minX, part.bounds.min.x);
    minY = Math.min(minY, part.bounds.min.y);
    maxX = Math.max(maxX, part.bounds.max.x);
    maxY = Math.max(maxY, part.bounds.max.y);
  }

  const scale = Math.min((size - 10) / (maxX - minX), (size - 10) / (maxY - minY));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);
  ctx.scale(scale, scale);
  ctx.translate(-centerX, -centerY);
  DRAWERS[kind](ctx, target, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
