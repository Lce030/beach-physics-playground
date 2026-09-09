import { useCallback, type DragEvent, type PointerEvent, type RefObject } from 'react';

import type { BeachSceneApi } from '../hooks/useBeachScene';
import { BLUEPRINTS } from '../physics/bodies';
import type { ObjectKind } from '../physics/types';
import { screenToWorld } from '../render/coords';
import { DRAG_MIME, getDraggingKind, setDraggingKind } from './dragPayload';

interface Props {
  canvasRef: RefObject<HTMLCanvasElement>;
  scene: BeachSceneApi;
}

/**
 * Two distinct pointer interactions live here:
 *
 * 1. Palette drag & drop: plain HTML drag events that create a Matter body
 *    where the pointer released.
 * 2. The shovel: pointer events that edit the terrain heightmap.
 *
 * Dragging an object that is already in the scene never reaches React:
 * MouseConstraint handles it inside PhysicsWorld.
 */
export function BeachStage({ canvasRef, scene }: Props): JSX.Element {
  const { setGhost, setBrushActive, setBrushPointer, spawn, atCapacity, tool } = scene;
  const usingShovel = tool !== 'move';

  const toWorld = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const canvas = canvasRef.current;
      return canvas ? screenToWorld(canvas, event.clientX, event.clientY) : null;
    },
    [canvasRef],
  );

  // ------------------------------------------------------- palette drag & drop

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLCanvasElement>) => {
      const kind = getDraggingKind();
      if (!kind) return;

      // Without preventDefault the browser refuses the drop.
      event.preventDefault();
      event.dataTransfer.dropEffect = atCapacity ? 'none' : 'copy';
      if (atCapacity) {
        setGhost(null);
        return;
      }

      const point = toWorld(event);
      if (point) setGhost({ ...point, radius: BLUEPRINTS[kind].previewRadius });
    },
    [atCapacity, setGhost, toWorld],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      setGhost(null);
      setDraggingKind(null);

      const transferred = event.dataTransfer.getData(DRAG_MIME);
      const kind: ObjectKind | null =
        transferred && transferred in BLUEPRINTS
          ? (transferred as ObjectKind)
          : getDraggingKind();

      const point = toWorld(event);
      if (kind && point) spawn(kind, point.x, point.y);
    },
    [setGhost, spawn, toWorld],
  );

  // ------------------------------------------------------------------- shovel

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (!usingShovel) return;
      const point = toWorld(event);
      if (!point) return;

      // Capture the pointer so a stroke survives leaving the canvas. It can
      // throw if the pointer is already gone, which is not worth aborting for.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* without capture the stroke still works, just not outside the canvas */
      }
      setBrushPointer(point);
      setBrushActive(true);
    },
    [setBrushActive, setBrushPointer, toWorld, usingShovel],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      // Always recorded, shovel or not: the clouds use it for parallax.
      const point = toWorld(event);
      if (point) setBrushPointer(point);
    },
    [setBrushPointer, toWorld],
  );

  const stopPainting = useCallback(() => {
    setBrushActive(false);
  }, [setBrushActive]);

  const handlePointerLeave = useCallback(() => {
    setBrushActive(false);
    setBrushPointer(null);
  }, [setBrushActive, setBrushPointer]);

  return (
    <div className="stage">
      <canvas
        ref={canvasRef}
        className={`stage__canvas${usingShovel ? ' stage__canvas--shovel' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={() => setGhost(null)}
        onDrop={handleDrop}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopPainting}
        onPointerCancel={stopPainting}
        onPointerLeave={handlePointerLeave}
      />
      <p className="stage__hint">
        {usingShovel
          ? tool === 'dig'
            ? 'Put the cursor into the sand and drag to dig'
            : 'Point where the pile should go and drag'
          : 'Drag from the palette to add · drag to move · scroll to rotate what you hold'}
      </p>
    </div>
  );
}
