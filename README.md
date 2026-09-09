# Beach Physics Playground

A 2D beach sandbox: drag objects onto the sand, dig it out with a shovel, fill a
bucket in the sea and pour it into the hole you just made.

Built with React and TypeScript on top of [Matter.js](https://brm.io/matter-js/).
Matter is used strictly as a source of truth for positions and rotations — the
scene is drawn by hand on a `<canvas>`, not by `Matter.Render`.

## Running it

```
npm install
npm run dev
```

`npm run build` type-checks and bundles; `npm run typecheck` runs the compiler on
its own.

## What is in it

- **Six objects**, each with its own physical profile: beach ball, coconut, metal
  bucket, surfboard, umbrella and crab.
- **Diggable terrain.** The beach is a heightmap you can excavate and pile up
  with a shovel. Sand is conserved: digging loads the shovel, and only what it
  holds can be dropped again. Slopes past the angle of repose collapse on their
  own.
- **Water with a real level.** The sea and any puddle you dig or pour are the
  same system, so water finds its level, drains through a channel you cut to the
  shore, and is slowly soaked up by dry sand.
- **Buoyancy by object.** Each type declares how much of itself sits submerged at
  rest, from a beach ball floating high to a bucket that sinks.
- **A bucket that carries water**, gains weight when full and spills from its
  lower lip when tilted past what that fill level can hold.
- **Wind**, on a slider or drifting on its own, that pushes by frontal area.
- **Sound**, synthesised with Web Audio rather than sampled, so a splash follows
  the force of the impact. Off until you turn it on.

## Notes on the implementation

A few decisions that shaped the code:

**Fixed timestep.** `Engine.update` never receives a variable delta. Matter turns
erratic — tunnelling, impossible bounces — as soon as the framerate drops, so the
loop accumulates real time and steps at a fixed 60 Hz, capped at five substeps
per frame.

**A fixed logical world.** Physics always runs in a 1280×720 space and the canvas
scales to fit, so the simulation behaves identically on any screen. Mouse input
is mapped back through Matter's `pixelRatio`, which works out to
`canvas.width / WORLD.width`.

**Terrain as a heightmap.** Each column between two height nodes is a single
static quad whose top edge runs from one node to the next, so the surface that is
drawn and the surface that collides are the same line. Digging rebuilds only the
columns that changed. The trade-off is one height per column: relief, but no
tunnels or caves.

**Buoyancy sampled at three points** along each body rather than one. A single
sample acts through the centre of mass and produces no torque, so nothing would
ever right itself; with three, the deeper end gets more lift and a surfboard
dropped on edge settles flat.

**Compound and articulated bodies.** The umbrella is one compound body — canopy
and mast — so a ball can hit the canopy and lever the mast. The crab's legs and
the bucket's handle are separate bodies on constraints, which is what makes them
lag and swing instead of moving rigidly. Matter has no joint limits, so parts
that should not fold flat get an explicit angular clamp.

**Where Matter needed help.** Terrain columns are tall and narrow, so an object
that penetrates deeply flips the minimum separation axis to horizontal and the
solver stops pushing it up; a post-step correction keeps objects out of the sand.
`MouseConstraint` also defaults `angularStiffness` to 1, which zeroes the torque
from a grab, so picking an object up by its edge produces no tilt at all until
you change it.

## Layout

```
src/
  physics/     Matter world, terrain, water, wind, containers, planted objects
  render/      canvas renderer, drawers, splash particles
  components/  React UI: stage, palette, toolbar
  hooks/       the single bridge between React and the engine
  config/      world geometry and shared constants
  audio/       Web Audio synthesis
```

The engine never imports React and the renderer never moves a body. The only
place the two meet is `useBeachScene`, which owns the lifecycle and the animation
loop and nothing else.

## Limits

- One height per terrain column, so no caves or overhangs.
- Objects are capped at 40 for performance. A crab counts as one object but adds
  five bodies.
- Water is a per-column depth, not a fluid simulation. It levels and drains, but
  it does not splash around or carry sand.
