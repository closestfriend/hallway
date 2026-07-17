import * as THREE from 'three';
import type { SpatialScene } from '../data/SpatialScene';
import { pointCount } from '../data/SpatialScene';
import { createPointCloudMaterial, MAX_SCAN_ORIGINS } from './PointCloudMaterial';
import { disposeObject } from '../utils/dispose';

/**
 * Owns the GPU representation of a SpatialScene: one THREE.Points with a
 * custom shader. Buffers are uploaded once and never rewritten — every
 * visual artifact is a uniform, so the source data stays intact.
 */
export class PointCloudRenderer {
  readonly object = new THREE.Group();
  readonly material = createPointCloudMaterial();
  private points: THREE.Points | null = null;
  private count = 0;

  setScene(scene: SpatialScene): void {
    this.clear();
    const n = pointCount(scene);
    this.count = n;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(scene.positions, 3));

    // colors: keep Uint8 on the GPU (normalized) to save memory
    if (scene.colors instanceof Uint8Array) {
      geometry.setAttribute('aColor', new THREE.BufferAttribute(scene.colors, 3, true));
    } else {
      geometry.setAttribute('aColor', new THREE.BufferAttribute(scene.colors, 3));
    }

    const confidence = scene.confidence ?? new Float32Array(n).fill(1);
    geometry.setAttribute('aConfidence', new THREE.BufferAttribute(confidence, 1));

    const viewId = new Float32Array(n);
    if (scene.sourceViewId) for (let i = 0; i < n; i++) viewId[i] = scene.sourceViewId[i];
    geometry.setAttribute('aViewId', new THREE.BufferAttribute(viewId, 1));

    // stable per-point random, used for density culling, jitter, reveal order
    const rand = new Float32Array(n);
    let s = 1234567;
    for (let i = 0; i < n; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      rand[i] = s / 4294967296;
    }
    geometry.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));

    const min = new THREE.Vector3(...scene.bounds.min);
    const max = new THREE.Vector3(...scene.bounds.max);
    geometry.boundingBox = new THREE.Box3(min, max);
    geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());

    // scan origins for the artifact system — real ones if the source knows
    // them, otherwise a plausible origin at the center of the bounds at
    // eye height
    const origins = scene.scanOrigins?.length
      ? scene.scanOrigins
      : [[(min.x + max.x) / 2, min.y + 1.7, (min.z + max.z) / 2] as [number, number, number]];
    const uOrigins = this.material.uniforms.uScanOrigins.value as THREE.Vector3[];
    const m = Math.min(origins.length, MAX_SCAN_ORIGINS);
    for (let i = 0; i < m; i++) uOrigins[i].set(...origins[i]);
    this.material.uniforms.uScanOriginCount.value = m;

    this.points = new THREE.Points(geometry, this.material);
    // The vertex shader displaces points (layer separation, jitter); expand
    // culling bounds slightly so edge points don't pop at the frustum.
    this.points.frustumCulled = true;
    geometry.boundingSphere.radius *= 1.15;
    this.object.add(this.points);
  }

  get pointTotal(): number {
    return this.count;
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }

  clear(): void {
    if (this.points) {
      this.object.remove(this.points);
      this.points.geometry.dispose();
      this.points = null;
    }
  }

  dispose(): void {
    this.clear();
    disposeObject(this.object);
    this.material.dispose();
  }
}
