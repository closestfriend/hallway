/**
 * DEV FIXTURE — NOT AN ARTISTIC RESULT.
 *
 * This worker exists only so the renderer can be developed and verified when
 * no real capture is present at /assets/scene.ply. It is not a procedural
 * city for its own sake: it simulates the *capture process* of the reference
 * work (Street Cloud) — virtual panorama scanners standing on a street,
 * sampling an analytic urban scene through an equirectangular ray grid, with
 * per-pose registration error and range-dependent dropout.
 *
 * Because points are produced by simulated scanning rather than scattered
 * procedurally, the structural artifacts of real panorama+LiDAR data emerge
 * naturally: concentric ground rings around each scanner, occlusion shadows
 * behind objects, misaligned duplicate surfaces where panoramas overlap,
 * sparse grazing-angle sampling, and empty sky.
 *
 * Replace it with a real capture as soon as one is available — see
 * assets/README.md.
 */

interface Hit {
  t: number;
  nx: number; ny: number; nz: number;
  mat: number;   // 0 ground, 1 facade, 2 canopy, 3 trunk, 4 car
  obj: number;
  axis?: number; // which AABB slab was hit (facades only)
  sign?: number;
}

// ---------------------------------------------------------------- rng/noise
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// cheap deterministic hash noise for surface texture
function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ---------------------------------------------------------------- scene def
interface Box {
  cx: number; cz: number; hw: number; hd: number; h: number;
  albedo: [number, number, number];
  windowRatio: number;   // window cell fill fraction
  floorH: number;
  signColor: [number, number, number] | null;
  glassTint: number;     // 0 dark glass .. 1 bright reflective
}
interface Tree { x: number; z: number; trunkH: number; r: number }
interface Car { cx: number; cz: number; hw: number; hd: number; h: number; color: [number, number, number] }

const rng = mulberry32(1337);

const ROAD_HW = 4.6;        // road half width
const WALK_W = 3.4;         // sidewalk width
const FACADE_X = ROAD_HW + WALK_W; // building line

const palettes: [number, number, number][] = [
  [0.62, 0.58, 0.52], [0.55, 0.44, 0.38], [0.70, 0.67, 0.62], [0.48, 0.47, 0.46],
  [0.66, 0.60, 0.50], [0.42, 0.38, 0.36], [0.58, 0.55, 0.54], [0.72, 0.66, 0.58],
  [0.51, 0.42, 0.34], [0.63, 0.63, 0.60],
];
const signColors: [number, number, number][] = [
  [0.75, 0.15, 0.12], [0.85, 0.65, 0.10], [0.10, 0.35, 0.55], [0.15, 0.45, 0.25],
  [0.80, 0.78, 0.72], [0.55, 0.12, 0.30],
];

function buildScene() {
  const boxes: Box[] = [];
  const trees: Tree[] = [];
  const cars: Car[] = [];

  // Buildings along both sides of a street running in z, with a cross street
  // gap around z=0 (an intersection).
  for (const side of [-1, 1]) {
    let z = -78;
    while (z < 78) {
      const w = 7 + rng() * 9;          // frontage
      const zc = z + w / 2;
      z += w + (rng() < 0.18 ? 2.5 + rng() * 3 : 0.15); // occasional alley
      if (Math.abs(zc) < 9 + w / 2 && Math.abs(zc) > 0) {
        if (Math.abs(zc) < 8) continue;  // intersection gap
      }
      const depth = 10 + rng() * 8;
      const h = 7 + Math.pow(rng(), 1.6) * 26;
      boxes.push({
        cx: side * (FACADE_X + depth / 2 + rng() * 1.5),
        cz: zc,
        hw: depth / 2,
        hd: w / 2 - 0.05,
        h,
        albedo: palettes[(rng() * palettes.length) | 0],
        windowRatio: 0.35 + rng() * 0.3,
        floorH: 2.9 + rng() * 0.7,
        signColor: rng() < 0.55 ? signColors[(rng() * signColors.length) | 0] : null,
        glassTint: rng(),
      });
    }
  }
  // Cross-street buildings (so the intersection has facades in the distance).
  for (const side of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      const w = 8 + rng() * 8;
      const x = 12 + k * (w + 2) + rng() * 2;
      const h = 6 + Math.pow(rng(), 1.6) * 22;
      boxes.push({
        cx: (12 + k * (w + 3)) * (rng() < 0.5 ? 1 : -1) * 0 + (side < 0 ? -x - 6 : x + 6),
        cz: side * 0 + (rng() < 0.5 ? -1 : 1) * (FACADE_X + 6 + rng() * 6),
        hw: w / 2,
        hd: (10 + rng() * 6) / 2,
        h,
        albedo: palettes[(rng() * palettes.length) | 0],
        windowRatio: 0.3 + rng() * 0.35,
        floorH: 3 + rng() * 0.6,
        signColor: rng() < 0.4 ? signColors[(rng() * signColors.length) | 0] : null,
        glassTint: rng(),
      });
    }
  }

  // Street trees on both sidewalks, skipping the intersection.
  for (const side of [-1, 1]) {
    for (let z = -70; z < 70; z += 9 + rng() * 5) {
      if (Math.abs(z) < 11) continue;
      trees.push({ x: side * (ROAD_HW + 1.1), z: z + rng() * 2, trunkH: 2.6 + rng() * 1.4, r: 1.6 + rng() * 1.2 });
    }
  }

  // A few parked cars along the curb.
  for (let z = -60; z < 60; z += 10 + rng() * 14) {
    if (Math.abs(z) < 10 || rng() < 0.35) continue;
    const side = rng() < 0.5 ? -1 : 1;
    const c: [number, number, number][] = [
      [0.65, 0.66, 0.68], [0.12, 0.12, 0.14], [0.55, 0.08, 0.08], [0.72, 0.70, 0.64], [0.16, 0.22, 0.38],
    ];
    cars.push({ cx: side * (ROAD_HW - 1.0), cz: z, hw: 0.85, hd: 2.15, h: 1.45, color: c[(rng() * c.length) | 0] });
  }

  return { boxes, trees, cars };
}

// ------------------------------------------------------------ intersection
function rayBox(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number,
  cx: number, cz: number, hw: number, hd: number, h: number): { t: number; axis: number; sign: number } | null {
  // slab test against AABB [cx±hw, 0..h, cz±hd]
  let tmin = 0.02, tmax = Infinity, axis = -1, sign = 0;
  const bounds = [
    [cx - hw, cx + hw, ox, dx],
    [0, h, oy, dy],
    [cz - hd, cz + hd, oz, dz],
  ];
  for (let a = 0; a < 3; a++) {
    const [lo, hi, o, d] = bounds[a];
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return null; continue; }
    let t1 = (lo - o) / d, t2 = (hi - o) / d;
    let s = -1;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
    if (t1 > tmin) { tmin = t1; axis = a; sign = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (axis < 0) return null;
  return { t: tmin, axis, sign };
}

function raySphere(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number,
  cx: number, cy: number, cz: number, r: number): number {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const b = lx * dx + ly * dy + lz * dz;
  const c = lx * lx + ly * ly + lz * lz - r * r;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const t = b - Math.sqrt(disc);
  return t > 0.02 ? t : -1;
}

// ---------------------------------------------------------------- shading
// Returns an approximately photographic albedo for a hit point. This is the
// stand-in for real panorama pixel colors.
function shade(
  scene: ReturnType<typeof buildScene>, hit: Hit,
  x: number, y: number, z: number,
  out: [number, number, number],
): void {
  const noise = (hash2(x * 7.3 + z * 3.1, y * 5.7) - 0.5) * 0.05; // sensor noise
  let r = 0, g = 0, b = 0;

  if (hit.mat === 0) {
    // ground: asphalt / markings / sidewalk / crosswalk
    const ax = Math.abs(x);
    if (ax < ROAD_HW || Math.abs(z) < ROAD_HW) {
      // asphalt
      const grime = 0.16 + hash2(x * 0.8, z * 0.8) * 0.05;
      r = g = b = grime; b += 0.008;
      // center dashed line along z-street
      if (ax < 0.14 && Math.abs(z) > ROAD_HW && (((z + 200) % 4) < 2.2)) { r = g = 0.72; b = 0.55; }
      // crosswalk stripes at intersection edges
      const inCross = (Math.abs(Math.abs(z) - (ROAD_HW + 1.4)) < 1.2 && ax < ROAD_HW)
        || (Math.abs(ax - (ROAD_HW + 1.4)) < 1.2 && Math.abs(z) < ROAD_HW);
      if (inCross) {
        const stripe = ax < ROAD_HW ? Math.abs(x) : Math.abs(z);
        if ((stripe * 1.6) % 1.0 < 0.5) { r = g = b = 0.62; }
      }
      // curb-side gutter darkening
      if (ax > ROAD_HW - 0.5 && ax < ROAD_HW) { r *= 0.7; g *= 0.7; b *= 0.7; }
    } else {
      // sidewalk: concrete with expansion joints
      const c = 0.42 + hash2(x * 1.3, z * 1.3) * 0.06;
      r = g = b = c;
      if (((Math.abs(z) + 100) % 1.8) < 0.06 || ((ax + 100) % 1.8) < 0.06) { r = g = b = c * 0.65; }
    }
  } else if (hit.mat === 1) {
    // building facade
    const box = scene.boxes[hit.obj];
    const [ar, ag, ab] = box.albedo;
    // coordinates on the facade plane
    const u = hit.axis === 0 ? z - (box.cz - box.hd) : x - (box.cx - box.hw);
    const v = y;
    const floorI = v / box.floorH;
    const winU = (u / 2.2) % 1.0;
    const winV = floorI % 1.0;
    const isWindow = v > box.floorH * 0.9 && winU > 0.22 && winU < 0.22 + box.windowRatio * 0.9
      && winV > 0.25 && winV < 0.78 && v < box.h - 1.2;
    if (isWindow) {
      // glass: dark with a vertical sky-reflection gradient, occasional lit interior
      const sky = 0.10 + (v / box.h) * 0.22 * (0.4 + box.glassTint);
      const lit = hash2(Math.floor(u / 2.2) * 13.7, Math.floor(floorI) * 7.9) > 0.93;
      if (lit) { r = 0.75; g = 0.66; b = 0.42; }
      else { r = sky * 0.55; g = sky * 0.72; b = sky * 0.95; }
    } else if (v < box.floorH * 0.95) {
      // storefront band: darker, glassy
      const d = 0.14 + hash2(u * 2.1, v * 2.1) * 0.05;
      r = d; g = d * 1.05; b = d * 1.15;
      // signage strip above the storefront
    } else if (box.signColor && v > box.floorH * 0.95 && v < box.floorH * 0.95 + 0.8) {
      [r, g, b] = box.signColor;
      r *= 0.9 + hash2(u * 5, v * 5) * 0.2;
    } else {
      // wall: albedo with grime gradient and per-brick variation
      const grime = 0.7 + Math.min(1, v / 6) * 0.3;
      const varn = 0.9 + hash2(Math.floor(u * 3) * 1.7, Math.floor(v * 3) * 2.3) * 0.2;
      r = ar * grime * varn; g = ag * grime * varn; b = ab * grime * varn;
      // floor slab lines
      if (winV < 0.06) { r *= 0.75; g *= 0.75; b *= 0.75; }
    }
    // roofline weathering
    if (hit.ny > 0.5) { r = 0.28; g = 0.27; b = 0.26; }
    // north/south faces get slightly different exposure, like sun direction
    const face = hit.axis === 0 ? (x > box.cx ? 1 : 0) : 0;
    const exposure = 0.88 + face * 0.18;
    r *= exposure; g *= exposure; b *= exposure * 0.98;
  } else if (hit.mat === 2) {
    // tree canopy: dark porous green with luminance speckle
    const l = 0.5 + hash2(x * 9.1, (y + z) * 9.7) * 0.9;
    r = 0.10 * l; g = 0.16 * l; b = 0.07 * l;
  } else if (hit.mat === 3) {
    // trunk
    r = 0.20; g = 0.15; b = 0.11;
  } else if (hit.mat === 4) {
    const car = scene.cars[hit.obj];
    [r, g, b] = car.color;
    if (hit.ny > 0.5) { r *= 1.15; g *= 1.15; b *= 1.15; } // roof catches sky
    if (y < 0.35) { r *= 0.4; g *= 0.4; b *= 0.4; }        // wheels/shadow band
  }

  out[0] = Math.max(0, Math.min(1, r + noise));
  out[1] = Math.max(0, Math.min(1, g + noise));
  out[2] = Math.max(0, Math.min(1, b + noise));
}

// ------------------------------------------------------------------ scan
self.onmessage = (e: MessageEvent<{ raysAz: number; raysEl: number }>) => {
  const { raysAz, raysEl } = e.data;
  const scene = buildScene();

  // Panorama capture poses along the street, like a mapping car stopping
  // every ~15 m. Each pose gets a small registration error so overlapping
  // panoramas produce visibly duplicated, slightly shifted surfaces.
  const poses: { x: number; y: number; z: number; yawErr: number; ox: number; oz: number }[] = [];
  const poseRng = mulberry32(99);
  for (let i = 0; i < 7; i++) {
    const z = -45 + i * 15;
    poses.push({
      x: (poseRng() - 0.5) * 2.2,
      y: 2.45,
      z,
      yawErr: (poseRng() - 0.5) * 0.012,          // ~0.7 deg yaw misregistration
      ox: (poseRng() - 0.5) * 0.35,               // translation error
      oz: (poseRng() - 0.5) * 0.35,
    });
  }

  const MAX_RANGE = 65;
  const capacity = poses.length * raysAz * raysEl;
  const positions = new Float32Array(capacity * 3);
  const colors = new Uint8Array(capacity * 3);
  const confidence = new Float32Array(capacity);
  const viewId = new Uint16Array(capacity);
  let n = 0;

  const color: [number, number, number] = [0, 0, 0];
  const elMin = -1.25, elMax = 0.95; // radians; scanners see mostly down/level
  const dropRng = mulberry32(4242);

  for (let p = 0; p < poses.length; p++) {
    const pose = poses[p];
    for (let ia = 0; ia < raysAz; ia++) {
      const az = (ia / raysAz) * Math.PI * 2 + pose.yawErr;
      for (let ie = 0; ie < raysEl; ie++) {
        const el = elMin + (ie / (raysEl - 1)) * (elMax - elMin);
        const ce = Math.cos(el);
        const dx = ce * Math.sin(az), dy = Math.sin(el), dz = ce * Math.cos(az);

        // trace against ground, boxes, trees, cars — keep nearest hit
        let best: Hit | null = null;
        if (dy < -1e-4) {
          const t = -pose.y / dy;
          if (t < MAX_RANGE) best = { t, nx: 0, ny: 1, nz: 0, mat: 0, obj: -1 };
        }
        for (let bIdx = 0; bIdx < scene.boxes.length; bIdx++) {
          const bx = scene.boxes[bIdx];
          const h = rayBox(pose.x, pose.y, pose.z, dx, dy, dz, bx.cx, bx.cz, bx.hw, bx.hd, bx.h);
          if (h && h.t < (best?.t ?? MAX_RANGE)) {
            const nx = h.axis === 0 ? -Math.sign(dx) : 0;
            const ny = h.axis === 1 ? -Math.sign(dy) : 0;
            const nz = h.axis === 2 ? -Math.sign(dz) : 0;
            best = { t: h.t, nx, ny, nz, mat: 1, obj: bIdx, axis: h.axis, sign: h.sign };
          }
        }
        for (let tIdx = 0; tIdx < scene.trees.length; tIdx++) {
          const tr = scene.trees[tIdx];
          const tc = raySphere(pose.x, pose.y, pose.z, dx, dy, dz, tr.x, tr.trunkH + tr.r * 0.7, tr.z, tr.r);
          // canopy is porous: most rays pass through
          if (tc > 0 && tc < (best?.t ?? MAX_RANGE) && dropRng() < 0.4) {
            best = { t: tc, nx: 0, ny: 1, nz: 0, mat: 2, obj: tIdx };
          }
          // crude trunk: thin vertical box
          const th = rayBox(pose.x, pose.y, pose.z, dx, dy, dz, tr.x, tr.z, 0.12, 0.12, tr.trunkH);
          if (th && th.t < (best?.t ?? MAX_RANGE)) {
            best = { t: th.t, nx: 0, ny: 0, nz: 0, mat: 3, obj: tIdx };
          }
        }
        for (let cIdx = 0; cIdx < scene.cars.length; cIdx++) {
          const car = scene.cars[cIdx];
          const h = rayBox(pose.x, pose.y, pose.z, dx, dy, dz, car.cx, car.cz, car.hw, car.hd, car.h);
          if (h && h.t < (best?.t ?? MAX_RANGE)) {
            best = { t: h.t, nx: 0, ny: h.axis === 1 ? 1 : 0, nz: 0, mat: 4, obj: cIdx };
          }
        }
        if (!best) continue; // sky: no return, no point — holes are real

        // range-dependent dropout: distant and grazing surfaces sample sparsely
        const rangeFrac = best.t / MAX_RANGE;
        if (dropRng() < rangeFrac * rangeFrac * 0.85) continue;

        // depth noise grows with range (time-of-flight uncertainty)
        const depthNoise = (dropRng() - 0.5) * (0.02 + rangeFrac * 0.22);
        const t = best.t + depthNoise;

        // world position, including this pose's registration error so
        // overlapping panoramas disagree slightly
        const x = pose.x + pose.ox + dx * t;
        const y = pose.y + dy * t;
        const z = pose.z + pose.oz + dz * t;
        if (y < -0.4) continue;

        shade(scene, best, x, y, z, color);

        positions[n * 3] = x; positions[n * 3 + 1] = y; positions[n * 3 + 2] = z;
        colors[n * 3] = (color[0] * 255) | 0;
        colors[n * 3 + 1] = (color[1] * 255) | 0;
        colors[n * 3 + 2] = (color[2] * 255) | 0;
        confidence[n] = Math.max(0.05, 1 - rangeFrac);
        viewId[n] = p;
        n++;
      }
    }
    (self as unknown as Worker).postMessage({ progress: (p + 1) / poses.length });
  }

  const result = {
    positions: positions.slice(0, n * 3),
    colors: colors.slice(0, n * 3),
    confidence: confidence.slice(0, n),
    viewId: viewId.slice(0, n),
    scanOrigins: poses.map((p) => [p.x, p.y, p.z] as [number, number, number]),
    count: n,
  };
  (self as unknown as Worker).postMessage(result, [
    result.positions.buffer, result.colors.buffer, result.confidence.buffer, result.viewId.buffer,
  ]);
};
