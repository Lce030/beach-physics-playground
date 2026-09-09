import type { Body } from 'matter-js';

import { WORLD } from '../config/scene';
import { lowestPointY } from '../physics/geometry';
import type { Terrain } from '../physics/Terrain';
import type { WaterTable } from '../physics/WaterTable';
import type { SceneObject } from '../physics/types';
import { DRAWERS } from './drawers';
import {
  drawHorizonSea,
  drawSand,
  drawSky,
  drawClouds,
  drawFoam,
  drawWater,
  drawWindStreaks,
} from './drawers/environment';
import type { SplashSystem } from './SplashSystem';

export interface RenderFrame {
  readonly objects: readonly SceneObject[];
  /** Simulation clock, so waves and physics stay in phase. */
  readonly timeMs: number;
  readonly splashes: SplashSystem;
  /** Object under the mouse, drawn highlighted. */
  readonly grabbedObjectId: number | null;
  /** Preview of an object being dragged in from the palette. */
  readonly ghost: { readonly x: number; readonly y: number; readonly radius: number } | null;
  /** Current wind, for the streaks. */
  readonly wind: number;
  /** Cursor in world coordinates, for cloud parallax. */
  readonly pointer: { readonly x: number; readonly y: number } | null;
  /** Per-column water depth: sea and puddles both come from here. */
  readonly water: WaterTable;
  /** Live terrain. Read-only here. */
  readonly terrain: Terrain;
  /** Shovel brush under the cursor, when a tool is active. */
  readonly brush: { readonly x: number; readonly y: number; readonly radius: number; readonly mode: 'dig' | 'fill' } | null;
}

/**
 * Layered 2D canvas rendering. Matter.Render is not used: the engine supplies
 * positions and rotations, everything else is decided here.
 */
export class SceneRenderer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  render(frame: RenderFrame): void {
    const { ctx } = this;

    // Scale so one world unit is one drawing unit, whatever the canvas size.
    const scaleX = ctx.canvas.width / WORLD.width;
    const scaleY = ctx.canvas.height / WORLD.height;
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    ctx.clearRect(0, 0, WORLD.width, WORLD.height);

    drawSky(ctx);
    drawClouds(ctx, frame.pointer);
    drawWindStreaks(ctx, frame.wind, frame.timeMs);
    drawHorizonSea(ctx);
    drawSand(ctx, frame.terrain);

    for (const object of frame.objects) {
      this.drawShadow(object.body, frame.terrain);
    }

    for (const object of frame.objects) {
      if (object.id === frame.grabbedObjectId) this.drawGrabHighlight(object.body);
      DRAWERS[object.kind](ctx, object, frame.timeMs);
    }

    // Water goes over the objects, semi-transparent, so submerged parts show.
    drawWater(ctx, frame.terrain, frame.water, frame.timeMs);

    // Foam sits on the water line.
    drawFoam(ctx, frame.water, frame.timeMs);

    // Droplets fly up out of the water, so they go on top.
    frame.splashes.draw(ctx);

    if (frame.ghost) this.drawGhost(frame.ghost, frame.terrain);
    if (frame.brush) this.drawBrush(frame.brush);
  }

  /**
   * Drop shadow: an ellipse on the terrain that follows the object and fades
   * with height.
   */
  private drawShadow(body: Body, terrain: Terrain): void {
    const { ctx } = this;
    const { x } = body.position;
    const groundY = terrain.surfaceYAt(x);
    const width = body.bounds.max.x - body.bounds.min.x;
    // bounds are inflated by velocity, which would make the shadow jump.
    const bottom = lowestPointY(body);
    const height = Math.max(0, groundY - bottom);

    if (height > 260) return;

    const fade = 1 - height / 260;
    const radiusX = (width / 2) * (0.85 + (1 - fade) * 0.7);
    const radiusY = radiusX * 0.26;

    ctx.save();
    ctx.globalAlpha = 0.3 * fade;
    ctx.beginPath();
    ctx.ellipse(x, groundY + radiusY * 0.6, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#6b4f2a';
    ctx.fill();
    ctx.restore();
  }

  private drawGrabHighlight(body: Body): void {
    const { ctx } = this;
    const radius = (body.bounds.max.x - body.bounds.min.x) / 2 + 8;
    ctx.save();
    ctx.beginPath();
    ctx.arc(body.position.x, body.position.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Shovel brush: a dashed ring and an arrow showing dig or pile.
   */
  private drawBrush(brush: { x: number; y: number; radius: number; mode: 'dig' | 'fill' }): void {
    const { ctx } = this;
    const digging = brush.mode === 'dig';

    ctx.save();
    ctx.beginPath();
    ctx.arc(brush.x, brush.y, brush.radius, 0, Math.PI * 2);
    ctx.fillStyle = digging ? 'rgba(70,40,15,0.14)' : 'rgba(255,240,200,0.22)';
    ctx.fill();
    ctx.strokeStyle = digging ? 'rgba(60,35,12,0.75)' : 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    const tip = digging ? brush.y + 13 : brush.y - 13;
    const tail = digging ? brush.y - 11 : brush.y + 11;
    ctx.moveTo(brush.x, tail);
    ctx.lineTo(brush.x, tip);
    ctx.moveTo(brush.x - 6, tip + (digging ? -6 : 6));
    ctx.lineTo(brush.x, tip);
    ctx.lineTo(brush.x + 6, tip + (digging ? -6 : 6));
    ctx.strokeStyle = digging ? 'rgba(60,35,12,0.85)' : 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  /** Preview while dragging a new object in from the palette. */
  private drawGhost(ghost: { x: number; y: number; radius: number }, terrain: Terrain): void {
    const { ctx } = this;
    const groundY = terrain.surfaceYAt(ghost.x);
    // Objects cannot spawn inside the sand, so the preview seats itself too.
    const y = Math.min(ghost.y, groundY - ghost.radius);
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(ghost.x, y, ghost.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,60,80,0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();

    // Vertical guide to the ground, showing where it will land.
    ctx.beginPath();
    ctx.moveTo(ghost.x, y + ghost.radius);
    ctx.lineTo(ghost.x, groundY);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}
