/**
 * Canvas renderer for <MathPlot2D>: grid and axes, rasterised regions with
 * anti-aliased edges, sampled curves, Fubini slices, points and an HTML label
 * layer (TeX pre-rendered on the server). Handles pan, pinch, ctrl+wheel zoom.
 */
import { type Palette, rgba } from '../core/palette';
import {
  formatNumber,
  niceStep,
  slicePoint,
  sliceIntervals,
  type Range,
  type SliceMode,
  type Vec2,
} from '../core/sampling';
import type { CurveModel, Model2D, SliceModel, View } from './model';

interface Frame {
  W: number;
  H: number;
  cx: number;
  cy: number;
  sx: number;
  sy: number;
}

const toPx = (f: Frame, x: number, y: number): Vec2 => [f.W / 2 + (x - f.cx) * f.sx, f.H / 2 - (y - f.cy) * f.sy];
const toWorld = (f: Frame, px: number, py: number): Vec2 => [f.cx + (px - f.W / 2) / f.sx, f.cy - (py - f.H / 2) / f.sy];
const viewOf = (f: Frame): View => {
  const [x0, y1] = toWorld(f, 0, 0);
  const [x1, y0] = toWorld(f, f.W, f.H);
  return { x: [x0, x1], y: [y0, y1] };
};

export interface SliceState {
  slice: SliceModel;
  value: number;
}

export interface SliceInfo {
  mode: SliceMode;
  value: number;
  intervals: Range[];
}

export interface RendererOptions {
  equal: boolean;
  minimal: boolean;
  piTicks: boolean;
  labelHtml: (tex: string) => string | undefined;
}

interface Label {
  el: HTMLElement;
  pos: () => Vec2 | null;
  off: Vec2;
  /** Measured box, cached after the first layout. */
  size?: Vec2;
}

interface Sampled {
  curve: CurveModel;
  lines: Vec2[][];
  /** Per line, per segment: does it border a filled region (boundary curves only). */
  border: boolean[][];
}

const FONT_MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const FONT_MATH = '"KaTeX_Math", "Times New Roman", serif';

function piLabel(k: number, denom: number) {
  // k·π/denom in lowest terms
  const g = (a: number, b: number): number => (b ? g(b, a % b) : Math.abs(a));
  const d = g(k, denom);
  const n = k / d;
  const q = denom / d;
  const sign = n < 0 ? '−' : '';
  const an = Math.abs(n);
  const head = an === 1 ? 'π' : `${an}π`;
  return q === 1 ? `${sign}${head}` : `${sign}${head}/${q}`;
}

export class Plot2DRenderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private labelLayer: HTMLElement;
  private model: Model2D | null = null;
  private palette: Palette;
  private frame: Frame | null = null;
  private fill: HTMLCanvasElement | null = null;
  private fillKey = '';
  private fillFrame: Frame | null = null;
  private fillTimer = 0;
  private sampled: Sampled[] = [];
  private labels: Label[] = [];
  private slice: SliceState | null = null;
  private sweep = false;
  private hover: Vec2 | null = null;
  private raf = 0;
  private pointers = new Map<number, Vec2>();
  private ro: ResizeObserver;
  private modelVersion = 0;
  private disposers: (() => void)[] = [];
  onHover?: (point: Vec2 | null, inDomain: boolean | null) => void;
  onSlice?: (info: SliceInfo | null) => void;
  onViewChange?: (changed: boolean) => void;

  constructor(
    private host: HTMLElement,
    palette: Palette,
    private options: RendererOptions,
  ) {
    this.palette = palette;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'mp-canvas';
    this.ctx = this.canvas.getContext('2d')!;
    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'mp-label-layer';
    this.labelLayer.setAttribute('aria-hidden', 'true');
    host.append(this.canvas, this.labelLayer);
    this.bindPointer();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
  }

  destroy() {
    this.ro.disconnect();
    clearTimeout(this.fillTimer);
    cancelAnimationFrame(this.raf);
    for (const dispose of this.disposers) dispose();
    this.canvas.remove();
    this.labelLayer.remove();
  }

  setModel(model: Model2D, refit: boolean) {
    this.model = model;
    this.modelVersion++;
    this.fillKey = '';
    if (refit || !this.frame) this.resize(true);
    else {
      this.buildLabels();
      this.afterViewChange(false);
    }
  }

  setPalette(palette: Palette) {
    this.palette = palette;
    this.fillKey = '';
    this.fillFrame = null;
    this.request();
  }

  setSlice(state: SliceState | null) {
    this.slice = state;
    this.emitSlice();
    this.request();
  }

  setSweep(on: boolean) {
    this.sweep = on;
    this.request();
  }

  resetView() {
    if (!this.model) return;
    const r = this.host.getBoundingClientRect();
    this.frame = this.fit(r.width, r.height);
    this.afterViewChange(true);
    this.onViewChange?.(false);
  }

  zoomBy(k: number) {
    if (!this.frame) return;
    this.zoomAt(this.frame.W / 2, this.frame.H / 2, k);
  }

  private fit(W: number, H: number): Frame {
    const { x, y } = this.model!.view;
    const pad = 0.94;
    let sx = (W / (x[1] - x[0])) * pad;
    let sy = (H / (y[1] - y[0])) * pad;
    if (this.options.equal) sx = sy = Math.min(sx, sy);
    return { W, H, cx: (x[0] + x[1]) / 2, cy: (y[0] + y[1]) / 2, sx, sy };
  }

  private resize(refit = false) {
    if (!this.model) return;
    const r = this.host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.canvas.style.width = `${r.width}px`;
    this.canvas.style.height = `${r.height}px`;
    if (refit || !this.frame) this.frame = this.fit(r.width, r.height);
    else {
      // Keep the centre and scale; a width change keeps the same visible x-span.
      const k = r.width / this.frame.W;
      this.frame = { ...this.frame, W: r.width, H: r.height, sx: this.frame.sx * k, sy: this.frame.sy * k };
    }
    this.buildLabels();
    this.afterViewChange(true);
  }

  private afterViewChange(viewChanged: boolean) {
    if (viewChanged) this.fillKey = '';
    this.resample();
    this.emitSlice();
    this.request();
  }

  private resample() {
    const f = this.frame;
    const model = this.model;
    if (!f || !model) return;
    const view = viewOf(f);
    const eps = 2.2 / Math.min(f.sx, f.sy);
    const tests = model.regions.filter((r) => !r.faint).map((r) => r.test);
    this.sampled = model.curves.map((curve) => {
      let lines: Vec2[][] = [];
      try {
        lines = curve.sample(view, f.W);
      } catch {
        lines = [];
      }
      const border = lines.map((pts) => {
        if (!curve.boundary || !tests.length) return [];
        const out: boolean[] = [];
        for (let i = 0; i < pts.length - 1; i++) {
          const [x1, y1] = pts[i];
          const [x2, y2] = pts[i + 1];
          const dx = x2 - x1;
          const dy = y2 - y1;
          const l = Math.hypot(dx, dy);
          if (!l || !Number.isFinite(l)) {
            out.push(false);
            continue;
          }
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const nx = (-dy / l) * eps;
          const ny = (dx / l) * eps;
          out.push(tests.some((t) => t(mx + nx, my + ny) !== t(mx - nx, my - ny)));
        }
        return out;
      });
      return { curve, lines, border };
    });
  }

  /* ------------------------------------------------------------ labels */

  private buildLabels() {
    this.labelLayer.replaceChildren();
    this.labels = [];
    const model = this.model;
    if (!model) return;
    model.curves.forEach((curve, index) => {
      if (!curve.label) return;
      const html = this.options.labelHtml(curve.label);
      if (!html) return;
      const el = document.createElement('div');
      el.className = 'mp-label';
      el.style.color = this.palette.series[curve.color];
      el.dataset.color = curve.color;
      el.innerHTML = html;
      this.labelLayer.append(el);
      const label: Label = { el, off: [0, 0], pos: () => null };
      label.pos = () => {
        const sampled = this.sampled[index];
        const f = this.frame;
        if (!sampled || !f) return null;
        // Choose the point at labelAt along the visible part of the curve.
        const visible: Vec2[] = [];
        for (const line of sampled.lines)
          for (const p of line) {
            const [px, py] = toPx(f, p[0], p[1]);
            // Keep clear of the frame edges and of the toolbar in the top-right corner.
            const underToolbar = px > f.W - 140 && py < 56;
            if (px > 24 && px < f.W - 24 && py > 18 && py < f.H - 34 && !underToolbar) visible.push(p);
          }
        if (!visible.length) return null;
        const i = Math.min(visible.length - 2, Math.max(0, Math.round((visible.length - 1) * curve.labelAt)));
        const p = visible[i];
        const q = visible[Math.min(visible.length - 1, i + 1)];
        const tx = (q[0] - p[0]) * f.sx;
        const ty = -(q[1] - p[1]) * f.sy;
        const l = Math.hypot(tx, ty) || 1;
        // Screen-space normal; prefer the side away from filled regions, else up.
        let nx = -ty / l;
        let ny = tx / l;
        const domain = this.model?.domain;
        if (domain) {
          const e = 8;
          const [ax, ay] = toWorld(f, toPx(f, p[0], p[1])[0] + nx * e, toPx(f, p[0], p[1])[1] + ny * e);
          if (domain(ax, ay)) {
            nx = -nx;
            ny = -ny;
          }
        } else if (ny > 0) {
          nx = -nx;
          ny = -ny;
        }
        label.off = [nx * 14, ny * 14];
        return p;
      };
      this.labels.push(label);
    });
    for (const point of model.points) {
      if (!point.label) continue;
      const html = this.options.labelHtml(point.label);
      if (!html) continue;
      const el = document.createElement('div');
      el.className = 'mp-label mp-label-point';
      el.innerHTML = html;
      this.labelLayer.append(el);
      const dir = (point.dir * Math.PI) / 180;
      this.labels.push({ el, off: [Math.cos(dir) * 12, -Math.sin(dir) * 12], pos: () => point.p });
    }
  }

  private placeLabels() {
    const f = this.frame;
    if (!f) return;
    for (const l of this.labels) {
      const p = l.pos();
      if (!p || !p.every(Number.isFinite)) {
        l.el.style.display = 'none';
        continue;
      }
      const [px, py] = toPx(f, p[0], p[1]);
      const x = px + l.off[0];
      const y = py + l.off[1];
      const hidden = x < -40 || y < -20 || x > f.W + 40 || y > f.H + 20;
      l.el.style.display = hidden ? 'none' : '';
      const ax = l.off[0] > 4 ? 0 : l.off[0] < -4 ? -1 : -0.5;
      const ay = l.off[1] > 4 ? 0 : l.off[1] < -4 ? -1 : -0.5;
      if (!hidden && !l.size?.[0]) l.size = [l.el.offsetWidth, l.el.offsetHeight];
      const [w, h] = l.size ?? [0, 0];
      // Keep labels inside the canvas so narrow screens do not cut them off.
      const left = clamp(x + ax * w, 4, Math.max(4, f.W - w - 4));
      const top = clamp(y + ay * h, 4, Math.max(4, f.H - h - 4));
      l.el.style.transform = `translate(${left}px, ${top}px)`;
      const color = l.el.dataset.color as keyof Palette['series'] | undefined;
      if (color) l.el.style.color = this.palette.series[color];
    }
  }

  /* ------------------------------------------------------------ slices */

  private currentSliceInfo(): SliceInfo | null {
    if (!this.slice || !this.model?.domain || !this.frame) return null;
    const { slice, value } = this.slice;
    return {
      mode: slice.mode,
      value,
      intervals: sliceIntervals(this.model.domain, slice.mode, value, this.extendedRange(slice.mode)),
    };
  }

  private extendedRange(mode: SliceMode): Range {
    const f = this.frame!;
    const vis = viewOf(f);
    const v = this.model!.view;
    if (mode === 'x') return [Math.min(vis.y[0], v.y[0]), Math.max(vis.y[1], v.y[1])];
    if (mode === 'y') return [Math.min(vis.x[0], v.x[0]), Math.max(vis.x[1], v.x[1])];
    const corners = [vis.x[0], vis.x[1], v.x[0], v.x[1]].flatMap((x) =>
      [vis.y[0], vis.y[1], v.y[0], v.y[1]].map((y) => Math.hypot(x, y)),
    );
    return [0, Math.max(...corners)];
  }

  private emitSlice() {
    this.onSlice?.(this.currentSliceInfo());
  }

  /* -------------------------------------------------------------- draw */

  private request() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.draw();
    });
  }

  private draw() {
    const f = this.frame;
    const model = this.model;
    if (!f || !model) return;
    const ctx = this.ctx;
    const dpr = this.canvas.width / f.W;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, f.W, f.H);
    this.drawGrid(ctx, f);

    const key = `${f.W}|${f.H}|${f.cx}|${f.cy}|${f.sx}|${f.sy}|${this.modelVersion}`;
    if (model.regions.length) {
      if (key !== this.fillKey) {
        const reusable = this.fill && this.fillFrame && this.fillKey.endsWith(`|${this.modelVersion}`);
        if (reusable) {
          // View-only change: reuse the previous raster under an affine map, re-rasterise when idle.
          const f0 = this.fillFrame!;
          const kx = f.sx / f0.sx;
          const ky = f.sy / f0.sy;
          const [dx, dy] = toPx(f, f0.cx - f0.W / 2 / f0.sx, f0.cy + f0.H / 2 / f0.sy);
          ctx.drawImage(this.fill!, dx, dy, f0.W * kx, f0.H * ky);
          clearTimeout(this.fillTimer);
          this.fillTimer = window.setTimeout(() => this.rasterize(), 110);
        } else {
          this.rasterize(false);
          ctx.drawImage(this.fill!, 0, 0, f.W, f.H);
        }
      } else if (this.fill) ctx.drawImage(this.fill, 0, 0, f.W, f.H);
    }

    if (this.sweep && this.slice && model.domain) {
      const { slice } = this.slice;
      const range = this.extendedRange(slice.mode);
      const [a, b] = slice.range;
      const N = 28;
      for (let i = 0; i <= N; i++) {
        const c = a + ((b - a) * i) / N;
        this.drawSlice(ctx, f, { mode: slice.mode, value: c, intervals: sliceIntervals(model.domain, slice.mode, c, range, 400) }, true);
      }
    }
    this.drawCurves(ctx, f);
    const info = this.currentSliceInfo();
    if (info) this.drawSlice(ctx, f, info, false);
    this.drawPoints(ctx, f);
    if (this.hover) {
      const [px, py] = toPx(f, ...this.hover);
      ctx.strokeStyle = rgba(this.palette.ink, 0.45);
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(px - 7, py);
      ctx.lineTo(px + 7, py);
      ctx.moveTo(px, py - 7);
      ctx.lineTo(px, py + 7);
      ctx.stroke();
    }
    this.placeLabels();
  }

  private rasterize(redraw = true) {
    const f = this.frame;
    const model = this.model;
    if (!f || !model) return;
    const w = Math.max(1, Math.round(f.W));
    const h = Math.max(1, Math.round(f.H));
    const cv = this.fill ?? document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    const regions = model.regions.slice(0, 24);
    const tones = regions.map((r) => {
      const [cr, cg, cb] = hexRgb(this.palette.series[r.color]);
      const alpha = (r.faint ? 0.1 : this.palette.dark ? 0.34 : 0.26) * r.opacity;
      return [cr, cg, cb, Math.min(1, alpha)] as const;
    });
    const maskAt = (px: number, py: number) => {
      const [x, y] = toWorld(f, px, py);
      let m = 0;
      for (let i = 0; i < regions.length; i++) if (regions[i].test(x, y)) m |= 1 << i;
      return m;
    };
    const cache = new Map<number, [number, number, number, number]>();
    const color = (m: number) => {
      let c = cache.get(m);
      if (!c) {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        for (let i = 0; i < regions.length; i++) {
          if (!(m & (1 << i))) continue;
          const [cr, cg, cb, ca] = tones[i];
          r = cr * ca + r * (1 - ca);
          g = cg * ca + g * (1 - ca);
          b = cb * ca + b * (1 - ca);
          a = ca + a * (1 - ca);
        }
        c = a > 0 ? [r / a, g / a, b / a, a] : [0, 0, 0, 0];
        cache.set(m, c);
      }
      return c;
    };
    const masks = new Int32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) masks[j * w + i] = maskAt(i + 0.5, j + 0.5);
    const SUB = [
      [0.25, 0.25],
      [0.75, 0.25],
      [0.25, 0.75],
      [0.75, 0.75],
    ];
    const data = img.data;
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const idx = j * w + i;
        const m = masks[idx];
        const edge =
          (i > 0 && masks[idx - 1] !== m) ||
          (i < w - 1 && masks[idx + 1] !== m) ||
          (j > 0 && masks[idx - w] !== m) ||
          (j < h - 1 && masks[idx + w] !== m);
        let r: number;
        let g: number;
        let b: number;
        let a: number;
        if (!edge) {
          if (!m) continue;
          [r, g, b, a] = color(m);
        } else {
          r = g = b = a = 0;
          for (const [dx, dy] of SUB) {
            const c = color(maskAt(i + dx, j + dy));
            r += c[0] * c[3];
            g += c[1] * c[3];
            b += c[2] * c[3];
            a += c[3];
          }
          if (a > 0) {
            r /= a;
            g /= a;
            b /= a;
          }
          a /= 4;
        }
        const o = idx * 4;
        data[o] = r;
        data[o + 1] = g;
        data[o + 2] = b;
        data[o + 3] = a * 255;
      }
    ctx.putImageData(img, 0, 0);
    this.fill = cv;
    this.fillFrame = { ...f };
    this.fillKey = `${f.W}|${f.H}|${f.cx}|${f.cy}|${f.sx}|${f.sy}|${this.modelVersion}`;
    if (redraw) this.request();
  }

  private drawGrid(ctx: CanvasRenderingContext2D, f: Frame) {
    const P = this.palette;
    const view = viewOf(f);
    const stepX = this.options.piTicks ? piStep(70 / f.sx) : niceStep(70 / f.sx);
    const stepY = niceStep(56 / f.sy);
    const lines = (stx: number, sty: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = Math.ceil(view.x[0] / stx) * stx; x <= view.x[1]; x += stx) {
        const px = Math.round(toPx(f, x, 0)[0]) + 0.5;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, f.H);
      }
      for (let y = Math.ceil(view.y[0] / sty) * sty; y <= view.y[1]; y += sty) {
        const py = Math.round(toPx(f, 0, y)[1]) + 0.5;
        ctx.moveTo(0, py);
        ctx.lineTo(f.W, py);
      }
      ctx.stroke();
    };
    if (!this.options.minimal) {
      if ((stepX / 5) * f.sx > 10 && !this.options.piTicks) lines(stepX / 5, stepY / 5, P.gridMinor);
      lines(stepX, stepY, P.grid);
    }

    const [ox, oy] = toPx(f, 0, 0);
    const axisColor = rgba(P.ink, 0.72);
    ctx.strokeStyle = axisColor;
    ctx.fillStyle = axisColor;
    ctx.lineWidth = 1.15;
    ctx.setLineDash([]);
    const showX = oy >= 0 && oy <= f.H;
    const showY = ox >= 0 && ox <= f.W;
    ctx.beginPath();
    if (showX) {
      ctx.moveTo(0, oy);
      ctx.lineTo(f.W - 2, oy);
    }
    if (showY) {
      ctx.moveTo(ox, f.H);
      ctx.lineTo(ox, 2);
    }
    ctx.stroke();
    ctx.beginPath();
    if (showX) {
      ctx.moveTo(f.W - 1, oy);
      ctx.lineTo(f.W - 9, oy - 3.5);
      ctx.lineTo(f.W - 9, oy + 3.5);
    }
    if (showY) {
      ctx.moveTo(ox, 1);
      ctx.lineTo(ox - 3.5, 9);
      ctx.lineTo(ox + 3.5, 9);
    }
    ctx.fill();
    ctx.font = `italic 15px ${FONT_MATH}`;
    if (showX) ctx.fillText('x', f.W - 13, oy - 8);
    if (showY) ctx.fillText('y', ox + 8, 14);

    ctx.font = `11px ${FONT_MONO}`;
    ctx.fillStyle = P.muted;
    const ly = Math.min(Math.max(oy + 15, 13), f.H - 5);
    const lx = Math.min(Math.max(ox - 6, 30), f.W - 4);
    const label = (v: number) => (Math.abs(v) < 1e-9 ? '0' : `${+v.toFixed(6)}`.replace('-', '−'));
    ctx.textAlign = 'center';
    for (let x = Math.ceil(view.x[0] / stepX) * stepX; x <= view.x[1]; x += stepX) {
      if (Math.abs(x) < stepX / 2) continue;
      const px = toPx(f, x, 0)[0];
      if (px < 14 || px > f.W - 22) continue;
      const text = this.options.piTicks ? piTickLabel(x) : label(x);
      ctx.fillText(text, px, ly);
    }
    ctx.textAlign = 'right';
    for (let y = Math.ceil(view.y[0] / stepY) * stepY; y <= view.y[1]; y += stepY) {
      if (Math.abs(y) < stepY / 2) continue;
      const py = toPx(f, 0, y)[1];
      if (py < 22 || py > f.H - 10) continue;
      ctx.fillText(label(y), lx, py + 3.5);
    }
    if (showX && showY) ctx.fillText('O', ox - 5, oy + 14);
    ctx.textAlign = 'start';
  }

  private drawCurves(ctx: CanvasRenderingContext2D, f: Frame) {
    const P = this.palette;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const { curve, lines, border } of this.sampled) {
      const color = P.series[curve.color];
      ctx.setLineDash(curve.dashed ? [6, 5] : []);
      if (curve.boundary && border.some((b) => b.length)) {
        ctx.strokeStyle = rgba(color, 0.45);
        ctx.lineWidth = 1.1;
        for (const pts of lines) strokePolyline(ctx, f, pts);
        ctx.strokeStyle = color;
        ctx.lineWidth = curve.width + 0.2;
        lines.forEach((pts, i) => strokePolyline(ctx, f, pts, (k) => border[i][k]));
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = curve.width;
        for (const pts of lines) strokePolyline(ctx, f, pts);
      }
      if (curve.arrows) for (const pts of lines) arrowHeads(ctx, f, pts, curve.arrows, color, 10);
    }
    ctx.setLineDash([]);
  }

  private drawPoints(ctx: CanvasRenderingContext2D, f: Frame) {
    const P = this.palette;
    for (const point of this.model?.points ?? []) {
      const [px, py] = toPx(f, point.p[0], point.p[1]);
      ctx.beginPath();
      ctx.arc(px, py, 3.8, 0, Math.PI * 2);
      ctx.fillStyle = point.open ? P.canvas : P.series[point.color];
      ctx.fill();
      ctx.lineWidth = point.open ? 1.8 : 1.5;
      ctx.strokeStyle = point.open ? P.series[point.color] : P.canvas;
      ctx.stroke();
    }
  }

  private drawSlice(ctx: CanvasRenderingContext2D, f: Frame, info: SliceInfo, faint: boolean) {
    const P = this.palette;
    const accent = P.series.coral;
    const { mode, value, intervals } = info;
    const vis = viewOf(f);
    const span: Range = mode === 'x' ? vis.y : mode === 'y' ? vis.x : [0, Math.hypot(Math.max(Math.abs(vis.x[0]), Math.abs(vis.x[1])), Math.max(Math.abs(vis.y[0]), Math.abs(vis.y[1])))];
    if (!faint) {
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.55;
      ctx.setLineDash([2, 5]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const [ax, ay] = toPx(f, ...slicePoint(mode, value, span[0]));
      const [bx, by] = toPx(f, ...slicePoint(mode, value, span[1]));
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.restore();
      if (mode === 'polar') {
        const [ox, oy] = toPx(f, 0, 0);
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.fillStyle = accent;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        const R = 24;
        ctx.arc(ox, oy, R, 0, -value, value > 0);
        ctx.stroke();
        ctx.font = `italic 600 12px ${FONT_MATH}`;
        ctx.fillText(`θ=${formatNumber((value * 180) / Math.PI, 1)}°`, ox + R * Math.cos(value / 2) + 6, oy - R * Math.sin(value / 2) - 4);
        ctx.restore();
      }
    }
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineCap = 'round';
    ctx.lineWidth = faint ? 1.2 : 3.4;
    ctx.globalAlpha = faint ? 0.38 : 1;
    for (const [u, v] of intervals) {
      const [ax, ay] = toPx(f, ...slicePoint(mode, value, u));
      const [bx, by] = toPx(f, ...slicePoint(mode, value, v));
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      if (faint) continue;
      ctx.fillStyle = P.canvas;
      ctx.lineWidth = 2;
      for (const [px, py] of [
        [ax, ay],
        [bx, by],
      ]) {
        ctx.beginPath();
        ctx.arc(px, py, 4.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.lineWidth = 3.4;
    }
    ctx.restore();
  }

  /* ------------------------------------------------------- interaction */

  private bindPointer() {
    const c = this.canvas;
    const on = <K extends keyof HTMLElementEventMap>(
      type: K,
      handler: (e: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ) => {
      c.addEventListener(type, handler as EventListener, options);
      this.disposers.push(() => c.removeEventListener(type, handler as EventListener, options));
    };
    on(
      'wheel',
      (e) => {
        // Plain wheel scrolls the page; ctrl / ⌘ + wheel (and trackpad pinch) zooms.
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const rect = c.getBoundingClientRect();
        this.zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0035));
      },
      { passive: false },
    );
    on('dblclick', () => this.resetView());
    on('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, [e.clientX, e.clientY]);
    });
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
    };
    on('pointerup', up);
    on('pointercancel', up);
    on('pointerleave', () => {
      this.hover = null;
      this.onHover?.(null, null);
      this.request();
    });
    on('pointermove', (e) => {
      const f = this.frame;
      if (!f) return;
      const rect = c.getBoundingClientRect();
      const prev = this.pointers.get(e.pointerId);
      if (prev && this.pointers.size === 1) {
        this.frame = {
          ...f,
          cx: f.cx - (e.clientX - prev[0]) / f.sx,
          cy: f.cy + (e.clientY - prev[1]) / f.sy,
        };
        this.pointers.set(e.pointerId, [e.clientX, e.clientY]);
        this.afterViewChange(true);
        this.onViewChange?.(true);
      } else if (prev && this.pointers.size === 2) {
        const other = [...this.pointers.entries()].find(([id]) => id !== e.pointerId)![1];
        const d0 = Math.hypot(prev[0] - other[0], prev[1] - other[1]);
        const d1 = Math.hypot(e.clientX - other[0], e.clientY - other[1]);
        this.pointers.set(e.pointerId, [e.clientX, e.clientY]);
        if (d0 > 0) this.zoomAt((e.clientX + other[0]) / 2 - rect.left, (e.clientY + other[1]) / 2 - rect.top, d1 / d0);
      }
      if (e.pointerType === 'mouse' || this.pointers.size === 0) {
        this.hover = toWorld(this.frame!, e.clientX - rect.left, e.clientY - rect.top);
        const domain = this.model?.domain;
        this.onHover?.(this.hover, domain ? domain(this.hover[0], this.hover[1]) : null);
        this.request();
      }
    });
  }

  private zoomAt(px: number, py: number, k: number) {
    const f0 = this.frame;
    if (!f0) return;
    const [wx, wy] = toWorld(f0, px, py);
    const clampK = Math.min(Math.max(f0.sx * k, 2), 20000) / f0.sx;
    const f = { ...f0, sx: f0.sx * clampK, sy: f0.sy * clampK };
    const [nx, ny] = toWorld(f, px, py);
    this.frame = { ...f, cx: f.cx + (wx - nx), cy: f.cy + (wy - ny) };
    this.afterViewChange(true);
    this.onViewChange?.(true);
  }
}

function hexRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function piStep(raw: number) {
  const unit = Math.PI;
  for (const d of [12, 6, 4, 3, 2, 1]) if (unit / d >= raw) return unit / d;
  return niceStep(raw / unit) * unit;
}

function piTickLabel(x: number) {
  for (const d of [1, 2, 3, 4, 6, 12]) {
    const k = (x * d) / Math.PI;
    if (Math.abs(k - Math.round(k)) < 1e-6) return piLabel(Math.round(k), d);
  }
  return formatNumber(x, 2);
}

function strokePolyline(ctx: CanvasRenderingContext2D, f: Frame, pts: Vec2[], keep?: (i: number) => boolean) {
  ctx.beginPath();
  let open = false;
  for (let i = 0; i < pts.length - 1; i++) {
    const ok = (keep ? keep(i) : true) && pts[i].every(Number.isFinite) && pts[i + 1].every(Number.isFinite);
    if (!ok) {
      open = false;
      continue;
    }
    if (!open) {
      const [px, py] = toPx(f, ...pts[i]);
      ctx.moveTo(px, py);
      open = true;
    }
    const [qx, qy] = toPx(f, ...pts[i + 1]);
    ctx.lineTo(qx, qy);
  }
  ctx.stroke();
}

function arrowHeads(ctx: CanvasRenderingContext2D, f: Frame, pts: Vec2[], count: number, color: string, size: number) {
  const px = pts.map((p) => toPx(f, ...p));
  const cum = [0];
  for (let i = 1; i < px.length; i++) cum.push(cum[i - 1] + Math.hypot(px[i][0] - px[i - 1][0], px[i][1] - px[i - 1][1]));
  const total = cum[cum.length - 1];
  if (!(total > 0)) return;
  ctx.save();
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  for (let k = 0; k < count; k++) {
    const target = (total * (k + 0.5)) / count;
    let i = cum.findIndex((c) => c >= target);
    if (i < 1) i = 1;
    const [ax, ay] = px[i - 1];
    const [bx, by] = px[i];
    const t = (target - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(by - ay, bx - ax));
    ctx.beginPath();
    ctx.moveTo(size * 0.6, 0);
    ctx.lineTo(-size * 0.6, -size * 0.5);
    ctx.lineTo(-size * 0.3, 0);
    ctx.lineTo(-size * 0.6, size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
