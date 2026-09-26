# Spatial assets

Put a real capture here.

## `scene.ply` — the primary slot

The app looks for **`public/assets/scene.ply`** on startup. If present, it is
loaded instead of the dev fixture (the simulated panorama scan you see when
this folder is empty).

### Supported PLY layout

- Format: `ascii 1.0` or `binary_little_endian 1.0`
- Element `vertex` with per-vertex properties:

| property | type | required |
| --- | --- | --- |
| `x` `y` `z` | float / double | yes |
| `red` `green` `blue` (or `r` `g` `b`) | uchar (0–255) or float (0–1) | recommended |
| `confidence` (or `quality`) | float 0–1 | optional |
| `intensity` | float | optional |

`binary_big_endian` and list properties on the vertex element are not
supported. Faces are ignored — only the vertex cloud is used.

Y should be up and units should be metres (or close): the artifact system's
ring spacing / depth bands are tuned in metres, though everything is
adjustable in the panel.

Good sources of legally usable colored point clouds:

- your own photogrammetry (Meshroom, RealityCapture, Polycam → export PLY)
- your own LiDAR / iPhone Pro scans
- CC-licensed scans on Sketchfab (filter by downloadable + license)
- open heritage scan archives

Several hundred thousand to a few million points is the sweet spot.

## Fallback: real aerial data via OpenTopography

If `scene.ply` is absent, the app can fetch a real elevation raster from
[OpenTopography](https://opentopography.org/)'s free Global DEM API and
render it as a height-colored point cloud, before falling back to the dev
fixture. It's real, freely-licensed, API-fetched data with no license
click-through — but it's aerial and colored by elevation, not a photographic
street-level capture, so it never masquerades as the intended result: it's
shown with an on-screen `REAL DATA, NOT PHOTOGRAPHIC` label.

To enable it:

1. Register at https://opentopography.org/ (free) and request an API key
   under "My Account" → "myOpenTopo Authorizations".
2. `cp .env.example .env` and set `VITE_OPENTOPOGRAPHY_API_KEY=<your key>`.
3. Restart `npm run dev`. The default area/dataset live in
   `CONFIG.openTopography` (`src/app/config.ts`) — change `bbox`/`demType`
   to point elsewhere.

See `src/data/OpenTopographyDataSource.ts` and `src/data/workers/dem.worker.ts`.

## Adding other source types

Data acquisition is decoupled from rendering: implement
`SpatialDataSource` (`src/data/SpatialDataSource.ts`) → produce a
`SpatialScene`, and register it in `src/app/App.ts`. Candidates: Gaussian
splat scenes (positions+colors only), RGB-D captures, panorama+depth-map
reprojection, LAS/LAZ LiDAR.
