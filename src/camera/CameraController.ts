import * as THREE from 'three';

/**
 * Explore-mode camera: a heavily damped orbit/pan/dolly rig with a slow
 * autonomous drift. Deliberately NOT a game controller — there is no WASD,
 * no instantaneous response; every input is filtered through critically
 * damped smoothing so movement stays observational.
 */
export class CameraController {
  target = new THREE.Vector3();
  distance = 40;
  azimuth = 0.6;
  polar = 1.15; // from +Y axis

  /** autonomous drift speed multiplier (0..2), user-adjustable */
  travelSpeed = 1;
  enabled = true;

  // smoothed (rendered) state trails the goal state
  private sTarget = new THREE.Vector3();
  private sDistance = 40;
  private sAzimuth = 0.6;
  private sPolar = 1.15;

  private dragging = false;
  private panning = false;
  private lastX = 0;
  private lastY = 0;
  private disposeFns: Array<() => void> = [];

  constructor(private camera: THREE.PerspectiveCamera, dom: HTMLElement) {
    const on = (el: HTMLElement | Window, type: string, fn: (e: any) => void) => {
      el.addEventListener(type, fn as EventListener, { passive: false });
      this.disposeFns.push(() => el.removeEventListener(type, fn as EventListener));
    };

    on(dom, 'pointerdown', (e: PointerEvent) => {
      if (!this.enabled) return;
      this.dragging = true;
      this.panning = e.button === 2 || e.shiftKey;
      this.lastX = e.clientX; this.lastY = e.clientY;
      dom.setPointerCapture(e.pointerId);
    });
    on(dom, 'pointermove', (e: PointerEvent) => {
      if (!this.dragging || !this.enabled) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX; this.lastY = e.clientY;
      if (this.panning) {
        // pan in the camera's screen plane, scaled by distance
        const scale = this.sDistance * 0.0016;
        const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
        this.target.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
      } else {
        this.azimuth -= dx * 0.0035;
        this.polar = THREE.MathUtils.clamp(this.polar - dy * 0.0028, 0.15, 1.52);
      }
    });
    on(dom, 'pointerup', (e: PointerEvent) => {
      this.dragging = false;
      dom.releasePointerCapture(e.pointerId);
    });
    on(dom, 'wheel', (e: WheelEvent) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.distance = THREE.MathUtils.clamp(this.distance * Math.exp(e.deltaY * 0.0011), 3, 400);
    });
    on(dom, 'contextmenu', (e: Event) => e.preventDefault());
  }

  /** Snap both goal and smoothed state (used when framing a new scene). */
  jumpTo(target: THREE.Vector3, distance: number, azimuth = 0.6, polar = 1.1): void {
    this.target.copy(target); this.sTarget.copy(target);
    this.distance = distance; this.sDistance = distance;
    this.azimuth = azimuth; this.sAzimuth = azimuth;
    this.polar = polar; this.sPolar = polar;
  }

  update(dt: number, time: number): void {
    if (this.enabled && !this.dragging) {
      // slow autonomous drift: gentle orbit plus a breathing dolly so layers
      // and holes shift relative to each other even when the user is idle
      this.azimuth += dt * 0.015 * this.travelSpeed;
      this.distance += Math.sin(time * 0.05) * dt * 0.5 * this.travelSpeed;
      this.polar += Math.sin(time * 0.031) * dt * 0.004 * this.travelSpeed;
      this.polar = THREE.MathUtils.clamp(this.polar, 0.15, 1.52);
    }

    // critically-damped-ish exponential smoothing
    const k = 1 - Math.exp(-dt * 2.2);
    this.sTarget.lerp(this.target, k);
    this.sDistance += (this.distance - this.sDistance) * k;
    this.sAzimuth += (this.azimuth - this.sAzimuth) * k;
    this.sPolar += (this.polar - this.sPolar) * k;

    const sp = Math.sin(this.sPolar), cp = Math.cos(this.sPolar);
    this.camera.position.set(
      this.sTarget.x + this.sDistance * sp * Math.sin(this.sAzimuth),
      this.sTarget.y + this.sDistance * cp,
      this.sTarget.z + this.sDistance * sp * Math.cos(this.sAzimuth),
    );
    this.camera.lookAt(this.sTarget);
  }

  dispose(): void {
    this.disposeFns.forEach((f) => f());
    this.disposeFns = [];
  }
}
