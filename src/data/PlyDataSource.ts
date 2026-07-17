import type { SpatialDataSource } from './SpatialDataSource';
import { computeBounds, type SpatialScene } from './SpatialScene';
import PlyWorker from './workers/plyParser.worker?worker';

/**
 * Loads a colored PLY point cloud over HTTP and decodes it in a Web Worker.
 * This is the intended path for real captures: drop a file at
 * /public/assets/scene.ply (see assets/README.md) and it is picked up on
 * reload.
 */
export class PlyDataSource implements SpatialDataSource {
  readonly label: string;
  private worker: Worker | null = null;

  constructor(private url: string) {
    this.label = `ply: ${url}`;
  }

  async load(onProgress?: (f: number) => void): Promise<SpatialScene> {
    const res = await fetch(this.url);
    if (!res.ok) throw new Error(`fetch ${this.url}: ${res.status}`);
    const contentType = res.headers.get('content-type') ?? '';
    // Vite's dev server returns index.html for missing files in some setups;
    // guard against silently parsing HTML as a point cloud.
    if (contentType.includes('text/html')) throw new Error(`no PLY at ${this.url}`);
    const buffer = await readWithProgress(res, onProgress);

    this.worker = new PlyWorker();
    const worker = this.worker;
    const parsed = await new Promise<{
      positions: Float32Array;
      colors: Uint8Array;
      confidence?: Float32Array;
      intensity?: Float32Array;
    }>((resolve, reject) => {
      worker.onmessage = (e) => ('error' in e.data ? reject(new Error(e.data.error)) : resolve(e.data));
      worker.onerror = (e) => reject(new Error(e.message));
      worker.postMessage({ buffer }, [buffer]);
    });

    return {
      positions: parsed.positions,
      colors: parsed.colors,
      confidence: parsed.confidence,
      intensity: parsed.intensity,
      bounds: computeBounds(parsed.positions),
    };
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}

async function readWithProgress(res: Response, onProgress?: (f: number) => void): Promise<ArrayBuffer> {
  const total = Number(res.headers.get('content-length') ?? 0);
  if (!res.body || !total || !onProgress) return res.arrayBuffer();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(Math.min(1, received / total));
  }
  const out = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out.buffer;
}
