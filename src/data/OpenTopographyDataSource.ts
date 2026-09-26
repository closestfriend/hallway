import type { SpatialDataSource } from './SpatialDataSource';
import { computeBounds, type SpatialScene } from './SpatialScene';
import DemWorker from './workers/dem.worker?worker';

export interface OpenTopographyBBox {
  south: number;
  north: number;
  west: number;
  east: number;
}

const API_URL = 'https://portal.opentopography.org/API/globaldem';

/**
 * Loads a real elevation raster from OpenTopography's free Global DEM API
 * (public open data — SRTM / Copernicus DEM / ALOS, no license
 * click-through) and turns it into a colored point cloud: one point per grid
 * cell, height = real elevation, color = a restrained hypsometric tint.
 *
 * This is aerial bare-earth/surface data, not a photographic street-level
 * capture — it exists as a second, genuinely automatable real-data source
 * for when no PLY is present at CONFIG.assetUrl, and App.ts labels it
 * clearly on screen rather than presenting it as the intended artistic
 * result (see README.md).
 */
export class OpenTopographyDataSource implements SpatialDataSource {
  readonly label: string;
  private worker: Worker | null = null;

  constructor(
    private bbox: OpenTopographyBBox,
    private demType: string,
    private apiKey: string,
    private maxPoints: number,
  ) {
    this.label = `opentopography: ${demType} @ (${bbox.south.toFixed(2)}, ${bbox.west.toFixed(2)})`;
  }

  /** True when a build-time API key is present; App.ts uses this to decide whether to attempt this source at all. */
  static isConfigured(): boolean {
    return !!import.meta.env.VITE_OPENTOPOGRAPHY_API_KEY;
  }

  async load(onProgress?: (f: number) => void): Promise<SpatialScene> {
    const { south, north, west, east } = this.bbox;
    const params = new URLSearchParams({
      demtype: this.demType,
      south: String(south),
      north: String(north),
      west: String(west),
      east: String(east),
      outputFormat: 'AAIGrid',
      API_Key: this.apiKey,
    });
    onProgress?.(0.05);
    const res = await fetch(`${API_URL}?${params}`);
    const text = await res.text();
    if (!res.ok) throw new Error(`OpenTopography ${res.status}: ${text.slice(0, 300)}`);
    if (!/^\s*ncols/i.test(text)) throw new Error(`unexpected OpenTopography response: ${text.slice(0, 300)}`);
    onProgress?.(0.4);

    this.worker = new DemWorker();
    const worker = this.worker;
    const parsed = await new Promise<{ positions: Float32Array; colors: Uint8Array; intensity: Float32Array }>(
      (resolve, reject) => {
        worker.onmessage = (e) => ('error' in e.data ? reject(new Error(e.data.error)) : resolve(e.data));
        worker.onerror = (e) => reject(new Error(e.message));
        worker.postMessage({ text, maxPoints: this.maxPoints });
      },
    );
    onProgress?.(1);

    return {
      positions: parsed.positions,
      colors: parsed.colors,
      intensity: parsed.intensity,
      bounds: computeBounds(parsed.positions),
    };
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
