import {
  Bodies,
  Body,
  Composite,
  Engine,
  Events,
  Mouse,
  MouseConstraint,
} from 'matter-js';

import { FIXED_TIMESTEP_MS, MAX_BODIES, MAX_SUBSTEPS, WORLD } from '../config/scene';
import { BLUEPRINTS } from './bodies';
import { ContainerSystem } from './ContainerSystem';
import { lowestPointY } from './geometry';
import { PlantedSystem } from './PlantedSystem';
import { readPlugin, writePlugin, type ObjectKind, type SceneObject } from './types';
import { Terrain } from './Terrain';
import { WaterSystem } from './WaterSystem';
import { WaterTable } from './WaterTable';
import { WindSystem } from './WindSystem';

/** How far an object may sink into sand before it is pushed back out. */
const SAND_PENETRATION_TOLERANCE = 3;
/** Correction cap per substep, so it surfaces quickly without teleporting. */
const MAX_SAND_LIFT_PER_STEP = 5;

const GROUND_OPTIONS = {
  isStatic: true,
  friction: 0.9,
  frictionStatic: 1,
  restitution: 0.08,
  label: 'terrain',
} as const;

/**
 * Owns the Matter world. Knows nothing about React or canvas.
 */
export class PhysicsWorld {
  readonly engine: Engine;
  readonly water: WaterSystem;
  readonly containers: ContainerSystem;
  readonly terrain: Terrain;
  readonly waterTable: WaterTable;
  readonly planted: PlantedSystem;
  readonly wind: WindSystem;

  private readonly objects: SceneObject[] = [];
  private nextId = 1;
  private accumulatorMs = 0;
  private mouseConstraint: MouseConstraint | null = null;
  private mouse: Mouse | null = null;
  private releaseWindowMouse: (() => void) | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly impactListeners = new Set<(strength: number) => void>();

  constructor() {
    this.engine = Engine.create({
      gravity: { x: 0, y: 1, scale: 0.001 },
      // Generous iterations; stacks are far more stable for it.
      positionIterations: 8,
      velocityIterations: 6,
    });

    // The ground is a diggable heightmap, not a fixed set of rectangles.
    this.terrain = new Terrain(this.engine.world);
    Composite.add(this.engine.world, this.createWalls());

    // beforeUpdate runs once per substep, so forces stay framerate-independent.
    this.waterTable = new WaterTable(this.terrain);
    this.water = new WaterSystem(this.engine, this.waterTable);
    this.containers = new ContainerSystem(this.engine, this.waterTable);
    this.planted = new PlantedSystem(this.engine, this.engine.world, this.terrain);
    this.wind = new WindSystem(this.engine);
    // Ground impacts, normalised so a gentle landing is not a slam.
    Events.on(this.engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        const a = pair.bodyA.parent;
        const bodyB = pair.bodyB.parent;
        const moving = a.isStatic ? bodyB : a;
        if (a.isStatic === bodyB.isStatic) continue;
        if (!readPlugin(moving)) continue;

        const speed = Math.hypot(moving.velocity.x, moving.velocity.y);
        if (speed < 2.5) continue;
        const strength = Math.min(1, (speed - 2.5) / 9);
        for (const listener of this.impactListeners) listener(strength);
      }
    });

    Events.on(this.engine, 'beforeUpdate', () => {
      // Settle the water before anything reads it.
      this.waterTable.update();
      this.containers.apply(this.objects, FIXED_TIMESTEP_MS);
      this.planted.apply();
      this.water.apply(this.objects);
      this.wind.apply(this.objects);
    });
  }

  /** Simulation clock, not wall clock, so rendering stays in phase. */
  get timeMs(): number {
    return this.engine.timing.timestamp;
  }

  // ----------------------------------------------------------------- scenery

  /** Invisible side walls so nothing escapes sideways. */
  private createWalls(): Body[] {
    const wallOptions = { ...GROUND_OPTIONS, friction: 0.05, label: 'wall' };
    return [
      Bodies.rectangle(-40, WORLD.height / 2, 80, WORLD.height * 3, wallOptions),
      Bodies.rectangle(WORLD.width + 40, WORLD.height / 2, 80, WORLD.height * 3, wallOptions),
    ];
  }

  // ----------------------------------------------------------------- objects

  /** Adds an object. Returns null when the body cap is reached. */
  spawn(kind: ObjectKind, x: number, y: number): SceneObject | null {
    if (this.objects.length >= MAX_BODIES) return null;

    const blueprint = BLUEPRINTS[kind];
    // Planted objects seat on the sand, or their anchor spawns stretched.
    const spawnY = blueprint.planted
      ? this.restingY(kind, x)
      : Math.min(y, this.restingY(kind, x));
    const assembly = blueprint.create(x, spawnY);
    const { body } = assembly;
    const object: SceneObject = {
      id: this.nextId++,
      kind,
      body,
      extraBodies: assembly.extraBodies ?? [],
      constraints: assembly.constraints ?? [],
    };

    // Bodies are created unrotated, so these are the local measurements.
    // Cached because buoyancy needs them on every substep.
    writePlugin(body, {
      kind,
      id: object.id,
      baseFrictionAir: body.frictionAir,
      halfWidth: (body.bounds.max.x - body.bounds.min.x) / 2,
      halfHeight: (body.bounds.max.y - body.bounds.min.y) / 2,
      submerged: 0,
      // Frozen here, while the body is still empty. See BeachPlugin.
      waterDensity: body.mass / body.area / blueprint.water.floatFraction,
      baseMass: body.mass,
      contents: 0,
    });

    Composite.add(this.engine.world, [body, ...object.extraBodies, ...object.constraints]);
    this.objects.push(object);

    // Planted objects get anchored as soon as they exist.
    if (blueprint.planted && assembly.footOffsetY !== undefined) {
      this.planted.plant(object, blueprint.planted, assembly.footOffsetY);
    }

    this.emitChange();
    return object;
  }

  /** Centre y for an object resting on the sand at that x. */
  private restingY(kind: ObjectKind, x: number): number {
    const probe = BLUEPRINTS[kind].create(x, 0).body;
    const bottomOffset = lowestPointY(probe) - probe.position.y;
    return this.terrain.surfaceYAt(x) - bottomOffset - 1;
  }

  /** Removes every dynamic object; the static scenery stays. */
  clear(): void {
    this.planted.clear();
    for (const object of this.objects) this.removeFromWorld(object);
    this.objects.length = 0;
    this.emitChange();
  }

  private remove(object: SceneObject): void {
    this.planted.release(object);
    this.removeFromWorld(object);
    const index = this.objects.indexOf(object);
    if (index >= 0) this.objects.splice(index, 1);
    this.emitChange();
  }

  /** An object can be several bodies and constraints. All of them go. */
  private removeFromWorld(object: SceneObject): void {
    for (const constraint of object.constraints) {
      Composite.remove(this.engine.world, constraint, true);
    }
    for (const extra of object.extraBodies) {
      Composite.remove(this.engine.world, extra, true);
    }
    Composite.remove(this.engine.world, object.body, true);
  }

  getObjects(): readonly SceneObject[] {
    return this.objects;
  }

  get count(): number {
    return this.objects.length;
  }

  /**
   * Enables or disables mouse dragging. Emptying the collision mask is
   * reversible and leaves the rest of the world alone.
   */
  setDragEnabled(enabled: boolean): void {
    if (!this.mouseConstraint) return;
    this.mouseConstraint.collisionFilter.mask = enabled ? 0xffffffff : 0;
  }

  /**
   * Rotates whatever the mouse is holding. An object hanging from the cursor
   * behaves like a pendulum, so there is no other way to aim a pour.
   */
  rotateGrabbed(deltaRadians: number): boolean {
    const body = this.mouseConstraint?.body;
    if (!body) return false;

    Body.setAngle(body, body.angle + deltaRadians);
    // Otherwise the rotation becomes angular velocity and the object keeps
    // spinning after the wheel stops.
    Body.setAngularVelocity(body, 0);
    return true;
  }

  /** Id of the object under the mouse constraint, if any. */
  get grabbedObjectId(): number | null {
    const body = this.mouseConstraint?.body;
    if (!body) return null;
    return readPlugin(body)?.id ?? null;
  }

  // ---------------------------------------------------------------- stepping

  /**
   * Advances the simulation on a fixed timestep, accumulating real time.
   *
   * Engine.update never receives a variable delta: Matter turns erratic
   * (tunnelling, impossible bounces) as soon as the framerate drops.
   */
  step(deltaMs: number): void {
    // A negative delta would leave the accumulator negative and freeze the
    // simulation for good.
    this.accumulatorMs += Math.max(0, Math.min(deltaMs, 100));

    let steps = 0;
    while (this.accumulatorMs >= FIXED_TIMESTEP_MS && steps < MAX_SUBSTEPS) {
      // Between updates, never during one: Matter snapshots the body list.
      this.terrain.settle();
      this.terrain.rebuildDirty();

      Engine.update(this.engine, FIXED_TIMESTEP_MS);
      this.keepBodiesOutOfTheSand();
      this.limitArticulations();
      this.accumulatorMs -= FIXED_TIMESTEP_MS;
      steps += 1;
    }

    // If the substeps run out, drop the leftover time rather than spiral.
    if (steps === MAX_SUBSTEPS) this.accumulatorMs = 0;

    this.cullEscapedBodies();
  }

  /**
   * Keeps objects out of the sand. Terrain columns are tall and narrow, so on
   * deep penetration Matter's minimum separation axis turns horizontal and it
   * stops pushing objects up.
   */
  private keepBodiesOutOfTheSand(): void {
    const grabbed = this.mouseConstraint?.body ?? null;

    for (const { body } of this.objects) {
      if (body.isStatic) continue;

      const surface = this.terrain.surfaceYAt(body.position.x);
      const penetration = lowestPointY(body) - surface;
      if (penetration <= SAND_PENETRATION_TOLERANCE) continue;

      // Uncapped for the held body: the MouseConstraint spring pulls harder
      // than the per-substep cap and would win.
      const maxLift = body === grabbed ? penetration : MAX_SAND_LIFT_PER_STEP;
      const lift = Math.min(penetration - SAND_PENETRATION_TOLERANCE, maxLift);
      Body.setPosition(body, { x: body.position.x, y: body.position.y - lift });
      if (body.velocity.y > 0) {
        Body.setVelocity(body, { x: body.velocity.x, y: 0 });
      }
    }
  }

  /**
   * Joint limits, which Matter does not provide. Without them a hard knock
   * flips a part right over and it stays there.
   */
  private limitArticulations(): void {
    for (const object of this.objects) {
      const limit = BLUEPRINTS[object.kind].articulation;
      if (!limit) continue;

      for (const part of object.extraBodies) {
        const relative = normalizeAngle(part.angle - object.body.angle);
        if (Math.abs(relative) <= limit.maxRelativeAngle) continue;

        const clamped = Math.sign(relative) * limit.maxRelativeAngle;
        Body.setAngle(part, object.body.angle + clamped);
        Body.setAngularVelocity(part, 0);
      }
    }
  }

  private cullEscapedBodies(): void {
    for (let i = this.objects.length - 1; i >= 0; i -= 1) {
      const object = this.objects[i];
      if (!object) continue;
      const { x, y } = object.body.position;
      if (y > WORLD.height + 400 || x < -400 || x > WORLD.width + 400) {
        this.remove(object);
      }
    }
  }

  // -------------------------------------------- arrastre de objetos EXISTENTES

  /**
   * Dragging objects that are already in the scene. Matter's MouseConstraint
   * handles it; creating from the palette lives in the React layer.
   */
  attachMouse(canvas: HTMLCanvasElement): void {
    if (this.mouseConstraint) return;

    const mouse = Mouse.create(canvas);
    this.mouse = mouse;
    this.syncMouseScale(canvas);
    this.followMouseOutsideCanvas(canvas, mouse);

    const mouseConstraint = MouseConstraint.create(this.engine, {
      mouse,
      constraint: {
        stiffness: 0.18,
        damping: 0.12,
        render: { visible: false },
      },
    });

    // Constraint.solve multiplies torque by (1 - angularStiffness), and
    // MouseConstraint defaults it to 1, so grabbing an edge produces no tilt.
    // Set here because @types/matter-js does not declare the property.
    (mouseConstraint.constraint as unknown as { angularStiffness: number }).angularStiffness = 0.96;

    this.mouseConstraint = mouseConstraint;
    Composite.add(this.engine.world, mouseConstraint);
  }

  /**
   * Matter binds its mouse listeners to the canvas, so a mouseup outside it
   * never arrives and the object stays glued to the cursor. Forwarding from
   * window fixes it; canvas events are skipped since Matter saw them already.
   */
  private followMouseOutsideCanvas(canvas: HTMLCanvasElement, mouse: Mouse): void {
    // @types/matter-js does not declare these handlers, but Mouse.create sets them.
    const handlers = mouse as unknown as {
      mousemove: (event: Event) => void;
      mouseup: (event: Event) => void;
    };

    const forward = (handler: (event: Event) => void) => (event: Event) => {
      if (event.target !== canvas) handler(event);
    };

    const onMove = forward(handlers.mousemove);
    const onUp = forward(handlers.mouseup);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    this.releaseWindowMouse = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }

  /**
   * Matter maps screen pixels with
   *   worldX = offsetX / ((clientWidth / canvas.width) * pixelRatio)
   * so pixelRatio = canvas.width / WORLD.width. Resync on every resize.
   */
  syncMouseScale(canvas: HTMLCanvasElement): void {
    if (!this.mouse || canvas.width === 0) return;
    this.mouse.pixelRatio = canvas.width / WORLD.width;
  }

  detachMouse(): void {
    this.releaseWindowMouse?.();
    this.releaseWindowMouse = null;

    if (this.mouseConstraint) {
      Composite.remove(this.engine.world, this.mouseConstraint, true);
      this.mouseConstraint = null;
    }
    this.mouse = null;
  }

  destroy(): void {
    this.detachMouse();
    this.listeners.clear();
    Composite.clear(this.engine.world, false, true);
    Engine.clear(this.engine);
  }

  // ------------------------------------------------------------ subscription

  /** Ground impacts, with a strength from 0 to 1. */
  onImpact(listener: (strength: number) => void): () => void {
    this.impactListeners.add(listener);
    return () => {
      this.impactListeners.delete(listener);
    };
  }

  /** Lets React know when the inventory changes (counter, buttons). */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitChange(): void {
    for (const listener of this.listeners) listener();
  }
}

/** Wraps an angle into [-PI, PI] so it can be compared against a limit. */
function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
