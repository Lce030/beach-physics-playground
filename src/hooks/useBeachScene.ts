import { useCallback, useEffect, useRef, useState } from 'react';

import { BeachAudio } from '../audio/BeachAudio';
import { MAX_BODIES, SHOVEL } from '../config/scene';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import type { ObjectKind } from '../physics/types';
import { SceneRenderer, type RenderFrame } from '../render/SceneRenderer';
import { SplashSystem } from '../render/SplashSystem';
import type { ToolId } from '../tools';

export interface GhostState {
  x: number;
  y: number;
  radius: number;
}

interface BrushState {
  x: number;
  y: number;
  /** The shovel works while the button is held. */
  active: boolean;
}

export interface BeachSceneApi {
  /** Objects alive right now. */
  count: number;
  capacity: number;
  atCapacity: boolean;
  /** Adds an object from the palette. False when it does not fit. */
  spawn: (kind: ObjectKind, x: number, y: number) => boolean;
  clear: () => void;
  /** Preview shown while dragging from the palette. */
  setGhost: (ghost: GhostState | null) => void;

  tool: ToolId;
  setTool: (tool: ToolId) => void;
  /** Sand in the shovel, 0 to 1. */
  carriedRatio: number;
  /** Restores the starting beach profile. */
  resetTerrain: () => void;
  /** Cursor position for the brush; null when off canvas. */
  setBrushPointer: (point: { x: number; y: number } | null) => void;
  setBrushActive: (active: boolean) => void;

  /** Wind: -1 out to sea, 1 towards the beach. */
  wind: number;
  setWind: (value: number) => void;
  /** Auto mode: the wind drifts on its own. */
  windAuto: boolean;
  setWindAuto: (enabled: boolean) => void;

  /** Sound. Off until a click, which browsers require. */
  soundOn: boolean;
  setSoundOn: (enabled: boolean) => void;
}

/**
 * Bridge between React and the engine: lifecycle only, no physics or drawing.
 * The loop never triggers a React render; the canvas is painted outside the
 * tree.
 */
export function useBeachScene(canvasRef: React.RefObject<HTMLCanvasElement>): BeachSceneApi {
  const worldRef = useRef<PhysicsWorld | null>(null);
  const splashesRef = useRef<SplashSystem | null>(null);
  const ghostRef = useRef<GhostState | null>(null);
  const brushRef = useRef<BrushState | null>(null);
  const toolRef = useRef<ToolId>('move');
  const windRef = useRef(0);
  const windAutoRef = useRef(false);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const audioRef = useRef<BeachAudio | null>(null);
  audioRef.current ??= new BeachAudio();

  const [count, setCount] = useState(0);
  const [wind, setWindValue] = useState(0);
  const [windAuto, setWindAutoValue] = useState(false);
  const [soundOn, setSoundOnValue] = useState(false);
  const [tool, setToolState] = useState<ToolId>('move');
  const [carriedPercent, setCarriedPercent] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const world = new PhysicsWorld();
    worldRef.current = world;
    world.attachMouse(canvas);
    world.setDragEnabled(toolRef.current === 'move');
    // The world is rebuilt on every mount, so wind is reapplied from refs.
    world.wind.setStrength(windRef.current);
    world.wind.setAuto(windAutoRef.current);

    const renderer = new SceneRenderer(ctx);
    const splashes = new SplashSystem();
    splashesRef.current = splashes;
    const audio = audioRef.current;
    const unsubscribeSplash = world.water.onSplash((event) => {
      splashes.spawn(event);
      audio?.playSplash(event.strength);
    });
    const unsubscribeImpact = world.onImpact((strength) => audio?.playThud(strength));
    const unsubscribePour = world.containers.onPour((event) => splashes.pour(event));
    const unsubscribe = world.subscribe(() => setCount(world.count));

    // Canvas size: CSS decides, the backing store follows the DPR.
    const resize = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(canvas.clientWidth * dpr);
      const height = Math.round(canvas.clientHeight * dpr);
      if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
        canvas.width = width;
        canvas.height = height;
      }
      world.syncMouseScale(canvas);
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    // Wheel rotates whatever is held. Native and non-passive, since React
    // registers 'wheel' as passive and preventDefault would not work. With
    // nothing held the event passes through so the page still scrolls.
    const handleWheel = (event: WheelEvent): void => {
      const rotated = world.rotateGrabbed(Math.sign(event.deltaY) * 0.14);
      if (rotated) event.preventDefault();
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // rAF sets the pace; the engine advances on a fixed timestep.
    let frameId = 0;
    let lastTime = performance.now();

    const tick = (now: number): void => {
      const delta = now - lastTime;
      lastTime = now;

      // Applied per frame while the button is down, not per mouse event, or
      // digging would depend on how fast the cursor moves.
      const brush = brushRef.current;
      const activeTool = toolRef.current;
      if (brush?.active && activeTool !== 'move') {
        world.terrain.paint(activeTool, brush.x, brush.y, delta);
        setCarriedPercent(Math.round(world.terrain.carriedRatio * 100));
      }

      world.step(delta);
      splashes.update(delta);

      const frame: RenderFrame = {
        objects: world.getObjects(),
        timeMs: world.timeMs,
        grabbedObjectId: world.grabbedObjectId,
        ghost: ghostRef.current,
        splashes,
        terrain: world.terrain,
        water: world.waterTable,
        wind: world.wind.strength,
        pointer: pointerRef.current,
        brush:
          brush && activeTool !== 'move'
            ? { x: brush.x, y: brush.y, radius: SHOVEL.radius, mode: activeTool }
            : null,
      };
      renderer.render(frame);
    };

    const loop = (now: number): void => {
      tick(now);
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      canvas.removeEventListener('wheel', handleWheel);
      unsubscribe();
      unsubscribeSplash();
      unsubscribePour();
      unsubscribeImpact();
      world.destroy();
      worldRef.current = null;
      splashesRef.current = null;
    };
  }, [canvasRef]);

  const spawn = useCallback((kind: ObjectKind, x: number, y: number): boolean => {
    return worldRef.current?.spawn(kind, x, y) != null;
  }, []);

  const clear = useCallback((): void => {
    worldRef.current?.clear();
    splashesRef.current?.clear();
  }, []);

  const setWind = useCallback((value: number): void => {
    windRef.current = value;
    setWindValue(value);
    worldRef.current?.wind.setStrength(value);
  }, []);

  const setWindAuto = useCallback((enabled: boolean): void => {
    windAutoRef.current = enabled;
    setWindAutoValue(enabled);
    worldRef.current?.wind.setAuto(enabled);
  }, []);

  const setGhost = useCallback((ghost: GhostState | null): void => {
    ghostRef.current = ghost;
  }, []);

  const setTool = useCallback((next: ToolId): void => {
    toolRef.current = next;
    setToolState(next);
    // With the shovel in hand the mouse stops grabbing objects.
    worldRef.current?.setDragEnabled(next === 'move');
    if (next === 'move') brushRef.current = null;
  }, []);

  const setSoundOn = useCallback((enabled: boolean): void => {
    setSoundOnValue(enabled);
    audioRef.current?.setEnabled(enabled);
  }, []);

  /**
   * Always recorded, not just for the shovel: the clouds use it for parallax.
   * Kept in a ref, since React state would re-render the tree on every move.
   */
  const setBrushPointer = useCallback((point: { x: number; y: number } | null): void => {
    pointerRef.current = point;
    if (!point) {
      brushRef.current = null;
      return;
    }
    const active = brushRef.current?.active ?? false;
    brushRef.current = { x: point.x, y: point.y, active };
  }, []);

  const setBrushActive = useCallback((active: boolean): void => {
    if (brushRef.current) brushRef.current.active = active;
  }, []);

  const resetTerrain = useCallback((): void => {
    worldRef.current?.terrain.reset();
    worldRef.current?.waterTable.reset();
    setCarriedPercent(0);
  }, []);

  return {
    count,
    capacity: MAX_BODIES,
    atCapacity: count >= MAX_BODIES,
    spawn,
    clear,
    setGhost,
    tool,
    setTool,
    carriedRatio: carriedPercent / 100,
    resetTerrain,
    setBrushPointer,
    setBrushActive,
    wind,
    setWind,
    windAuto,
    setWindAuto,
    soundOn,
    setSoundOn,
  };
}
