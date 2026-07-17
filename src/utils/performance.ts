/**
 * Adaptive quality: watches the frame time and nudges a quality scalar
 * (0.35..1) up or down. App maps it onto point density (points are culled in
 * the vertex shader, so the buffers never change) and onto device pixel
 * ratio when things get really slow.
 */
export class AdaptiveQuality {
  quality = 1;
  private acc = 0;
  private frames = 0;
  private cooldown = 0;

  /** Call once per frame with the frame delta in seconds. Returns true when quality changed. */
  update(dt: number): boolean {
    this.acc += dt;
    this.frames++;
    if (this.acc < 1.0) return false; // evaluate once per second
    const avg = this.acc / this.frames;
    this.acc = 0;
    this.frames = 0;
    if (this.cooldown > 0) { this.cooldown--; return false; }

    const fps = 1 / avg;
    let next = this.quality;
    if (fps < 38) next = Math.max(0.35, this.quality - 0.15);
    else if (fps > 56 && this.quality < 1) next = Math.min(1, this.quality + 0.07);
    if (next !== this.quality) {
      this.quality = next;
      this.cooldown = 2; // let it settle before re-evaluating
      return true;
    }
    return false;
  }
}

export function clampedPixelRatio(max = 2): number {
  return Math.min(window.devicePixelRatio || 1, max);
}
