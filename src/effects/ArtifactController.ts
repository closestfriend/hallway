import type * as THREE from 'three';

/**
 * The full set of artistic/reconstruction parameters. This is the single
 * source of truth: the control panel edits this object, and apply() maps it
 * onto shader uniforms every frame. Nothing here mutates point data.
 */
export interface ArtifactParams {
  pointSize: number;
  density: number;          // 0..1 fraction of points rendered
  opacity: number;
  saturation: number;
  background: number;       // 0..0.15 background brightness
  depthFade: number;        // 0..1, how strongly distance fades points

  jitter: number;           // world-unit random displacement
  scanRing: number;         // 0..1 ring modulation strength
  ringSpacing: number;      // metres between rings
  missing: number;          // 0..1 structured missing-data fraction
  wedge: number;            // 0..1 missing angular sector amount
  depthQuant: number;       // 0..1.5 metres depth band size
  layerSep: number;         // 0..1 metres source-view layer separation

  revealSpeed: number;      // 0 = off
  decaySpeed: number;       // 0 = off
}

export const DEFAULT_PARAMS: ArtifactParams = {
  pointSize: 2.3,
  density: 1.0,
  opacity: 0.9,
  saturation: 0.95,
  background: 0.016,
  depthFade: 0.5,

  jitter: 0.015,
  scanRing: 0.5,
  ringSpacing: 1.3,
  missing: 0.14,
  wedge: 0.12,
  depthQuant: 0.0,
  layerSep: 0.08,

  revealSpeed: 0,
  decaySpeed: 0,
};

/** A heavier, more broken preset used by the 'reconstruction' macro slider. */
export function applyIntensity(p: ArtifactParams, intensity: number): void {
  // one macro knob that scales the whole artifact family coherently
  p.scanRing = 0.25 + intensity * 0.65;
  p.missing = 0.05 + intensity * 0.45;
  p.wedge = intensity * 0.3;
  p.depthQuant = intensity < 0.35 ? 0 : (intensity - 0.35) * 1.4;
  p.layerSep = 0.03 + intensity * 0.5;
  p.jitter = 0.005 + intensity * 0.09;
}

export class ArtifactController {
  constructor(
    readonly params: ArtifactParams,
    private material: THREE.ShaderMaterial,
    /** scene diagonal radius, used to scale depth-fade distances */
    private sceneRadius = 100,
  ) {}

  setSceneRadius(r: number): void {
    this.sceneRadius = r;
  }

  /** Push params into uniforms. Called once per frame; cheap. */
  apply(qualityScale = 1): void {
    const u = this.material.uniforms;
    const p = this.params;
    u.uPointSize.value = p.pointSize;
    u.uDensity.value = p.density * qualityScale;
    u.uOpacity.value = p.opacity;
    u.uSaturation.value = p.saturation;
    u.uJitter.value = p.jitter;
    u.uScanRing.value = p.scanRing;
    u.uRingSpacing.value = Math.max(0.2, p.ringSpacing);
    u.uMissing.value = p.missing;
    u.uWedge.value = p.wedge;
    u.uDepthQuant.value = p.depthQuant;
    u.uLayerSep.value = p.layerSep;
    u.uRevealSpeed.value = p.revealSpeed;
    u.uDecaySpeed.value = p.decaySpeed;
    // depth fade window derived from scene scale: fade begins mid-scene and
    // never fully erases the far field
    const fadeStrength = Math.max(0.001, p.depthFade);
    u.uDepthFadeStart.value = this.sceneRadius * (1.4 - fadeStrength);
    u.uDepthFadeEnd.value = this.sceneRadius * (3.2 - fadeStrength * 1.6);
  }
}
