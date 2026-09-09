import type { Body } from 'matter-js';

/**
 * Lowest point of a body. body.bounds is no good: Matter inflates it by
 * velocity for broadphase.
 */
export function lowestPointY(body: Body): number {
  // Matter draws circles as inscribed polygons, so their vertices fall short.
  // The radius is exact.
  if (body.circleRadius) return body.position.y + body.circleRadius;

  let bottom = -Infinity;
  for (const part of body.parts) {
    for (const vertex of part.vertices) {
      if (vertex.y > bottom) bottom = vertex.y;
    }
  }
  return bottom;
}

/**
 * Height the body occupies right now, already rotated. From vertices rather
 * than bounds, which Matter inflates by velocity.
 */
export function verticalExtent(body: Body): number {
  if (body.circleRadius) return body.circleRadius * 2;

  let top = Infinity;
  let bottom = -Infinity;
  for (const part of body.parts) {
    for (const vertex of part.vertices) {
      if (vertex.y < top) top = vertex.y;
      if (vertex.y > bottom) bottom = vertex.y;
    }
  }
  return bottom - top;
}
