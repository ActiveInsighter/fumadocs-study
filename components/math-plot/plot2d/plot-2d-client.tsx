'use client';

import { Minus, Pause, Play, Plus, RotateCcw, ScanLine } from 'lucide-react';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';

import { ErrorList, ParamControls, ToolButton, useParams, usePalette } from '../controls';
import { formatNumber, regionArea, type Vec2 } from '../core/sampling';
import type { MathPlot2DProps } from '../core/types';
import styles from '../math-plot.module.css';
import type { TexMap } from '../tex';
import { buildModel2D, pieceTex } from './model';
import { Plot2DRenderer, type SliceInfo } from './renderer';

type Spec = Omit<MathPlot2DProps, 'title' | 'description' | 'footnote' | 'className'>;

export function Plot2DClient({ spec, tex, title }: { spec: Spec; tex: TexMap; title: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Plot2DRenderer | null>(null);
  const palette = usePalette(rootRef);
  const { values, set, playing, setPlaying } = useParams(spec.params);
  const model = useMemo(() => buildModel2D({ ...spec, title }, values), [spec, title, values]);
  const shownModel = useRef(model);

  const [sliceIndex, setSliceIndex] = useState(model.slices.length ? 0 : -1);
  const activeSlice = sliceIndex >= 0 ? model.slices[sliceIndex] : undefined;
  const [sliceValue, setSliceValue] = useState(() => midpoint(model.slices[0]?.range));
  const [sweep, setSweep] = useState(false);
  const [slicePlaying, setSlicePlaying] = useState(false);
  const [hover, setHover] = useState<{ p: Vec2; inside: boolean | null } | null>(null);
  const [sliceInfo, setSliceInfo] = useState<SliceInfo | null>(null);
  const [moved, setMoved] = useState(false);

  // Create the renderer once the palette is known.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !palette || rendererRef.current) return;
    const renderer = new Plot2DRenderer(stage, palette, {
      equal: spec.equal !== false,
      minimal: Boolean(spec.minimal),
      piTicks: Boolean(spec.piTicks),
      labelHtml: (source) => tex[source],
    });
    renderer.onHover = (p, inside) => setHover(p ? { p, inside } : null);
    renderer.onSlice = setSliceInfo;
    renderer.onViewChange = setMoved;
    rendererRef.current = renderer;
    shownModel.current = model;
    renderer.setModel(model, true);
    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
    // The renderer lives for the component's lifetime; later changes are pushed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette !== null]);

  useEffect(() => {
    if (palette) rendererRef.current?.setPalette(palette);
  }, [palette]);

  useEffect(() => {
    if (!rendererRef.current || shownModel.current === model) return;
    shownModel.current = model;
    rendererRef.current.setModel(model, false);
  }, [model]);

  useEffect(() => {
    rendererRef.current?.setSlice(activeSlice ? { slice: activeSlice, value: sliceValue } : null);
  }, [activeSlice, sliceValue, model]);

  useEffect(() => {
    rendererRef.current?.setSweep(sweep);
  }, [sweep]);

  // Slice animation: ping-pong across the slice range.
  useEffect(() => {
    if (!slicePlaying || !activeSlice) return;
    const [a, b] = activeSlice.range;
    let dir = 1;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last) / 1000;
      last = now;
      setSliceValue((v) => {
        let next = v + dir * (b - a) * dt * 0.25;
        if (next >= b) {
          next = b;
          dir = -1;
        } else if (next <= a) {
          next = a;
          dir = 1;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [slicePlaying, activeSlice]);

  const area = useMemo(() => {
    if (!spec.area || !model.domain) return null;
    return regionArea(model.domain, model.view.x, model.view.y, 420);
  }, [spec.area, model]);

  const selectSlice = (index: number) => {
    setSliceIndex(index);
    setSlicePlaying(false);
    const slice = model.slices[index];
    if (slice) setSliceValue(midpoint(slice.range));
    else setSweep(false);
  };

  const piece = activeSlice?.pieces.find((p) => sliceValue >= p.from - 1e-9 && sliceValue <= p.to + 1e-9);
  const pieceSource = piece ? (piece.tex ?? pieceTex(activeSlice!.mode, piece.lo, piece.hi)) : null;

  return (
    <div ref={rootRef} className={styles.body}>
      <div
        ref={stageRef}
        className={styles.stage}
        style={stageStyle(spec, model.view)}
        role="img"
        aria-label={title}
      >
        <div className={styles.toolbar}>
          <ToolButton label="放大" onClick={() => rendererRef.current?.zoomBy(1.4)}>
            <Plus size={15} />
          </ToolButton>
          <ToolButton label="缩小" onClick={() => rendererRef.current?.zoomBy(1 / 1.4)}>
            <Minus size={15} />
          </ToolButton>
          <ToolButton label="复位视图" onClick={() => rendererRef.current?.resetView()} pressed={false}>
            <RotateCcw size={14} className={moved ? styles.attention : undefined} />
          </ToolButton>
        </div>
        <div className={styles.chip} aria-live="off">
          {hover ? (
            <>
              ({formatNumber(hover.p[0], 2)}, {formatNumber(hover.p[1], 2)})
              {hover.inside !== null ? (
                <b className={hover.inside ? styles.in : styles.out}>{hover.inside ? ' ∈ D' : ' ∉ D'}</b>
              ) : null}
            </>
          ) : (
            '拖动平移 · Ctrl/⌘ + 滚轮缩放 · 双击复位'
          )}
        </div>
      </div>

      {model.slices.length || area !== null ? (
        <div className={styles.slicePanel}>
          {model.slices.length ? (
            <div className={styles.sliceHead}>
              <div className={styles.segmented} role="tablist" aria-label="切片方式">
                {model.slices.map((slice, index) => (
                  <button
                    key={`${slice.mode}-${index}`}
                    type="button"
                    role="tab"
                    aria-selected={index === sliceIndex}
                    onClick={() => selectSlice(index)}
                  >
                    {slice.label}
                  </button>
                ))}
                <button type="button" role="tab" aria-selected={sliceIndex < 0} onClick={() => selectSlice(-1)}>
                  隐藏
                </button>
              </div>
              {activeSlice ? (
                <div className={styles.sliceTools}>
                  <ToolButton
                    label={slicePlaying ? '暂停扫描' : '播放扫描'}
                    onClick={() => setSlicePlaying((v) => !v)}
                    pressed={slicePlaying}
                  >
                    {slicePlaying ? <Pause size={14} /> : <Play size={14} />}
                  </ToolButton>
                  <ToolButton label="显示全部切片" onClick={() => setSweep((v) => !v)} pressed={sweep}>
                    <ScanLine size={14} />
                  </ToolButton>
                </div>
              ) : null}
            </div>
          ) : null}
          {activeSlice ? (
            <div className={styles.sliceRow}>
              <span className={styles.sliceVar}>{activeSlice.mode === 'polar' ? 'θ' : activeSlice.mode}</span>
              <input
                type="range"
                min={activeSlice.range[0]}
                max={activeSlice.range[1]}
                step={(activeSlice.range[1] - activeSlice.range[0]) / 400}
                value={sliceValue}
                onChange={(e) => {
                  setSlicePlaying(false);
                  setSliceValue(Number(e.target.value));
                }}
                aria-label="切片位置"
              />
              <output className={styles.sliceReadout}>{describeSlice(sliceInfo)}</output>
            </div>
          ) : null}
          {pieceSource && tex[pieceSource] ? (
            <div className={styles.piece} dangerouslySetInnerHTML={{ __html: tex[pieceSource] }} />
          ) : null}
          {area !== null ? <div className={styles.metric}>面积 ≈ {formatNumber(area, 4)}</div> : null}
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
      <ErrorList errors={model.errors} />
    </div>
  );
}

/** Fit the stage to the requested window when the axes keep a 1:1 scale. */
function stageStyle(spec: Spec, view: { x: [number, number]; y: [number, number] }): CSSProperties | undefined {
  if (spec.height) return { height: spec.height, aspectRatio: 'auto' };
  if (spec.equal === false) return undefined;
  const ratio = (view.x[1] - view.x[0]) / (view.y[1] - view.y[0]);
  if (!Number.isFinite(ratio) || ratio <= 0) return undefined;
  return { aspectRatio: `${Math.min(3, Math.max(0.75, ratio))}` };
}

function midpoint(range?: [number, number]) {
  return range ? (range[0] + range[1]) / 2 : 0;
}

function describeSlice(info: SliceInfo | null) {
  if (!info) return '';
  const variable = info.mode === 'x' ? 'y' : info.mode === 'y' ? 'x' : 'r';
  const head =
    info.mode === 'polar'
      ? `θ = ${formatNumber((info.value * 180) / Math.PI, 1)}°`
      : `${info.mode} = ${formatNumber(info.value, 2)}`;
  if (!info.intervals.length) return `${head}：切片为空`;
  const parts = info.intervals.map(([a, b]) => `${formatNumber(a, 2)} ≤ ${variable} ≤ ${formatNumber(b, 2)}`);
  return `${head}：${parts.join(' ∪ ')}`;
}
