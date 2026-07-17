import type { SpatialDataSource } from './SpatialDataSource';
import { computeBounds, type SpatialScene } from './SpatialScene';
import FixtureWorker from './workers/fixture.worker?worker';

/**
 * DEV FIXTURE source. Only used when no real asset exists at
 * /assets/scene.ply. Generates a simulated panorama-scan of a synthetic
 * street in a worker (see fixture.worker.ts for why it is built as a scan
 * simulation rather than scattered particles).
 */
export class FixtureDataSource implements SpatialDataSource {
  readonly label = 'dev fixture (simulated panorama scan)';
  private worker: Worker | null = null;

  constructor(
    private raysAz = 900,
    private raysEl = 260,
  ) {}

  async load(onProgress?: (f: number) => void): Promise<SpatialScene> {
    this.worker = new FixtureWorker();
    const worker = this.worker;
    const parsed = await new Promise<{
      positions: Float32Array;
      colors: Uint8Array;
      confidence: Float32Array;
      viewId: Uint16Array;
      scanOrigins: Array<[number, number, number]>;
    }>((resolve, reject) => {
      worker.onmessage = (e) => {
        if ('progress' in e.data) onProgress?.(e.data.progress);
        else resolve(e.data);
      };
      worker.onerror = (e) => reject(new Error(e.message));
      worker.postMessage({ raysAz: this.raysAz, raysEl: this.raysEl });
    });

    return {
      positions: parsed.positions,
      colors: parsed.colors,
      confidence: parsed.confidence,
      sourceViewId: parsed.viewId,
      scanOrigins: parsed.scanOrigins,
      bounds: computeBounds(parsed.positions),
    };
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
