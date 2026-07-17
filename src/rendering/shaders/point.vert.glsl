// Point vertex shader — all reconstruction artifacts are applied here, on the
// GPU, from the ORIGINAL point data. Nothing is destroyed: every artifact is a
// uniform-driven, reversible transform of the same buffers.

precision highp float;

// three.js provides: position, modelViewMatrix, projectionMatrix, cameraPosition
attribute vec3 aColor;        // 0..1
attribute float aConfidence;  // 0..1
attribute float aViewId;      // capture/panorama index
attribute float aRand;        // stable per-point hash, 0..1

uniform float uTime;
uniform float uPointSize;
uniform float uDensity;          // fraction of points kept
uniform float uJitter;           // random displacement (world units)
uniform float uMissing;          // structured missing-data fraction
uniform float uDepthQuant;       // depth band size (0 = off)
uniform float uLayerSep;         // separation between source-view layers
uniform float uScanRing;         // scan ring modulation strength
uniform float uRingSpacing;      // metres between rings
uniform float uWedge;            // missing angular wedge amount
uniform float uRevealSpeed;      // temporal accumulation speed (0 = everything visible)
uniform float uDecaySpeed;       // temporal decay speed (0 = off)
uniform float uConfidenceCull;   // hide points below this confidence
uniform float uSizeAttenuation;  // reference distance for size falloff

// up to 8 scanner origins; artifacts anchor to the nearest one
uniform vec3 uScanOrigins[8];
uniform int uScanOriginCount;

varying vec3 vColor;
varying float vAlpha;
varying float vViewDist;

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

void main() {
  vColor = aColor;
  float kill = 0.0;

  // ---- density: stable random subset, so lowering density thins uniformly
  if (aRand > uDensity) kill = 1.0;
  if (aConfidence < uConfidenceCull) kill = 1.0;

  // ---- find the nearest scanner origin: rings, wedges and depth bands are
  // anchored to capture positions, not to the camera, so they read as
  // properties of the DATA rather than a screen effect.
  vec3 origin = uScanOrigins[0];
  float scanDist = distance(position, origin);
  for (int i = 1; i < 8; i++) {
    if (i >= uScanOriginCount) break;
    float d = distance(position, uScanOrigins[i]);
    if (d < scanDist) { scanDist = d; origin = uScanOrigins[i]; }
  }
  vec3 fromScan = position - origin;

  // ---- structured missing data: drop contiguous angular/radial cells, not
  // individual random points. Cells are defined in scanner-space.
  float az = atan(fromScan.z, fromScan.x);
  float cellId = floor(az * 9.549) * 57.0 + floor(scanDist / 3.0); // ~9.5 cells/rad
  if (hash(cellId + aViewId * 91.7) < uMissing) kill = 1.0;

  // ---- missing wedge: an angular sector of the panorama never captured
  float wedgePhase = fract(az / 6.2831853 + aViewId * 0.37);
  if (wedgePhase < uWedge * 0.22) kill = 1.0;

  // ---- temporal accumulation: points appear in a per-point random order,
  // as if the reconstruction is still streaming in
  if (uRevealSpeed > 0.0) {
    float revealAt = aRand * 22.0 + aViewId * 1.7;
    float lead = uTime * uRevealSpeed - revealAt;
    if (lead < 0.0) kill = 1.0;
    // brief pop-in emphasis while a point is young
    vAlpha = clamp(lead * 2.0, 0.0, 1.0);
  } else {
    vAlpha = 1.0;
  }

  // ---- temporal decay: previously seen regions thin out again, cyclically,
  // so no data is ever permanently lost
  if (uDecaySpeed > 0.0) {
    float phase = fract(aRand + uTime * uDecaySpeed * 0.05);
    float gone = smoothstep(0.75, 0.85, phase) * (1.0 - smoothstep(0.95, 1.0, phase));
    if (gone > 0.5) kill = 1.0;
    vAlpha *= 1.0 - gone * 0.6;
  }

  // ---- depth quantization: snap the range from the scanner into bands.
  // Surfaces collapse onto concentric shells — the "thin cardboard" look.
  vec3 p = position;
  if (uDepthQuant > 0.001) {
    float r = length(fromScan);
    float rq = (floor(r / uDepthQuant) + 0.5) * uDepthQuant;
    p = origin + fromScan * (rq / max(r, 1e-4));
  }

  // ---- source-view layer separation: each panorama's points drift apart
  // slightly, oscillating so layers separate and recombine over time
  float layerPhase = aViewId * 2.399; // golden-angle spread
  vec3 layerDir = vec3(cos(layerPhase), 0.12, sin(layerPhase));
  p += layerDir * uLayerSep * (0.35 + 0.65 * sin(uTime * 0.21 + aViewId * 1.3));

  // ---- controlled jitter: small stable displacement, plus a slow breathing
  // component so the cloud never feels frozen
  vec3 jdir = normalize(vec3(hash(aRand * 311.0) - 0.5,
                             hash(aRand * 173.0) - 0.5,
                             hash(aRand * 419.0) - 0.5) + 1e-4);
  p += jdir * uJitter * (0.6 + 0.4 * sin(uTime * 0.4 + aRand * 6.2831));

  // ---- scan rings: alpha/size modulation in bands of constant scanner range
  float ring = 1.0;
  if (uScanRing > 0.001) {
    float band = fract(scanDist / uRingSpacing);
    // asymmetric pulse: thin bright line, wide dim gap — like LiDAR beam rows
    ring = 1.0 - uScanRing * smoothstep(0.12, 0.5, band) * smoothstep(1.0, 0.55, band);
  }
  vAlpha *= ring;

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  vViewDist = -mvPosition.z;

  // perspective size attenuation with confidence weighting: low-confidence
  // points render smaller and dimmer rather than being deleted
  float conf = mix(0.55, 1.0, aConfidence);
  gl_PointSize = uPointSize * conf * ring * (uSizeAttenuation / max(vViewDist, 0.1));
  gl_PointSize = clamp(gl_PointSize, 0.0, 24.0);
  vAlpha *= conf;

  if (kill > 0.5) {
    // move culled points behind the camera; cheaper than degenerate clipping
    gl_Position = vec4(0.0, 0.0, 2.0, 0.0);
    gl_PointSize = 0.0;
  } else {
    gl_Position = projectionMatrix * mvPosition;
  }
}
