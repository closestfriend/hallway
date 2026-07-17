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

## Adding other source types

Data acquisition is decoupled from rendering: implement
`SpatialDataSource` (`src/data/SpatialDataSource.ts`) → produce a
`SpatialScene`, and register it in `src/app/App.ts`. Candidates: Gaussian
splat scenes (positions+colors only), RGB-D captures, panorama+depth-map
reprojection, LAS/LAZ LiDAR.
