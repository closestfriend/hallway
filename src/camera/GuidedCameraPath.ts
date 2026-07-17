import * as THREE from 'three';
import type { BoundingBox } from '../data/SpatialScene';
import { boundsCenter, boundsSize } from '../utils/bounds';

/**
 * Guided mode: the camera follows a slow authored loop through the scene —
 * low passes along the street, rises to look across rooftops, descends back
 * in. The look target leads the camera along the path with a lateral sway so
 * parallax between reconstruction layers stays visible.
 */
export class GuidedCameraPath {
  private curve: THREE.CatmullRomCurve3;
  private lookCurve: THREE.CatmullRomCurve3;
  private t = 0;
  /** seconds for a full loop at speed 1 */
  private loopDuration = 150;
  travelSpeed = 1;

  constructor(bounds: BoundingBox, scanOrigins?: Array<[number, number, number]>) {
    const c = boundsCenter(bounds);
    const s = boundsSize(bounds);
    const ex = Math.max(s.x, 20) * 0.32;
    const ez = Math.max(s.z, 20) * 0.38;
    const eyeLow = c.y - s.y / 2 + Math.min(4, s.y * 0.2);
    const eyeHigh = c.y - s.y / 2 + Math.min(s.y * 0.85, 28);

    // If the capture told us where the scanners stood, thread the path near
    // those origins — that is where the data is densest and most legible.
    const anchors: THREE.Vector3[] = scanOrigins?.length
      ? scanOrigins.map(([x, y, z]) => new THREE.Vector3(x, y + 1.2, z))
      : [];

    const pts: THREE.Vector3[] = anchors.length >= 3
      ? [
          anchors[0].clone().add(new THREE.Vector3(ex * 0.3, 1, 0)),
          anchors[Math.floor(anchors.length / 2)].clone().add(new THREE.Vector3(-ex * 0.35, 2.5, 0)),
          anchors[anchors.length - 1].clone().add(new THREE.Vector3(ex * 0.2, 1.5, 0)),
          new THREE.Vector3(c.x + ex, eyeHigh, c.z + ez * 0.4),
          new THREE.Vector3(c.x - ex * 0.6, eyeHigh * 0.8, c.z - ez * 0.7),
        ]
      : [
          new THREE.Vector3(c.x - ex, eyeLow, c.z - ez),
          new THREE.Vector3(c.x + ex * 0.4, eyeLow + 1.5, c.z - ez * 0.3),
          new THREE.Vector3(c.x + ex, eyeLow + 1, c.z + ez * 0.5),
          new THREE.Vector3(c.x + ex * 0.2, eyeHigh, c.z + ez),
          new THREE.Vector3(c.x - ex * 0.7, eyeHigh * 0.85, c.z + ez * 0.2),
        ];

    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.9);

    // look target: same loop shifted ahead and pulled toward the center line
    const lookPts = pts.map((p) => new THREE.Vector3(
      THREE.MathUtils.lerp(p.x, c.x, 0.6),
      Math.max(p.y - 1, eyeLow + 0.5),
      THREE.MathUtils.lerp(p.z, c.z, 0.6),
    ));
    this.lookCurve = new THREE.CatmullRomCurve3(lookPts, true, 'centripetal', 0.9);
  }

  update(dt: number, camera: THREE.PerspectiveCamera): void {
    this.t = (this.t + (dt * this.travelSpeed) / this.loopDuration) % 1;
    const pos = this.curve.getPointAt(this.t);
    // look ahead of the current position; parallax comes from motion itself
    const look = this.lookCurve.getPointAt((this.t + 0.045) % 1);

    // heavy damping toward the path so mode switches never snap
    const k = 1 - Math.exp(-dt * 1.6);
    camera.position.lerp(pos, k);
    const current = new THREE.Vector3();
    camera.getWorldDirection(current).multiplyScalar(10).add(camera.position);
    current.lerp(look, k);
    camera.lookAt(current);
  }
}
