# street cloud study

An experimental WebGL artwork: a real place, reconstructed imperfectly as
spatial data. Inspired by the visual language of
[Street Cloud](https://experiments.withgoogle.com/street-cloud): panorama +
LiDAR captures rendered as colored point clouds whose *errors* (scan rings,
holes, misaligned layers, depth bands) are the aesthetic.

The scene should feel like standing inside a reconstruction algorithm:
photographic color, spatially displaced, incompletely sampled.

## Run

```
npm install
npm run dev
```

then open the printed URL. Production build: `npm run build` (output in
`dist/`, preview with `npm run preview`).

## Replacing the sample asset

Out of the box the app renders a **dev fixture**: a simulated panorama scan
of a synthetic street, generated in a worker. It exists only to verify the
renderer and is clearly labeled on screen: it is not the artistic result.

Drop a real colored point cloud at **`public/assets/scene.ply`** and reload.
The supported PLY layout (and ideas for legally usable captures) is
documented in [`public/assets/README.md`](public/assets/README.md).

## Controls

- **drag** orbit · **scroll** dolly · **right-drag / shift-drag** pan
- top-right panel (click `RECONSTRUCTION` to expand):
  - **camera**: `guided` (slow authored loop) / `explore` (damped orbit + drift), travel speed
  - **points**: size, density, opacity, saturation
  - **artifacts**: a macro `intensity` knob plus individual controls for
    scan rings, ring spacing, structured missing data, panorama wedges,
    depth quantization bands, source-layer separation, jitter
  - **time**: temporal reveal (scene streams in) and decay (seen regions
    thin out again); both cyclic and non-destructive
  - **atmosphere**: depth fade, background level

## Architecture

```
src/
  app/        App orchestration + config (asset URL lives in config.ts)
  data/       SpatialDataSource interface, PLY loader (worker), dev fixture (worker)
  rendering/  THREE.Points renderer + custom GLSL point shaders
  effects/    ArtifactController: params → uniforms, macro presets
  camera/     damped explore controller, guided Catmull-Rom path
  ui/         hand-rolled diagnostic control panel
  utils/      bounds, disposal, adaptive quality
```

Design rules the code follows:

- **Sources are pluggable.** Anything that can produce a `SpatialScene`
  (positions, colors, optional confidence / view ids / scan origins, bounds)
  can be rendered. Gaussian splats, RGB-D, LAS/LAZ, panorama+depth are
  intended future implementations of `SpatialDataSource`.
- **Artifacts are non-destructive.** Point buffers are uploaded once; every
  artifact (rings, missing cells, wedges, depth bands, layer drift, reveal,
  decay) is a uniform-driven transform in the vertex shader, anchored to the
  capture's scanner origins rather than the camera, so errors read as
  properties of the data.
- **Photographic, not emissive.** Alpha blending, no additive glow, no
  bloom; source colors pass through with only a saturation control and a
  restrained depth fade.
- **Performance.** Typed arrays end-to-end, worker-based parsing, uint8
  colors on the GPU, DPR capped at 2, and an adaptive quality loop that
  trims point density (shader-side, buffers untouched) if the frame rate
  drops. Several hundred thousand points render comfortably; the chunk/LOD
  path for millions is the intended next step (split `SpatialScene` into
  spatial chunks, one `THREE.Points` each, distance-based density).
