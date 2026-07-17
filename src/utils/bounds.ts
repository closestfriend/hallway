import * as THREE from 'three';
import type { BoundingBox } from '../data/SpatialScene';

export function boundsCenter(b: BoundingBox): THREE.Vector3 {
  return new THREE.Vector3(
    (b.min[0] + b.max[0]) / 2,
    (b.min[1] + b.max[1]) / 2,
    (b.min[2] + b.max[2]) / 2,
  );
}

export function boundsSize(b: BoundingBox): THREE.Vector3 {
  return new THREE.Vector3(
    b.max[0] - b.min[0],
    b.max[1] - b.min[1],
    b.max[2] - b.min[2],
  );
}

export function boundsRadius(b: BoundingBox): number {
  return boundsSize(b).length() / 2;
}
