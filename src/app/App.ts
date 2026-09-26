import * as THREE from 'three';
import { CONFIG } from './config';
import type { SpatialDataSource } from '../data/SpatialDataSource';
import { PlyDataSource } from '../data/PlyDataSource';
import { OpenTopographyDataSource } from '../data/OpenTopographyDataSource';
import { FixtureDataSource } from '../data/FixtureDataSource';
import type { SpatialScene } from '../data/SpatialScene';
import { PointCloudRenderer } from '../rendering/PointCloudRenderer';
import { ArtifactController, DEFAULT_PARAMS, applyIntensity, type ArtifactParams } from '../effects/ArtifactController';
import { CameraController } from '../camera/CameraController';
import { GuidedCameraPath } from '../camera/GuidedCameraPath';
import { ControlPanel, type CameraMode } from '../ui/ControlPanel';
import { boundsCenter, boundsRadius } from '../utils/bounds';
import { AdaptiveQuality, clampedPixelRatio } from '../utils/performance';

export class App {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();

  private cloud = new PointCloudRenderer();
  private params: ArtifactParams = { ...DEFAULT_PARAMS };
  private artifacts: ArtifactController;
  private explore: CameraController;
  private guided: GuidedCameraPath | null = null;
  private mode: CameraMode = 'explore';
  private panel: ControlPanel;
  private quality = new AdaptiveQuality();

  private source: SpatialDataSource | null = null;
  private statusEl: HTMLElement;
  private raf = 0;
  private disposed = false;
  private onResize = () => this.resize();

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // point sprites don't benefit; saves fill rate
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(clampedPixelRatio(CONFIG.maxPixelRatio));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      CONFIG.camera.fov,
      container.clientWidth / container.clientHeight,
      CONFIG.camera.near,
      CONFIG.camera.far,
    );
    this.camera.position.set(20, 10, 20);

    this.scene.add(this.cloud.object);
    this.artifacts = new ArtifactController(this.params, this.cloud.material);
    applyIntensity(this.params, 0.4);

    this.explore = new CameraController(this.camera, this.renderer.domElement);
    this.statusEl = document.getElementById('status')!;
    this.panel = new ControlPanel(document.getElementById('panel')!, this.params, {
      onCameraMode: (m) => { this.mode = m; this.explore.enabled = m === 'explore'; },
      onTravelSpeed: (v) => {
        this.explore.travelSpeed = v;
        if (this.guided) this.guided.travelSpeed = v;
      },
    });
    this.panel.refresh();

    window.addEventListener('resize', this.onResize);
  }

  async start(): Promise<void> {
    this.animate(); // render loop runs while data loads

    // Data source selection: real PLY first, then (if configured) a real
    // but aerial OpenTopography DEM, dev fixture as last-resort fallback.
    // Additional SpatialDataSource implementations slot in here.
    let scene: SpatialScene | null = null;
    try {
      this.setStatus(`loading ${CONFIG.assetUrl} …`);
      this.source = new PlyDataSource(CONFIG.assetUrl);
      scene = await this.source.load((f) => this.setStatus(`loading capture … ${(f * 100) | 0}%`));
      this.setStatus('');
    } catch {
      this.source?.dispose();
      this.source = null;

      if (OpenTopographyDataSource.isConfigured()) {
        try {
          const { demType, bbox, maxPoints } = CONFIG.openTopography;
          this.setStatus(`no capture at ${CONFIG.assetUrl} — fetching OpenTopography ${demType} DEM …`);
          this.source = new OpenTopographyDataSource(bbox, demType, import.meta.env.VITE_OPENTOPOGRAPHY_API_KEY!, maxPoints);
          scene = await this.source.load((f) => this.setStatus(`fetching DEM … ${(f * 100) | 0}%`));
          this.setStatus(
            'REAL DATA, NOT PHOTOGRAPHIC — an OpenTopography aerial elevation model ' +
              `(${demType}), colored by height rather than by camera.\n` +
              'Drop a colored PLY at public/assets/scene.ply for the intended street-level capture.',
            true,
          );
        } catch (err) {
          console.warn('OpenTopography source failed, falling back to the dev fixture:', err);
          this.source?.dispose();
          this.source = null;
          scene = null;
        }
      }

      if (!scene) {
        this.setStatus(`no capture at ${CONFIG.assetUrl} — simulating a panorama scan …`);
        this.source = new FixtureDataSource();
        scene = await this.source.load((f) => this.setStatus(`simulating panorama scan … ${(f * 100) | 0}%`));
        this.setStatus(
          'DEV FIXTURE — simulated panorama scan, not a real capture.\nDrop a colored PLY at public/assets/scene.ply (see assets/README.md).',
          true,
        );
      }
    }
    if (this.disposed || !scene) return;

    this.cloud.setScene(scene);
    this.frame(scene);
    this.panel.setStats(`${(this.cloud.pointTotal / 1000).toFixed(0)}k pts`);
  }

  /** Frame the asset from its bounds and build the guided path for it. */
  private frame(scene: SpatialScene): void {
    const center = boundsCenter(scene.bounds);
    const radius = boundsRadius(scene.bounds);
    this.artifacts.setSceneRadius(radius);
    // frame low and close: the reconstruction reads best from inside the
    // street, not from a satellite distance
    const target = center.clone();
    target.y = scene.bounds.min[1] + Math.min(6, (scene.bounds.max[1] - scene.bounds.min[1]) * 0.25);
    this.explore.jumpTo(target, radius * 0.42, 0.7, 1.22);
    this.camera.far = Math.max(500, radius * 8);
    this.camera.updateProjectionMatrix();
    this.guided = new GuidedCameraPath(scene.bounds, scene.scanOrigins);
    this.guided.travelSpeed = this.explore.travelSpeed;
  }

  private animate = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const t = this.clock.elapsedTime;

    if (this.quality.update(dt)) {
      // adaptive density: culled in the vertex shader, buffers untouched
    }
    this.artifacts.apply(this.quality.quality);
    this.cloud.update(t);

    if (this.mode === 'guided' && this.guided) this.guided.update(dt, this.camera);
    else this.explore.update(dt, t);

    const bg = this.params.background;
    this.renderer.setClearColor(new THREE.Color(bg, bg, bg * 1.06), 1);
    this.renderer.render(this.scene, this.camera);
  };

  private setStatus(text: string, warn = false): void {
    this.statusEl.innerHTML = '';
    if (!text) return;
    const span = document.createElement('span');
    if (warn) span.className = 'warn';
    span.textContent = text;
    this.statusEl.appendChild(span);
  }

  private resize(): void {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(clampedPixelRatio(CONFIG.maxPixelRatio));
    this.renderer.setSize(w, h);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.explore.dispose();
    this.panel.dispose();
    this.source?.dispose();
    this.cloud.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
