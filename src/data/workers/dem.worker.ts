/**
 * Worker: parses an ESRI ASCII Grid (AAIGrid) elevation raster — the format
 * returned by OpenTopography's free Global DEM API — into a colored point
 * cloud. One point per grid cell (or per strided sample, if the grid exceeds
 * the point budget): position is real-world local metres (equirectangular
 * projection about the grid's own centre, elevation as the up axis); color
 * is a restrained two-stop hypsometric tint rather than a rainbow colormap,
 * so it sits inside the piece's desaturated, photographic palette even
 * though this source isn't photographic.
 */

const DEG_TO_M_LAT = 111_320;

self.onmessage = (e: MessageEvent<{ text: string; maxPoints: number }>) => {
  try {
    const result = parseDem(e.data.text, e.data.maxPoints);
    (self as unknown as Worker).postMessage(result, [
      result.positions.buffer, result.colors.buffer, result.intensity.buffer,
    ]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ error: String(err) });
  }
};

function parseDem(text: string, maxPoints: number) {
  const lines = text.split(/\r?\n/);
  let ncols = 0, nrows = 0, xll = 0, yll = 0, cellsize = 0, nodata = -9999;
  let bodyStart = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    const parts = t.split(/\s+/);
    const key = parts[0].toLowerCase();
    if (key === 'ncols') ncols = parseInt(parts[1], 10);
    else if (key === 'nrows') nrows = parseInt(parts[1], 10);
    else if (key === 'xllcorner' || key === 'xllcenter') xll = parseFloat(parts[1]);
    else if (key === 'yllcorner' || key === 'yllcenter') yll = parseFloat(parts[1]);
    else if (key === 'cellsize') cellsize = parseFloat(parts[1]);
    else if (key === 'nodata_value') nodata = parseFloat(parts[1]);
    else { bodyStart = i; break; }
  }
  if (!ncols || !nrows || !cellsize) {
    throw new Error('not an ESRI ASCII Grid (missing ncols/nrows/cellsize) — check demtype/API key/bbox');
  }

  // Row-major elevation grid; AAIGrid's first row is the northernmost.
  const grid = new Float32Array(ncols * nrows);
  let idx = 0;
  for (let i = bodyStart; i < lines.length && idx < grid.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    const vals = t.split(/\s+/);
    for (let k = 0; k < vals.length && idx < grid.length; k++) grid[idx++] = parseFloat(vals[k]);
  }
  if (idx < grid.length) throw new Error('truncated grid body — response may have been cut off');

  // Stride down so the point count stays near the budget.
  const total = ncols * nrows;
  const stride = Math.max(1, Math.ceil(Math.sqrt(total / maxPoints)));

  const lonCenter = xll + (ncols * cellsize) / 2;
  const latCenter = yll + (nrows * cellsize) / 2;
  const mPerDegLon = DEG_TO_M_LAT * Math.cos((latCenter * Math.PI) / 180);

  // Pass 1: count valid (non-NODATA) sampled cells and the elevation range.
  let count = 0;
  let elevMin = Infinity, elevMax = -Infinity;
  for (let r = 0; r < nrows; r += stride) {
    for (let c = 0; c < ncols; c += stride) {
      const el = grid[r * ncols + c];
      if (el === nodata || !Number.isFinite(el)) continue;
      count++;
      if (el < elevMin) elevMin = el;
      if (el > elevMax) elevMax = el;
    }
  }
  if (!count) throw new Error('the requested bbox was entirely NODATA (likely open ocean)');

  const positions = new Float32Array(count * 3);
  const colors = new Uint8Array(count * 3);
  const intensity = new Float32Array(count);
  const elevRange = Math.max(1, elevMax - elevMin);
  const lo: [number, number, number] = [0.3, 0.34, 0.36]; // low ground: cool slate
  const hi: [number, number, number] = [0.62, 0.56, 0.46]; // high ground: warm stone

  let n = 0;
  for (let r = 0; r < nrows; r += stride) {
    const lat = yll + (nrows - 1 - r) * cellsize;
    for (let c = 0; c < ncols; c += stride) {
      const el = grid[r * ncols + c];
      if (el === nodata || !Number.isFinite(el)) continue;
      const lon = xll + c * cellsize;

      positions[n * 3] = (lon - lonCenter) * mPerDegLon;
      positions[n * 3 + 1] = el - elevMin;
      positions[n * 3 + 2] = (lat - latCenter) * DEG_TO_M_LAT;

      const t = (el - elevMin) / elevRange;
      intensity[n] = t;
      colors[n * 3] = ((lo[0] + (hi[0] - lo[0]) * t) * 255) | 0;
      colors[n * 3 + 1] = ((lo[1] + (hi[1] - lo[1]) * t) * 255) | 0;
      colors[n * 3 + 2] = ((lo[2] + (hi[2] - lo[2]) * t) * 255) | 0;
      n++;
    }
  }

  return { positions, colors, intensity };
}
