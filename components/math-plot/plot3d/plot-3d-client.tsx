'use client';

import { Layers, Minus, Plus, Rotate3d, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { ErrorList, ParamControls, ToolButton, useNearViewport, useParams, usePalette } from '../controls';
import { solidVolume } from '../core/mesh';
import { formatNumber } from '../core/sampling';
import type { MathPlot3DProps } from '../core/types';
import styles from '../math-plot.module.css';
import type { TexMap } from '../tex';
import { type Built3D, buildModel3D } from './model';
import type { CameraState, MathScene } from './scene';

type Spec = Omit<MathPlot3DProps, 'title' | 'description' | 'footnote' | 'className'>;

/** Release the WebGL context after the figure has been off-screen this long. */
const RELEASE_AFTER_MS = 4000;

export function Plot3DClient({ spec, tex, title }: { spec: Spec; tex: TexMap; title: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MathScene | null>(null);
  const cameraRef = useRef<CameraState | null>(null);
  const palette = usePalette(rootRef);
  const { seen, visible } = useNearViewport(stageRef);
  const { values, set, playing, setPlaying } = useParams(spec.params);
  const [built, setBuilt] = useState<Built3D | null>(null);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'unsupported'>('idle');
  const [autoRotate, setAutoRotate] = useState(Boolean(spec.autoRotate));
  const [sectionOn, setSectionOn] = useState(false);
  const [sectionZ, setSectionZ] = useState<number | null>(null);

  // Geometry is built on the client only (never during SSR / static export).
  useEffect(() => {
    if (!seen) return;
    const raf = requestAnimationFrame(() => setBuilt(buildModel3D({ ...spec, title }, values)));
    return () => cancelAnimationFrame(raf);
  }, [seen, spec, title, values]);

  // Keep a scene only while the figure is near the viewport.
  useEffect(() => {
    if (visible) {
      setActive(true);
      return;
    }
    const timer = window.setTimeout(() => setActive(false), RELEASE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [visible]);

  const zScale = useMemo(() => {
    if (spec.aspect !== 'cube' || !built) return 1;
    const { x, y, z } = built.box;
    return Math.max(x[1] - x[0], y[1] - y[0]) / (z[1] - z[0] || 1);
  }, [spec.aspect, built]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!active || !palette || !stage || !built) return;
    let cancelled = false;
    let scene: MathScene | null = null;
    if (!hasWebGL()) {
      setStatus('unsupported');
      return;
    }
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    import('./scene').then(({ MathScene }) => {
      if (cancelled) return;
      scene = new MathScene(stage, palette, {
        camera: spec.camera,
        zScale,
        labelHtml: (source) => tex[source],
      });
      sceneRef.current = scene;
      scene.setModel(built, true);
      if (cameraRef.current) scene.setCamera(cameraRef.current);
      setStatus('ready');
    });
    return () => {
      cancelled = true;
      if (scene) {
        cameraRef.current = scene.getCamera();
        scene.destroy();
      }
      sceneRef.current = null;
    };
    // Rebuilt only when the scene must be recreated; data updates are pushed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, palette !== null, built !== null, zScale]);

  useEffect(() => {
    if (built) sceneRef.current?.setModel(built, false);
  }, [built]);

  useEffect(() => {
    if (palette) sceneRef.current?.setPalette(palette);
  }, [palette]);

  useEffect(() => {
    sceneRef.current?.setAutoRotate(autoRotate);
  }, [autoRotate, status]);

  const hasSolids = Boolean(built?.solids.length);
  const zRange = built?.box.z;
  useEffect(() => {
    const value = sectionOn && zRange ? (sectionZ ?? (zRange[0] + zRange[1]) / 2) : null;
    sceneRef.current?.setSection(value);
  }, [sectionOn, sectionZ, zRange, status, built]);

  const volume = useMemo(() => {
    if (!spec.volume || !built?.solids.length) return null;
    return solidVolume((x, y, z) => built.solids.some((s) => s(x, y, z)), built.box);
  }, [spec.volume, built]);

  return (
    <div ref={rootRef} className={styles.body}>
      <div
        ref={stageRef}
        className={cn(styles.stage, styles.stage3d)}
        style={spec.height ? { height: spec.height, aspectRatio: 'auto' } : undefined}
        role="img"
        aria-label={title}
      >
        {status !== 'ready' ? (
          <div className={styles.placeholder}>
            {status === 'unsupported' ? '当前浏览器不支持 WebGL，无法显示 3D 图像' : '正在加载 3D 视图…'}
          </div>
        ) : null}
        <div className={styles.toolbar}>
          <ToolButton label="放大" onClick={() => sceneRef.current?.zoomBy(1.25)}>
            <Plus size={15} />
          </ToolButton>
          <ToolButton label="缩小" onClick={() => sceneRef.current?.zoomBy(1 / 1.25)}>
            <Minus size={15} />
          </ToolButton>
          <ToolButton label="自动旋转" onClick={() => setAutoRotate((v) => !v)} pressed={autoRotate}>
            <Rotate3d size={15} />
          </ToolButton>
          {spec.section && hasSolids ? (
            <ToolButton label="水平截面" onClick={() => setSectionOn((v) => !v)} pressed={sectionOn}>
              <Layers size={15} />
            </ToolButton>
          ) : null}
          <ToolButton label="复位视角" onClick={() => sceneRef.current?.resetCamera()}>
            <RotateCcw size={14} />
          </ToolButton>
        </div>
        <div className={styles.chip} aria-live="off">
          拖动旋转 · 右键 / 双指平移 · Ctrl/⌘ + 滚轮缩放
        </div>
      </div>

      {(spec.section && hasSolids && sectionOn && zRange) || volume !== null ? (
        <div className={styles.slicePanel}>
          {spec.section && hasSolids && sectionOn && zRange ? (
            <div className={styles.sliceRow}>
              <span className={styles.sliceVar}>z</span>
              <input
                type="range"
                min={zRange[0]}
                max={zRange[1]}
                step={(zRange[1] - zRange[0]) / 300}
                value={sectionZ ?? (zRange[0] + zRange[1]) / 2}
                onChange={(e) => setSectionZ(Number(e.target.value))}
                aria-label="截面高度"
              />
              <output className={styles.sliceReadout}>
                截面 z = {formatNumber(sectionZ ?? (zRange[0] + zRange[1]) / 2, 2)}：橙色区域为 D(z)
              </output>
            </div>
          ) : null}
          {volume !== null ? <div className={styles.metric}>体积 ≈ {formatNumber(volume, 3)}（拟蒙特卡罗估计）</div> : null}
        </div>
      ) : null}

      <ParamControls
        params={spec.params ?? []}
        values={values}
        onChange={set}
        playing={playing}
        onPlay={setPlaying}
        tex={tex}
      />
      <ErrorList errors={built?.errors ?? []} />
    </div>
  );
}

let webgl: boolean | null = null;
function hasWebGL() {
  if (webgl !== null) return webgl;
  try {
    const canvas = document.createElement('canvas');
    // Three.js r163+ renders with WebGL 2 only.
    webgl = Boolean(canvas.getContext('webgl2'));
  } catch {
    webgl = false;
  }
  return webgl;
}
