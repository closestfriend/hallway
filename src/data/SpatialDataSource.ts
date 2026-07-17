import type { SpatialScene } from './SpatialScene';

/**
 * A source of spatial data. Implementations own their I/O (fetch, worker
 * decode, ...) and must be disposable. The renderer never talks to a source
 * directly — it receives a finished SpatialScene.
 *
 * To add a new source (Gaussian splats, RGB-D, LiDAR, panorama+depth, a
 * permitted map/imagery provider), implement this interface and register it
 * in App.ts. Nothing else needs to change.
 */
export interface SpatialDataSource {
  /** Human-readable label shown in the status line. */
  readonly label: string;
  load(onProgress?: (fraction: number) => void): Promise<SpatialScene>;
  dispose(): void;
}
