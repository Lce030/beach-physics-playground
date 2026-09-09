import { Bodies, Body, Vertices, type Body as MatterBody } from 'matter-js';

export const UMBRELLA = {
  mastHeight: 104,
  mastWidth: 7,
  canopyRadius: 52,
  canopyHeight: 30,
} as const;

/**
 * Umbrella: one compound body, a convex canopy on a thin mast, so a ball can
 * hit the canopy and lever the mast.
 *
 * As with every other factory, (x, y) is the centre of the body.
 */
export function createUmbrella(x: number, y: number): { body: MatterBody; footOffsetY: number } {
  const { mastHeight, mastWidth, canopyRadius, canopyHeight } = UMBRELLA;

  // Built tip-at-origin and moved after, so the offset comes from geometry.
  const mast = Bodies.rectangle(0, -mastHeight / 2, mastWidth, mastHeight, {
    density: 0.0009,
    friction: 0.6,
  });

  const canopyCenterY = -mastHeight + canopyHeight;
  const vertices: Array<{ x: number; y: number }> = [];
  const segments = 12;
  for (let i = 0; i <= segments; i += 1) {
    const angle = Math.PI + (i / segments) * Math.PI;
    vertices.push({
      x: Math.cos(angle) * canopyRadius,
      y: canopyCenterY + Math.sin(angle) * canopyHeight,
    });
  }

  // Absolute vertices with position set to their centroid.
  const canopy = Body.create({
    position: Vertices.centre(vertices),
    vertices,
    density: 0.0006,
    friction: 0.5,
  });

  const body = Body.create({
    parts: [mast, canopy],
    label: 'umbrella',
    restitution: 0.12,
    friction: 0.6,
    frictionAir: 0.02,
  });

  // Body.create sits the body on its centre of mass.
  const footOffsetY = -body.position.y;
  Body.setPosition(body, { x, y });

  return { body, footOffsetY };
}
