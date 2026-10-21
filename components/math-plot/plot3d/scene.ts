/**
 * WebGL scene for <MathPlot3D>. Loaded with a dynamic import, so Three.js is
 * only downloaded by pages that actually show a 3D plot, and only once the
 * figure approaches the viewport.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

import type { Box, Vec3 } from '../core/mesh';
import { type Palette, rampAt } from '../core/palette';
import { niceStep } from '../core/sampling';
import type { Built3D, LinePart, MeshPart } from './model';

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
}

export interface SceneOptions {
  camera?: readonly [number, number, number];
  /** z multiplier applied to the whole scene (aspect: "cube"). */
  zScale: number;
  labelHtml: (tex: string) => string | undefined;
}

export class MathScene {
  private renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.01, 500);
  private controls: OrbitControls;
  private world = new THREE.Group();
  private content = new THREE.Group();
  private sectionGroup = new THREE.Group();
  private lineMaterials = new Set<LineMaterial>();
  private built: Built3D | null = null;
  private palette: Palette;
  private span = 1;
  private dirty = true;
  private raf = 0;
  private ro: ResizeObserver;
  private clipPlanes: THREE.Plane[] = [];
  private section: number | null = null;
  private disposers: (() => void)[] = [];
  private hemi = new THREE.HemisphereLight(0xffffff, 0x8f897f, 1.7);
  private key = new THREE.DirectionalLight(0xffffff, 2.5);
  private rim = new THREE.DirectionalLight(0xfff4e6, 1.1);

  constructor(
    private host: HTMLElement,
    palette: Palette,
    private options: SceneOptions,
  ) {
    this.palette = palette;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.className = 'mp-canvas';
    host.append(this.renderer.domElement);
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'mp3-labels';
    host.append(this.labelRenderer.domElement);

    this.camera.up.set(0, 0, 1);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.rotateSpeed = 0.85;
    this.controls.zoomToCursor = true;
    this.controls.addEventListener('change', () => {
      this.dirty = true;
    });
    // Let vertical swipes scroll the page on touch screens.
    this.renderer.domElement.style.touchAction = 'pan-y';

    // Plain wheel scrolls the page; ctrl / ⌘ + wheel (and trackpad pinch) zooms.
    const wheelGate = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) e.stopImmediatePropagation();
    };
    host.addEventListener('wheel', wheelGate, { capture: true });
    this.disposers.push(() => host.removeEventListener('wheel', wheelGate, { capture: true }));

    this.key.position.set(4, -3, 7);
    this.rim.position.set(-5, 4, 2);
    this.applyLighting();
    this.scene.add(this.hemi, this.key, this.rim, this.world);
    this.world.add(this.content, this.sectionGroup);
    this.world.scale.set(1, 1, options.zScale);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const moved = this.controls.update();
      if (moved || this.dirty) {
        this.dirty = false;
        this.renderer.render(this.scene, this.camera);
        this.labelRenderer.render(this.scene, this.camera);
      }
    };
    loop();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    for (const dispose of this.disposers) dispose();
    this.controls.dispose();
    this.clear(this.content);
    this.clear(this.sectionGroup);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }

  getCamera(): CameraState {
    return { position: this.camera.position.toArray(), target: this.controls.target.toArray() };
  }

  setCamera(state: CameraState) {
    this.camera.position.fromArray(state.position);
    this.controls.target.fromArray(state.target);
    this.controls.update();
    this.dirty = true;
  }

  setAutoRotate(on: boolean) {
    this.controls.autoRotate = on;
    this.controls.autoRotateSpeed = 1.1;
    this.dirty = true;
  }

  zoomBy(k: number) {
    const target = this.controls.target;
    const offset = this.camera.position.clone().sub(target).multiplyScalar(1 / k);
    this.camera.position.copy(target).add(offset);
    this.controls.update();
    this.dirty = true;
  }

  setPalette(palette: Palette) {
    this.palette = palette;
    this.applyLighting();
    if (this.built) this.setModel(this.built, false);
    this.setSection(this.section);
  }

  /** Light pages wash colours out under the dark-theme rig, so they get more fill light. */
  private applyLighting() {
    const dark = this.palette.dark;
    this.hemi.intensity = dark ? 1.7 : 2.5;
    this.hemi.groundColor.set(dark ? 0x8f897f : 0xb8b2a8);
    this.key.intensity = dark ? 2.5 : 2.1;
    this.rim.intensity = dark ? 1.1 : 0.9;
  }

  resetCamera() {
    if (!this.built) return;
    const { x, y, z } = this.built.box;
    const k = this.options.zScale;
    const center = new THREE.Vector3((x[0] + x[1]) / 2, (y[0] + y[1]) / 2, ((z[0] + z[1]) / 2) * k);
    const dir = new THREE.Vector3(...(this.options.camera ?? [1.15, 0.72, 0.62])).normalize();
    const radius = 0.5 * Math.hypot(x[1] - x[0], y[1] - y[0], (z[1] - z[0]) * k);
    const dist = (radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.04;
    this.camera.position.copy(center.clone().addScaledVector(dir, dist));
    this.controls.target.copy(center);
    this.camera.near = dist / 100;
    this.camera.far = dist * 20;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.dirty = true;
  }

  private resize() {
    const r = this.host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.renderer.setSize(r.width, r.height, false);
    this.renderer.domElement.style.width = `${r.width}px`;
    this.renderer.domElement.style.height = `${r.height}px`;
    this.labelRenderer.setSize(r.width, r.height);
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
    for (const m of this.lineMaterials) m.resolution.set(r.width, r.height);
    this.dirty = true;
  }

  private clear(group: THREE.Group) {
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      for (const m of Array.isArray(material) ? material : material ? [material] : []) {
        (m as THREE.MeshBasicMaterial).map?.dispose();
        if (m instanceof LineMaterial) this.lineMaterials.delete(m);
        m.dispose();
      }
      if (o instanceof CSS2DObject) o.element.remove();
    });
    group.clear();
  }

  /* --------------------------------------------------------------- build */

  setModel(built: Built3D, refit: boolean) {
    const boxChanged = !this.built || JSON.stringify(this.built.box) !== JSON.stringify(built.box);
    this.built = built;
    this.clear(this.content);
    const { x, y, z } = built.box;
    const k = this.options.zScale;
    this.span = Math.max(x[1] - x[0], y[1] - y[0], (z[1] - z[0]) * k);
    // Clipping planes live in world space, so the z planes include the scale.
    const eps = this.span * 1e-4;
    this.clipPlanes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -x[0] + eps),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), x[1] + eps),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -y[0] + eps),
      new THREE.Plane(new THREE.Vector3(0, -1, 0), y[1] + eps),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -z[0] * k + eps),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), z[1] * k + eps),
    ];
    this.addAxes(built.box);
    for (const part of built.meshes) this.addMesh(part, built.box);
    this.addLines(built.lines);
    for (const p of built.points) this.addPoint(p.p, p.color, p.label);
    for (const l of built.labels) {
      const html = this.options.labelHtml(l.tex);
      if (html) this.label(html, new THREE.Vector3(...l.at), 'mp3-label');
    }
    if (built.projection) this.addProjection(built.projection, built.box, built.floorZ);
    this.resize();
    if (refit || boxChanged) this.resetCamera();
    this.dirty = true;
  }

  private lineMaterial(color: THREE.ColorRepresentation, width: number, opts: { dashed?: boolean; opacity?: number; vertexColors?: boolean } = {}) {
    const material = new LineMaterial({
      color: opts.vertexColors ? 0xffffff : color,
      linewidth: width,
      transparent: (opts.opacity ?? 1) < 1,
      opacity: opts.opacity ?? 1,
      dashed: Boolean(opts.dashed),
      dashSize: this.span * 0.022,
      gapSize: this.span * 0.016,
      vertexColors: Boolean(opts.vertexColors),
      worldUnits: false,
    });
    const r = this.host.getBoundingClientRect();
    material.resolution.set(r.width || 800, r.height || 600);
    this.lineMaterials.add(material);
    return material;
  }

  private segments(positions: number[], material: LineMaterial, group: THREE.Group = this.content, colors?: number[]) {
    if (positions.length < 6) return null;
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(positions);
    if (colors) geometry.setColors(colors);
    const line = new LineSegments2(geometry, material);
    if (material.dashed) line.computeLineDistances();
    group.add(line);
    return line;
  }

  private label(html: string, at: THREE.Vector3, className: string, group: THREE.Group = this.content) {
    const el = document.createElement('div');
    el.className = className;
    el.innerHTML = html;
    const obj = new CSS2DObject(el);
    obj.position.copy(at);
    group.add(obj);
    return obj;
  }

  private color(name: string): THREE.Color {
    const series = this.palette.series as Record<string, string>;
    return new THREE.Color(series[name] ?? this.palette.ink);
  }

  private addAxes(box: Box) {
    const P = this.palette;
    const ink = new THREE.Color(P.ink);
    const k = this.options.zScale;
    const pad = this.span * 0.1;
    const axes: [readonly [number, number], Vec3, string][] = [
      [box.x, [1, 0, 0], 'x'],
      [box.y, [0, 1, 0], 'y'],
      [box.z, [0, 0, 1], 'z'],
    ];
    const material = this.lineMaterial(ink, 1.3, { opacity: 0.78 });
    const axisPositions: number[] = [];
    for (const [r, d, name] of axes) {
      const scale = name === 'z' ? k : 1;
      const a = Math.min(r[0], 0);
      const b = Math.max(r[1], 0) + pad / scale;
      axisPositions.push(d[0] * a, d[1] * a, d[2] * a, d[0] * b, d[1] * b, d[2] * b);
      const dir = new THREE.Vector3(...d);
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(this.span * 0.012, this.span * 0.04, 16),
        new THREE.MeshBasicMaterial({ color: ink }),
      );
      cone.position.copy(dir.clone().multiplyScalar(b));
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      // The world group stretches z by k; undo it so the arrowheads stay round.
      if (name === 'z') cone.scale.set(1, 1 / k, 1);
      else cone.scale.set(1, 1, 1 / k);
      this.content.add(cone);
      this.label(name, dir.clone().multiplyScalar(b + (this.span * 0.05) / scale), 'mp3-axis');
      const step = niceStep((r[1] - r[0]) / 4);
      for (let t = Math.ceil(r[0] / step) * step; t <= r[1] + 1e-9; t += step) {
        if (Math.abs(t) < 1e-9) continue;
        this.label(`${+t.toFixed(4)}`.replace('-', '−'), dir.clone().multiplyScalar(t), 'mp3-tick');
      }
    }
    this.segments(axisPositions, material);

    // Floor grid and a faint bounding box.
    const z0 = box.z[0];
    const step = niceStep(Math.max(box.x[1] - box.x[0], box.y[1] - box.y[0]) / 8);
    const grid: number[] = [];
    const x0 = Math.ceil(box.x[0] / step - 1e-9) * step;
    const y0 = Math.ceil(box.y[0] / step - 1e-9) * step;
    for (let x = x0; x <= box.x[1] + 1e-9; x += step) grid.push(x, box.y[0], z0, x, box.y[1], z0);
    for (let y = y0; y <= box.y[1] + 1e-9; y += step) grid.push(box.x[0], y, z0, box.x[1], y, z0);
    this.segments(grid, this.lineMaterial(new THREE.Color(P.grid), 1, { opacity: P.dark ? 0.9 : 1 }));
    const [X0, X1] = box.x;
    const [Y0, Y1] = box.y;
    const [Z0, Z1] = box.z;
    const edges = [
      [X0, Y0, Z0, X1, Y0, Z0], [X1, Y0, Z0, X1, Y1, Z0], [X1, Y1, Z0, X0, Y1, Z0], [X0, Y1, Z0, X0, Y0, Z0],
      [X0, Y0, Z1, X1, Y0, Z1], [X1, Y0, Z1, X1, Y1, Z1], [X1, Y1, Z1, X0, Y1, Z1], [X0, Y1, Z1, X0, Y0, Z1],
      [X0, Y0, Z0, X0, Y0, Z1], [X1, Y0, Z0, X1, Y0, Z1], [X1, Y1, Z0, X1, Y1, Z1], [X0, Y1, Z0, X0, Y1, Z1],
    ].flat();
    this.segments(edges, this.lineMaterial(new THREE.Color(P.muted), 1, { opacity: 0.22 }));
  }

  private addMesh(part: MeshPart, box: Box) {
    const P = this.palette;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(part.positions, 3));
    if (part.indices) geometry.setIndex(new THREE.BufferAttribute(part.indices, 1));
    if (part.normals) geometry.setAttribute('normal', new THREE.BufferAttribute(part.normals, 3));
    else geometry.computeVertexNormals();
    if (part.colormap) {
      const [z0, z1] = zExtent(part.positions, box);
      const colors = new Float32Array(part.positions.length);
      for (let i = 0; i < part.positions.length; i += 3) {
        const c = new THREE.Color().setRGB(...rampAt(P.ramp, (part.positions[i + 2] - z0) / (z1 - z0 || 1)), THREE.SRGBColorSpace);
        colors[i] = c.r;
        colors[i + 1] = c.g;
        colors[i + 2] = c.b;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    const flat = part.role === 'floor' || part.role === 'wall';
    const transparent = part.opacity < 1;
    const material = flat
      ? new THREE.MeshBasicMaterial({
          color: this.color(part.color),
          transparent: true,
          opacity: part.opacity,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      : new THREE.MeshStandardMaterial({
          color: part.colormap ? 0xffffff : this.color(part.color),
          vertexColors: part.colormap,
          // Lift the shadowed faces of translucent solids so they read like the 2D region fills.
          emissive: part.role === 'solid' ? this.color(part.color) : 0x000000,
          emissiveIntensity: part.role === 'solid' ? (P.dark ? 0.1 : 0.32) : 0,
          roughness: 0.62,
          metalness: 0,
          side: THREE.DoubleSide,
          transparent,
          opacity: part.opacity,
          depthWrite: !transparent,
          clippingPlanes: this.clipPlanes,
          wireframe: part.wireframe,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = transparent ? 3 : 1;
    this.content.add(mesh);
  }

  private addLines(lines: LinePart[]) {
    const P = this.palette;
    // Batch thin lines by style into single LineSegments2 objects.
    const batches = new Map<string, { positions: number[]; colors?: number[]; part: LinePart }>();
    for (const line of lines) {
      if (line.role === 'curve' && (line.tube || line.arrows)) {
        this.addTube(line);
        continue;
      }
      const key = `${line.role}|${line.color}|${line.width}|${line.opacity}|${line.dashed}|${line.ramp !== undefined}`;
      let batch = batches.get(key);
      if (!batch) {
        batch = { positions: [], colors: line.ramp !== undefined ? [] : undefined, part: line };
        batches.set(key, batch);
      }
      const pts = line.points;
      const pairwise = line.role === 'rim';
      const rampColor = line.ramp !== undefined ? new THREE.Color().setRGB(...rampAt(P.ramp, line.ramp), THREE.SRGBColorSpace) : null;
      const step = pairwise ? 6 : 3;
      for (let i = 0; i + 5 < pts.length; i += step) {
        batch.positions.push(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], pts[i + 4], pts[i + 5]);
        if (rampColor) batch.colors!.push(rampColor.r, rampColor.g, rampColor.b, rampColor.r, rampColor.g, rampColor.b);
      }
    }
    for (const { positions, colors, part } of batches.values()) {
      const color = part.color === 'ink' ? new THREE.Color(P.ink) : this.color(part.color);
      const material = this.lineMaterial(color, part.width, {
        dashed: part.dashed,
        opacity: part.role === 'grid' ? (P.dark ? 0.24 : 0.2) : part.opacity,
        vertexColors: Boolean(colors),
      });
      if (part.role === 'grid') material.depthWrite = false;
      this.segments(positions, material, this.content, colors);
    }
  }

  private addTube(line: LinePart) {
    // Built in display space (z already stretched) inside a group that undoes the
    // world z scale, so tubes and arrowheads stay round when aspect="cube".
    const k = this.options.zScale;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i + 2 < line.points.length; i += 3) pts.push(new THREE.Vector3(line.points[i], line.points[i + 1], line.points[i + 2] * k));
    if (pts.length < 2) return;
    const group = new THREE.Group();
    group.scale.set(1, 1, 1 / k);
    const curve = new THREE.CatmullRomCurve3(pts);
    const material = new THREE.MeshStandardMaterial({ color: this.color(line.color === 'ink' ? 'coral' : line.color), roughness: 0.45 });
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(600, pts.length * 2), this.span * 0.006, 10, false), material));
    const n = line.arrows ?? 0;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(this.span * 0.018, this.span * 0.055, 18), material);
      cone.position.copy(curve.getPointAt(t));
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangentAt(t));
      group.add(cone);
    }
    this.content.add(group);
  }

  private addPoint(p: Vec3, color: string, label?: string) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(this.span * 0.011, 16, 12),
      new THREE.MeshStandardMaterial({ color: color === 'ink' ? new THREE.Color(this.palette.ink) : this.color(color) }),
    );
    mesh.position.set(...p);
    mesh.scale.set(1, 1, 1 / this.options.zScale);
    this.content.add(mesh);
    if (label) {
      const html = this.options.labelHtml(label);
      if (html) this.label(html, new THREE.Vector3(...p), 'mp3-label').center.set(-0.1, 1.1);
    }
  }

  private addProjection(test: (x: number, y: number) => boolean, box: Box, z0: number) {
    const texture = this.maskTexture((x, y) => (test(x, y) ? 1 : 0), box, 200, (m) =>
      m ? [...hexBytes(this.palette.series.blue), 70] : [0, 0, 0, 0],
    );
    this.content.add(this.plane(texture, box, z0 + this.span * 0.001, 0));
  }

  private maskTexture(
    sample: (x: number, y: number) => number,
    box: Box,
    N: number,
    color: (m: number, edge: boolean) => number[],
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = N;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(N, N);
    const mask = new Uint8Array(N * N);
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const wx = box.x[0] + ((box.x[1] - box.x[0]) * (i + 0.5)) / N;
        const wy = box.y[1] - ((box.y[1] - box.y[0]) * (j + 0.5)) / N;
        mask[j * N + i] = sample(wx, wy);
      }
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const k = j * N + i;
        const m = mask[k];
        const edge = Boolean(
          m && ((i > 0 && !mask[k - 1]) || (i < N - 1 && !mask[k + 1]) || (j > 0 && !mask[k - N]) || (j < N - 1 && !mask[k + N])),
        );
        img.data.set(color(m, edge), k * 4);
      }
    ctx.putImageData(img, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private plane(texture: THREE.Texture, box: Box, z: number, order: number) {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(box.x[1] - box.x[0], box.y[1] - box.y[0]),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    plane.position.set((box.x[0] + box.x[1]) / 2, (box.y[0] + box.y[1]) / 2, z);
    plane.renderOrder = order;
    return plane;
  }

  /* ------------------------------------------------------------ section */

  setSection(z: number | null) {
    this.section = z;
    this.clear(this.sectionGroup);
    const built = this.built;
    if (z === null || !built?.solids.length) {
      this.dirty = true;
      return;
    }
    const inside = (x: number, y: number) => (built.solids.some((s) => s(x, y, z)) ? 1 : 0);
    const coral = hexBytes(this.palette.series.coral);
    const texture = this.maskTexture(inside, built.box, 220, (m, edge) =>
      edge ? [...coral, 255] : m ? [...coral, 150] : [...coral, 12],
    );
    this.sectionGroup.add(this.plane(texture, built.box, z, 6));
    const { x, y } = built.box;
    this.segments(
      [x[0], y[0], z, x[1], y[0], z, x[1], y[0], z, x[1], y[1], z, x[1], y[1], z, x[0], y[1], z, x[0], y[1], z, x[0], y[0], z],
      this.lineMaterial(new THREE.Color(this.palette.series.coral), 1.3, { opacity: 0.75 }),
      this.sectionGroup,
    );
    this.label(`z = ${z.toFixed(2)}`, new THREE.Vector3(x[1], y[1], z), 'mp3-tick', this.sectionGroup);
    this.dirty = true;
  }
}

function zExtent(positions: Float32Array, box: Box): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 2; i < positions.length; i += 3) {
    const z = positions[i];
    if (!Number.isFinite(z)) continue;
    if (z < lo) lo = z;
    if (z > hi) hi = z;
  }
  // Colour across the visible part only, so clipped spikes do not wash out the ramp.
  return [Math.max(lo, box.z[0]), Math.min(hi, box.z[1])];
}

function hexBytes(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
