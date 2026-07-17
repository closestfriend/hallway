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
} as const;
