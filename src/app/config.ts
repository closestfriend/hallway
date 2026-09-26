/** App-level configuration. */
export const CONFIG = {
  /**
   * Where a real capture should live. Put a colored PLY at
   * public/assets/scene.ply and it is loaded instead of the dev fixture.
   * See assets/README.md for the supported format.
   */
  assetUrl: '/assets/scene.ply',

  /** hard cap on device pixel ratio (retina displays) */
  maxPixelRatio: 2,

  camera: {
    fov: 55,
    near: 0.1,
    far: 2000,
  },

  /**
   * Second, fully-automated real-data source: OpenTopography's free Global
   * DEM API (public open data, no license click-through). It is aerial and
   * elevation-colored rather than a photographic street-level capture, so it
   * only engages as a fallback when no PLY is present at `assetUrl`, and is
   * clearly labeled on screen when active. Requires a free API key — see
   * .env.example / public/assets/README.md. Used only if
   * VITE_OPENTOPOGRAPHY_API_KEY is set.
   */
  openTopography: {
    /** Global DEM API dataset code. COP30 = Copernicus GLO-30 (~30m, includes building/canopy surface height). */
    demType: 'COP30',
    /** San Francisco's hills — real elevation relief inside an urban footprint. */
    bbox: { south: 37.72, north: 37.8, west: -122.51, east: -122.39 },
    /** grid is strided down to stay near this point budget */
    maxPoints: 400_000,
  },
} as const;
