/**
 * Worker: parses a colored PLY file (ascii or binary_little_endian) into
 * typed arrays without blocking the main thread. Supports the common
 * photogrammetry/scan export layout: per-vertex x/y/z plus red/green/blue,
 * with optional confidence / quality / intensity / scalar fields.
 */

type PlyType =
  | 'char' | 'uchar' | 'int8' | 'uint8'
  | 'short' | 'ushort' | 'int16' | 'uint16'
  | 'int' | 'uint' | 'int32' | 'uint32'
  | 'float' | 'float32' | 'double' | 'float64';

const TYPE_SIZE: Record<PlyType, number> = {
  char: 1, uchar: 1, int8: 1, uint8: 1,
  short: 2, ushort: 2, int16: 2, uint16: 2,
  int: 4, uint: 4, int32: 4, uint32: 4,
  float: 4, float32: 4, double: 8, float64: 8,
};

interface Property { name: string; type: PlyType; offset: number }

self.onmessage = (e: MessageEvent<{ buffer: ArrayBuffer }>) => {
  try {
    const result = parse(e.data.buffer);
    (self as unknown as Worker).postMessage(
      result,
      [result.positions.buffer, result.colors.buffer,
       ...(result.confidence ? [result.confidence.buffer] : []),
       ...(result.intensity ? [result.intensity.buffer] : [])],
    );
  } catch (err) {
    (self as unknown as Worker).postMessage({ error: String(err) });
  }
};

function parse(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  // Locate 'end_header\n' in the raw bytes.
  const headerEnd = findHeaderEnd(bytes);
  const header = new TextDecoder().decode(bytes.subarray(0, headerEnd));
  const lines = header.split(/\r?\n/);

  let format = '';
  let vertexCount = 0;
  let inVertexElement = false;
  const props: Property[] = [];
  let stride = 0;

  for (const line of lines) {
    const t = line.trim().split(/\s+/);
    if (t[0] === 'format') format = t[1];
    else if (t[0] === 'element') {
      inVertexElement = t[1] === 'vertex';
      if (inVertexElement) vertexCount = parseInt(t[2], 10);
    } else if (t[0] === 'property' && inVertexElement) {
      if (t[1] === 'list') throw new Error('list properties on vertex element are not supported');
      const type = t[1] as PlyType;
      props.push({ name: t[2], type, offset: stride });
      stride += TYPE_SIZE[type];
    }
  }
  if (!vertexCount) throw new Error('PLY has no vertex element');

  const find = (...names: string[]) => props.find((p) => names.includes(p.name));
  const px = find('x'), py = find('y'), pz = find('z');
  const pr = find('red', 'r', 'diffuse_red');
  const pg = find('green', 'g', 'diffuse_green');
  const pb = find('blue', 'b', 'diffuse_blue');
  const pc = find('confidence', 'quality', 'scalar_confidence');
  const pi = find('intensity', 'scalar_intensity');
  if (!px || !py || !pz) throw new Error('PLY is missing x/y/z');

  const positions = new Float32Array(vertexCount * 3);
  const colors = new Uint8Array(vertexCount * 3);
  const confidence = pc ? new Float32Array(vertexCount) : undefined;
  const intensity = pi ? new Float32Array(vertexCount) : undefined;
  const hasColor = !!(pr && pg && pb);

  if (format === 'ascii') {
    const body = new TextDecoder().decode(bytes.subarray(headerEnd));
    const propIndex = new Map(props.map((p, i) => [p.name, i] as const));
    const idx = (p?: Property) => (p ? propIndex.get(p.name)! : -1);
    const rows = body.split(/\r?\n/);
    let v = 0;
    for (const row of rows) {
      if (v >= vertexCount) break;
      const s = row.trim();
      if (!s) continue;
      const f = s.split(/\s+/).map(Number);
      positions[v * 3] = f[idx(px)];
      positions[v * 3 + 1] = f[idx(py)];
      positions[v * 3 + 2] = f[idx(pz)];
      if (hasColor) {
        colors[v * 3] = clamp255(f[idx(pr)], pr!.type);
        colors[v * 3 + 1] = clamp255(f[idx(pg)], pg!.type);
        colors[v * 3 + 2] = clamp255(f[idx(pb)], pb!.type);
      } else colors.fill(200, v * 3, v * 3 + 3);
      if (confidence) confidence[v] = f[idx(pc)];
      if (intensity) intensity[v] = f[idx(pi)];
      v++;
    }
  } else if (format === 'binary_little_endian') {
    const dv = new DataView(buffer, headerEnd);
    for (let v = 0; v < vertexCount; v++) {
      const base = v * stride;
      positions[v * 3] = readAs(dv, base + px.offset, px.type);
      positions[v * 3 + 1] = readAs(dv, base + py.offset, py.type);
      positions[v * 3 + 2] = readAs(dv, base + pz.offset, pz.type);
      if (hasColor) {
        colors[v * 3] = clamp255(readAs(dv, base + pr!.offset, pr!.type), pr!.type);
        colors[v * 3 + 1] = clamp255(readAs(dv, base + pg!.offset, pg!.type), pg!.type);
        colors[v * 3 + 2] = clamp255(readAs(dv, base + pb!.offset, pb!.type), pb!.type);
      } else colors.fill(200, v * 3, v * 3 + 3);
      if (confidence) confidence[v] = readAs(dv, base + pc!.offset, pc!.type);
      if (intensity) intensity[v] = readAs(dv, base + pi!.offset, pi!.type);
    }
  } else {
    throw new Error(`unsupported PLY format '${format}' (use ascii or binary_little_endian)`);
  }

  return { positions, colors, confidence, intensity, count: vertexCount };
}

function findHeaderEnd(bytes: Uint8Array): number {
  const needle = 'end_header';
  const limit = Math.min(bytes.length, 64 * 1024);
  for (let i = 0; i < limit - needle.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle.charCodeAt(j)) { ok = false; break; }
    }
    if (ok) {
      // consume through the newline after end_header
      let k = i + needle.length;
      while (k < bytes.length && bytes[k] !== 0x0a) k++;
      return k + 1;
    }
  }
  throw new Error('not a PLY file (no end_header found)');
}

function readAs(dv: DataView, off: number, type: PlyType): number {
  switch (type) {
    case 'char': case 'int8': return dv.getInt8(off);
    case 'uchar': case 'uint8': return dv.getUint8(off);
    case 'short': case 'int16': return dv.getInt16(off, true);
    case 'ushort': case 'uint16': return dv.getUint16(off, true);
    case 'int': case 'int32': return dv.getInt32(off, true);
    case 'uint': case 'uint32': return dv.getUint32(off, true);
    case 'float': case 'float32': return dv.getFloat32(off, true);
    case 'double': case 'float64': return dv.getFloat64(off, true);
  }
}

function clamp255(v: number, type: PlyType): number {
  // float color channels are usually 0..1; integer channels already 0..255
  const scaled = type === 'float' || type === 'float32' || type === 'double' || type === 'float64' ? v * 255 : v;
  return Math.max(0, Math.min(255, Math.round(scaled)));
}
