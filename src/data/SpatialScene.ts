/**
 * Normalized in-memory representation of a spatial capture, decoupled from
 * whatever source produced it (PLY, photogrammetry export, Gaussian splats,
 * RGB-D, panorama+depth reprojection, ...). The renderer consumes only this.
 */

export interface BoundingBox {
  min: [number, number, number];
  max: [number, number, number];
}

export interface SpatialScene {
  /** xyz triplets, length = pointCount * 3 */
  positions: Float32Array;
  /** rgb triplets, 0..255 (Uint8) or 0..1 (Float32), length = pointCount * 3 */
  colors: Uint8Array | Float32Array;
  /** optional per-point reconstruction confidence, 0..1 */
  confidence?: Float32Array;
  /** optional id of the capture/panorama each point was sampled from */
  sourceViewId?: Uint16Array | Uint32Array;
  /** optional lidar-style return intensity */
  intensity?: Float32Array;
  /**
   * Positions the scene was scanned/captured from (panorama or scanner
   * origins). Used by the artifact system to anchor scan rings and wedges.
   * Optional: sources that don't know their capture origins may omit it and
   * the renderer will synthesize plausible origins inside the bounds.
   */
  scanOrigins?: Array<[number, number, number]>;
  bounds: BoundingBox;
}

export function pointCount(scene: SpatialScene): number {
  return scene.positions.length / 3;
}

export function computeBounds(positions: Float32Array): BoundingBox {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      const v = positions[i + a];
      if (v < min[a]) min[a] = v;
      if (v > max[a]) max[a] = v;
    }
  }
  return { min, max };
}
