import type { ArtifactParams } from '../effects/ArtifactController';
import { applyIntensity } from '../effects/ArtifactController';

export type CameraMode = 'guided' | 'explore';

interface PanelCallbacks {
  onCameraMode(mode: CameraMode): void;
  onTravelSpeed(v: number): void;
}

/**
 * Hand-rolled diagnostic panel: label / slider / value rows grouped by
 * concern. No framework, no dependency — it edits the shared ArtifactParams
 * object directly and the controller reads it every frame.
 */
export class ControlPanel {
  private root: HTMLElement;
  private statsEl: HTMLElement;
  private disposeFns: Array<() => void> = [];
  private valueUpdaters: Array<() => void> = [];

  constructor(
    container: HTMLElement,
    private params: ArtifactParams,
    callbacks: PanelCallbacks,
  ) {
    this.root = container;
    this.root.innerHTML = '';

    const header = document.createElement('header');
    const title = document.createElement('span');
    title.textContent = 'RECONSTRUCTION';
    this.statsEl = document.createElement('span');
    this.statsEl.className = 'stats';
    header.append(title, this.statsEl);
    const toggle = () => this.root.classList.toggle('collapsed');
    header.addEventListener('click', toggle);
    this.disposeFns.push(() => header.removeEventListener('click', toggle));
    this.root.appendChild(header);

    const body = document.createElement('div');
    body.className = 'body';
    this.root.appendChild(body);

    // ---- camera
    const cam = this.group(body, 'camera');
    const seg = document.createElement('div');
    seg.className = 'seg';
    const mkBtn = (label: string, mode: CameraMode) => {
      const b = document.createElement('button');
      b.textContent = label;
      const fn = () => {
        callbacks.onCameraMode(mode);
        seg.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
      };
      b.addEventListener('click', fn);
      this.disposeFns.push(() => b.removeEventListener('click', fn));
      seg.appendChild(b);
      return b;
    };
    mkBtn('guided', 'guided');
    mkBtn('explore', 'explore').classList.add('on');
    cam.appendChild(seg);
    this.sliderRaw(cam, 'travel speed', 0, 2.5, 0.01, 1, (v) => callbacks.onTravelSpeed(v));

    // ---- points
    const pts = this.group(body, 'points');
    this.slider(pts, 'size', 'pointSize', 0.5, 8, 0.05);
    this.slider(pts, 'density', 'density', 0.05, 1, 0.01);
    this.slider(pts, 'opacity', 'opacity', 0.1, 1, 0.01);
    this.slider(pts, 'saturation', 'saturation', 0, 1.4, 0.01);

    // ---- reconstruction artifacts
    const art = this.group(body, 'artifacts');
    this.sliderRaw(art, 'intensity', 0, 1, 0.01, 0.4, (v) => applyIntensity(this.params, v));
    this.slider(art, 'scan rings', 'scanRing', 0, 1, 0.01);
    this.slider(art, 'ring spacing', 'ringSpacing', 0.3, 6, 0.05);
    this.slider(art, 'missing data', 'missing', 0, 0.85, 0.01);
    this.slider(art, 'wedges', 'wedge', 0, 1, 0.01);
    this.slider(art, 'depth bands', 'depthQuant', 0, 1.5, 0.01);
    this.slider(art, 'layer split', 'layerSep', 0, 1, 0.005);
    this.slider(art, 'jitter', 'jitter', 0, 0.25, 0.002);

    // ---- time
    const time = this.group(body, 'time');
    this.slider(time, 'reveal', 'revealSpeed', 0, 4, 0.02);
    this.slider(time, 'decay', 'decaySpeed', 0, 4, 0.02);

    // ---- atmosphere
    const atm = this.group(body, 'atmosphere');
    this.slider(atm, 'depth fade', 'depthFade', 0, 1, 0.01);
    this.slider(atm, 'background', 'background', 0, 0.15, 0.001);
  }

  setStats(text: string): void {
    this.statsEl.textContent = text;
  }

  /** re-read params into slider positions (after a macro/preset changes them) */
  refresh(): void {
    this.valueUpdaters.forEach((f) => f());
  }

  private group(parent: HTMLElement, name: string): HTMLElement {
    const g = document.createElement('div');
    g.className = 'group';
    const t = document.createElement('div');
    t.className = 'title';
    t.textContent = name;
    g.appendChild(t);
    parent.appendChild(g);
    return g;
  }

  private slider(parent: HTMLElement, label: string, key: keyof ArtifactParams, min: number, max: number, step: number): void {
    const row = this.sliderRaw(parent, label, min, max, step, this.params[key], (v) => {
      (this.params[key] as number) = v;
    });
    // keep slider in sync when a macro (intensity) rewrites params
    this.valueUpdaters.push(() => {
      const v = this.params[key] as number;
      row.input.value = String(v);
      row.val.textContent = fmt(v);
    });
  }

  private sliderRaw(
    parent: HTMLElement, label: string,
    min: number, max: number, step: number, initial: number,
    onChange: (v: number) => void,
  ): { input: HTMLInputElement; val: HTMLElement } {
    const row = document.createElement('div');
    row.className = 'row';
    const lab = document.createElement('label');
    lab.textContent = label;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min); input.max = String(max); input.step = String(step);
    input.value = String(initial);
    const val = document.createElement('span');
    val.className = 'val';
    val.textContent = fmt(initial);
    const fn = () => {
      const v = parseFloat(input.value);
      val.textContent = fmt(v);
      onChange(v);
      this.refreshOthers();
    };
    input.addEventListener('input', fn);
    this.disposeFns.push(() => input.removeEventListener('input', fn));
    row.append(lab, input, val);
    parent.appendChild(row);
    return { input, val };
  }

  private refreshing = false;
  private refreshOthers(): void {
    if (this.refreshing) return;
    this.refreshing = true;
    this.refresh();
    this.refreshing = false;
  }

  dispose(): void {
    this.disposeFns.forEach((f) => f());
    this.disposeFns = [];
    this.root.innerHTML = '';
  }
}

function fmt(v: number): string {
  return Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
}
