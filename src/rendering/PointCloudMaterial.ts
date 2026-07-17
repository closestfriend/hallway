import * as THREE from 'three';
import vertexShader from './shaders/point.vert.glsl?raw';
import fragmentShader from './shaders/point.frag.glsl?raw';

export const MAX_SCAN_ORIGINS = 8;

/**
 * Custom ShaderMaterial for the reconstruction splats. All artistic
 * parameters live in uniforms so the ArtifactController and ControlPanel can
 * drive them per-frame without touching geometry.
 */
export function createPointCloudMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    // Alpha blending (not additive): points must be able to be DARK.
    transparent: true,
    blending: THREE.NormalBlending,
    // Depth-tested but not depth-written: overlapping translucent splats
    // otherwise punch rectangular holes in each other.
    depthTest: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uPointSize: { value: 2.2 },
      uDensity: { value: 1.0 },
      uOpacity: { value: 0.85 },
      uJitter: { value: 0.0 },
      uMissing: { value: 0.12 },
      uDepthQuant: { value: 0.0 },
      uLayerSep: { value: 0.06 },
      uScanRing: { value: 0.45 },
      uRingSpacing: { value: 1.4 },
      uWedge: { value: 0.15 },
      uRevealSpeed: { value: 0.0 },
      uDecaySpeed: { value: 0.0 },
      uConfidenceCull: { value: 0.0 },
      uSizeAttenuation: { value: 60.0 },
      uSaturation: { value: 0.95 },
      uDepthFadeStart: { value: 40.0 },
      uDepthFadeEnd: { value: 160.0 },
      uScanOrigins: { value: Array.from({ length: MAX_SCAN_ORIGINS }, () => new THREE.Vector3()) },
      uScanOriginCount: { value: 1 },
    },
  });
}
