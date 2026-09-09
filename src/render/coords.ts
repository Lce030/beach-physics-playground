import { WORLD } from '../config/scene';

/** Convierte coordenadas de pantalla (clientX/clientY) a unidades de mundo. */
export function screenToWorld(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
  return {
    x: ((clientX - rect.left) / rect.width) * WORLD.width,
    y: ((clientY - rect.top) / rect.height) * WORLD.height,
  };
}
