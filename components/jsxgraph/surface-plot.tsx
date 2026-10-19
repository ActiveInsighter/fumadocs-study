'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Board, Slider, View3D, View3DAttributes } from 'jsxgraph';
import { JSXGraphBoard } from './board';
import { ParameterControls } from './parameter-controls';
import { bindPlotExpression, initialParameterValues, PLOT_COLORS } from './model';
import { createSurfaceEvaluator, DEFAULT_SPACE_BOX, fitSurfaceBox, formatSpaceCoordinate, replaceSurfaceExpressions, surfaceExpressions, surfaceRanges, SURFACE_VIEWS, validateSurfaceConfig, type ExpressionCompiler, type SurfaceEvaluator } from './surface-model';
import type { SpaceBox, SurfacePlotProps } from './surface-types';
import type { BoundingBox, PlotParameter } from './types';
import styles from './jsxgraph.module.css';

const FRAME: BoundingBox = [-6.5, 5.5, 6.5, -5.5];
const EMPTY_PARAMETERS: PlotParameter[] = [];
const BOARD_OPTIONS = { pan: { enabled: false }, zoom: { wheel: false }, keepaspectratio: true };

// JSXGraph 1.14's bundled declarations omit these documented View3D APIs.
interface InteractiveView extends View3D {
  bbox3D: SpaceBox;
  az_slide: Slider;
  el_slide: Slider;
  bank_slide: Slider;
  setView(azimuth: number, elevation: number, distance?: number): this;
}

function colorHue(color: string, index: number): number {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex) return [220, 345, 170, 275, 40][index % 5];
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const maximum = Math.max(r, g, b), delta = maximum - Math.min(r, g, b);
  if (!delta) return 220;
  const hue = maximum === r ? (g - b) / delta : maximum === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return (hue * 60 + 360) % 360;
}

function cameraBox(box: SpaceBox): SpaceBox {
  // Parallel View3D scales against x/y extents only. A cubic camera volume
  // keeps tall surfaces inside the viewport without distorting coordinates.
  const span = Math.max(...box.map(([min, max]) => max - min));
  return box.map(([min, max]) => {
    const center = min + (max - min) / 2;
    return [center - span / 2, center + span / 2];
  }) as SpaceBox;
}

export function SurfacePlot(props: SurfacePlotProps) {
  try { validateSurfaceConfig(props); }
  catch (error) { return <p role="alert" className={styles.error}>三维画图配置无效：{error instanceof Error ? error.message : String(error)}</p>; }
  return <ConfiguredSurfacePlot key={JSON.stringify(props)} {...props} />;
}

function ConfiguredSurfacePlot({ title = '三维交互图像', description, height = 500, plots, parameters = EMPTY_PARAMETERS, box = DEFAULT_SPACE_BOX, mesh = 14, probe = true, editable = true, projection = 'parallel' }: SurfacePlotProps) {
  const id = useId();
  const [values, setValues] = useState(() => initialParameterValues(parameters));
  const valuesRef = useRef(values);
  const boardRef = useRef<Board | null>(null);
  const viewRef = useRef<InteractiveView | null>(null);
  const viewBoxRef = useRef<SpaceBox>(box);
  const compileRef = useRef<ExpressionCompiler | null>(null);
  const evaluatorsRef = useRef<SurfaceEvaluator[]>([]);
  const [ready, setReady] = useState(false);
  const [drafts, setDrafts] = useState(() => plots.map((plot) => surfaceExpressions(plot).map(([, expression]) => expression)));
  const [drawError, setDrawError] = useState('');
  const [notice, setNotice] = useState('');
  const [shown, setShown] = useState(() => plots.map(() => true));
  const shownRef = useRef(shown);
  const [showMesh, setShowMesh] = useState(true);
  const showMeshRef = useRef(showMesh);
  const [density, setDensity] = useState(mesh);
  const densityRef = useRef(density);
  const [showFill, setShowFill] = useState(true);
  const showFillRef = useRef(showFill);
  const [probeIndex, setProbeIndex] = useState(0);
  const probeIndexRef = useRef(probeIndex);
  const [probePosition, setProbePosition] = useState([0.6, 0.5]);
  const probePositionRef = useRef(probePosition);
  const [activeView, setActiveView] = useState<string | null>(SURFACE_VIEWS[0].label);

  const setup = useCallback((board: Board) => {
    const names = parameters.map((parameter) => parameter.name);
    const compile: ExpressionCompiler = (expression, variables) => {
      const evaluate = board.jc.snippet(expression, true, [...variables, ...names].join(','), false) as (...args: number[]) => number;
      return bindPlotExpression(evaluate, variables.length, names, () => valuesRef.current);
    };
    const evaluators = plots.map((plot) => createSurfaceEvaluator(plot, compile));
    evaluatorsRef.current = evaluators;
    compileRef.current = compile;
    const axis = (color: string, name: string) => ({ name, strokeColor: color, strokeWidth: 1.5, withLabel: true, label: { strokeColor: color, fontSize: 13, display: 'internal' } });
    const viewAttributes = {
      projection, axesPosition: 'none',
      trackball: { enabled: true, button: 0, key: 'none', outside: true },
      az: { slider: { visible: false, start: SURFACE_VIEWS[0].azimuth }, keyboard: { enabled: true, key: 'none' } },
      el: { slider: { visible: false, start: SURFACE_VIEWS[0].elevation }, keyboard: { enabled: true, key: 'none' } },
      bank: { slider: { visible: false } },
      xAxis: axis('#d97706', 'x'), yAxis: axis('#0d9488', 'y'), zAxis: axis('#6366f1', 'z'),
      xPlaneFront: { visible: false }, yPlaneFront: { visible: false }, zPlaneFront: { visible: false },
      xPlaneRear: { visible: false }, yPlaneRear: { visible: false }, zPlaneRear: { visible: false },
      depthOrder: { enabled: true },
    } as unknown as View3DAttributes;
    viewBoxRef.current = box;
    const view = board.create('view3d', [[-5, -4.1], [10, 8.2], cameraBox(box)], viewAttributes) as InteractiveView;
    // The shipped declarations also omit function-valued attributes for some
    // 3D elements. This narrow bridge follows the installed 1.14 source API.
    const create3D = view.create.bind(view) as (kind: 'line3d' | 'curve3d' | 'point3d' | 'functiongraph3d' | 'parametricsurface3d', parents: unknown[], attributes: Record<string, unknown>) => unknown;
    const cross = (coordinate: number) => Math.max(viewBoxRef.current[coordinate][0], Math.min(0, viewBoxRef.current[coordinate][1]));
    ['x', 'y', 'z'].forEach((name, axisIndex) => {
      const endpoint = (end: 0 | 1) => [0, 1, 2].map((coordinate) => () => coordinate === axisIndex ? viewBoxRef.current[coordinate][end] : cross(coordinate));
      create3D('line3d', [endpoint(0), endpoint(1)], { ...axis(['#d97706', '#0d9488', '#6366f1'][axisIndex], name), straightFirst: false, straightLast: false, lastArrow: true, fixed: true, point1: { visible: false }, point2: { visible: false } });
    });
    const onPointerDown = () => setActiveView(null);
    board.containerObj.addEventListener('pointerdown', onPointerDown, { passive: true });

    plots.forEach((plot, index) => {
      const color = plot.color ?? PLOT_COLORS[index % PLOT_COLORS.length];
      const evaluate = (...coordinates: number[]) => evaluatorsRef.current[index](...coordinates);
      if (plot.type === 'parametric-curve') {
        create3D('curve3d', [
          (t: number) => evaluate(t)[0], (t: number) => evaluate(t)[1], (t: number) => evaluate(t)[2], plot.range,
        ], { strokeColor: color, strokeWidth: 3, highlight: false, visible: () => shownRef.current[index], numberPointsHigh: 400 });
        return;
      }
      const ranges = surfaceRanges(plot, box);
      const parents = plot.type === 'surface'
        ? [(x: number, y: number) => evaluate(x, y)[2], ...ranges]
        : [(u: number, v: number) => evaluate(u, v)[0], (u: number, v: number) => evaluate(u, v)[1], (u: number, v: number) => evaluate(u, v)[2], ...ranges];
      const elementType = plot.type === 'surface' ? 'functiongraph3d' : 'parametricsurface3d';
      // Native surface topology is immutable in JSXGraph. Keep the shaded mesh
      // and a separate adjustable wireframe alive; parameter edits update both.
      create3D(elementType, parents, {
        type: 'shader', tiling: 'rectangle', stepsU: mesh, stepsV: mesh,
        polyhedron: {
          visible: () => shownRef.current[index] && showFillRef.current,
          fillColorArray: [color], fillOpacity: 0.9, strokeWidth: 0, highlight: false,
          shader: { enabled: true, fixed: false, hue: colorHue(color, index), saturation: 72, minLightness: 38, maxLightness: 76 },
        },
      });
      create3D(elementType, parents, {
        type: 'wireframe', stepsU: () => densityRef.current, stepsV: () => densityRef.current,
        strokeColor: color, strokeWidth: 0.65, strokeOpacity: 0.8, highlight: false,
        visible: () => shownRef.current[index] && showMeshRef.current,
      });
    });

    if (probe) {
      const coordinates = () => {
        const index = probeIndexRef.current;
        const ranges = surfaceRanges(plots[index], box);
        const inputs = ranges.map(([min, max], axisIndex) => min + (max - min) * probePositionRef.current[axisIndex]);
        try { return evaluatorsRef.current[index](...inputs); }
        catch { return [NaN, NaN, NaN]; }
      };
      create3D('point3d', [() => coordinates()[0], () => coordinates()[1], () => coordinates()[2]], {
        name: 'P', size: 4, fixed: true, fillColor: '#f59e0b', strokeColor: '#92400e',
        visible: () => shownRef.current[probeIndexRef.current] && coordinates().every(Number.isFinite),
        label: { strokeColor: '#b45309', display: 'internal', offset: [8, 8] },
      });
    }
    boardRef.current = board;
    viewRef.current = view;
    setReady(true);
    return () => { board.containerObj.removeEventListener('pointerdown', onPointerDown); boardRef.current = null; viewRef.current = null; compileRef.current = null; };
  }, [box, mesh, parameters, plots, probe, projection]);

  const resetView = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    viewBoxRef.current = box;
    view.bbox3D = cameraBox(box);
    view.bank_slide.setValue(0);
    view.setView(SURFACE_VIEWS[0].azimuth, SURFACE_VIEWS[0].elevation);
    setActiveView(SURFACE_VIEWS[0].label);
  }, [box]);

  function fitImage() {
    const view = viewRef.current;
    if (!view) return;
    try {
      const fitted = fitSurfaceBox(plots, evaluatorsRef.current, shownRef.current, box);
      viewBoxRef.current = fitted;
      view.bbox3D = cameraBox(fitted);
      boardRef.current?.setBoundingBox([...FRAME], true);
      boardRef.current?.update();
      setNotice('已按当前图像的采样范围调整视图。');
      setDrawError('');
    } catch (error) { setDrawError(error instanceof Error ? error.message : String(error)); }
  }

  function changeValues(next: Record<string, number>) {
    valuesRef.current = next;
    setValues(next);
    boardRef.current?.update();
  }

  function drawExpressions() {
    const compile = compileRef.current;
    if (!compile) return;
    const previous = evaluatorsRef.current;
    try {
      const candidates = plots.map((plot, index) => replaceSurfaceExpressions(plot, drafts[index]));
      validateSurfaceConfig({ plots: candidates, parameters, box, mesh, height, projection });
      const next = candidates.map((plot) => createSurfaceEvaluator(plot, compile));
      // Evaluation catches unknown variables as well as parser errors. A domain
      // singularity may legitimately return NaN, so only thrown errors reject it.
      next.forEach((evaluate, index) => evaluate(...surfaceRanges(candidates[index], box).map(([min, max]) => (min + max) / 2)));
      evaluatorsRef.current = next;
      boardRef.current?.update();
      setDrawError('');
      setNotice('图像已更新，当前视角已保留。');
    } catch (error) {
      evaluatorsRef.current = previous;
      boardRef.current?.update();
      setNotice('');
      setDrawError(`表达式未生效，已保留上次图像：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const currentPlot = plots[probeIndex];
  const ranges = surfaceRanges(currentPlot, box);
  const probeVariables = currentPlot.type === 'surface' ? ['x', 'y'] : currentPlot.type === 'parametric-surface' ? ['u', 'v'] : ['t'];
  const inputs = ranges.map(([min, max], index) => min + (max - min) * probePosition[index]);
  let coordinates: number[] = [NaN, NaN, NaN];
  try { coordinates = evaluatorsRef.current[probeIndex]?.(...inputs) ?? coordinates; } catch { /* Show the undefined readout at singularities. */ }
  const hasSurfaces = plots.some((plot) => plot.type !== 'parametric-curve');

  return (
    <JSXGraphBoard title={title} description={description} height={height} boundingBox={FRAME} axis={false} grid={false} mode="3d" options={BOARD_OPTIONS} onInit={setup} onReset={resetView}
      hint="拖动空白处旋转三维图像；触屏单指旋转。可用视角按钮、公式输入框和探针面板操作；x 为橙色、y 为绿色、z 为紫色。"
      toolbar={<><button type="button" disabled={!ready} onClick={fitImage}>适应图像</button>{SURFACE_VIEWS.map(({ label, azimuth, elevation }) => <button key={label} type="button" disabled={!ready} aria-pressed={activeView === label} onClick={() => { const view = viewRef.current; if (view) { view.bank_slide.setValue(0); view.setView(azimuth, elevation); setActiveView(label); } }}>{label}</button>)}</>}
    >
      <div className={styles.panel}>
        <div className={styles.expressionList} aria-label="三维图像与公式">
          {plots.map((plot, index) => <div className={styles.expressionRow} key={index}>
            <label className={styles.check}><input type="checkbox" checked={shown[index]} onChange={(event) => { const next = shownRef.current.map((value, item) => item === index ? event.currentTarget.checked : value); shownRef.current = next; setShown(next); boardRef.current?.update(); }} /><span style={{ color: plot.color ?? PLOT_COLORS[index % PLOT_COLORS.length] }}>{plot.label ?? `图像 ${index + 1}`}</span></label>
            {surfaceExpressions(plot).map(([label], expressionIndex) => editable ? <label className={styles.field} key={label} htmlFor={`${id}-expression-${index}-${expressionIndex}`}><span>{label}</span><input id={`${id}-expression-${index}-${expressionIndex}`} className={styles.expressionInput} type="text" spellCheck={false} value={drafts[index][expressionIndex]} onChange={(event) => { const value = event.currentTarget.value; setDrafts((previous) => previous.map((row, item) => item === index ? row.map((expression, column) => column === expressionIndex ? value : expression) : row)); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); drawExpressions(); } }} /></label> : <code key={label}>{label} = {drafts[index][expressionIndex]}</code>)}
          </div>)}
        </div>
        {editable ? <div className={styles.controls}><button type="button" disabled={!ready} onClick={drawExpressions}>绘制图像</button><button type="button" disabled={!ready} onClick={() => { setDrafts(plots.map((plot) => surfaceExpressions(plot).map(([, expression]) => expression))); if (compileRef.current) { evaluatorsRef.current = plots.map((plot) => createSurfaceEvaluator(plot, compileRef.current!)); boardRef.current?.update(); } setDrawError(''); setNotice('已恢复文档中的原始公式。'); }}>恢复公式</button></div> : null}
        {drawError ? <p role="alert" className={styles.error}>{drawError}</p> : null}
        {notice ? <p role="status" className={styles.readout}>{notice}</p> : null}
        {hasSurfaces ? <div className={styles.controls} aria-label="曲面显示设置">
          <label className={styles.check}><input type="checkbox" checked={showFill} onChange={(event) => { showFillRef.current = event.currentTarget.checked; setShowFill(event.currentTarget.checked); boardRef.current?.update(); }} />显示曲面</label>
          <label className={styles.check}><input type="checkbox" checked={showMesh} onChange={(event) => { showMeshRef.current = event.currentTarget.checked; setShowMesh(event.currentTarget.checked); boardRef.current?.update(); }} />显示网格</label>
          <label className={styles.field} htmlFor={`${id}-mesh`}>辅助网格密度 <output>{density}</output><input id={`${id}-mesh`} type="range" min={8} max={32} step={2} value={density} disabled={!showMesh} onChange={(event) => { densityRef.current = Number(event.currentTarget.value); setDensity(densityRef.current); boardRef.current?.update(); }} /></label>
        </div> : null}
        {probe ? <div aria-label="三维坐标探针">
          <p className={styles.sectionTitle}>坐标探针</p>
          {plots.length > 1 ? <label className={styles.field} htmlFor={`${id}-probe-target`}>查看图像<select id={`${id}-probe-target`} value={probeIndex} onChange={(event) => { probeIndexRef.current = Number(event.currentTarget.value); setProbeIndex(probeIndexRef.current); boardRef.current?.update(); }}>{plots.map((plot, index) => <option value={index} key={index}>{plot.label ?? `图像 ${index + 1}`}</option>)}</select></label> : null}
          <div className={styles.controls}>{ranges.map(([min, max], index) => <label className={styles.field} htmlFor={`${id}-probe-${index}`} key={probeVariables[index]}><span>{probeVariables[index]} <output>{formatSpaceCoordinate(inputs[index])}</output></span><input id={`${id}-probe-${index}`} type="range" min={min} max={max} step={(max - min) / 200} value={inputs[index]} onChange={(event) => { const next = probePositionRef.current.map((value, item) => item === index ? (Number(event.currentTarget.value) - min) / (max - min) : value); probePositionRef.current = next; setProbePosition(next); boardRef.current?.update(); }} /><ProbeNumberInput label={`${probeVariables[index]} 坐标数值`} min={min} max={max} step={(max - min) / 200} value={inputs[index]} onCommit={(value) => { const next = probePositionRef.current.map((position, item) => item === index ? (value - min) / (max - min) : position); probePositionRef.current = next; setProbePosition(next); boardRef.current?.update(); }} /></label>)}</div>
          <output className={styles.readout}>{ready ? <>P = ({coordinates.map(formatSpaceCoordinate).join(', ')}){coordinates.every(Number.isFinite) ? '' : ' · 当前坐标处函数未定义'}</> : '画板加载后显示三维坐标。'}</output>
        </div> : null}
        {parameters.length ? <ParameterControls parameters={parameters} values={values} onChange={changeValues} onReset={() => changeValues(initialParameterValues(parameters))} /> : null}
      </div>
    </JSXGraphBoard>
  );
}

function ProbeNumberInput({ label, value, min, max, step, onCommit }: { label: string; value: number; min: number; max: number; step: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(Number(value.toFixed(6))));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(String(Number(value.toFixed(6)))); }, [value]);
  function commit() {
    if (!focused.current) return;
    focused.current = false;
    const number = draft.trim() ? Number(draft) : NaN;
    const next = Number.isFinite(number) && number >= min && number <= max ? number : value;
    setDraft(String(Number(next.toFixed(6))));
    if (next !== value) onCommit(next);
  }
  return <input aria-label={label} type="number" min={min} max={max} step={step} value={draft} onFocus={() => { focused.current = true; }} onChange={(event) => setDraft(event.currentTarget.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') { commit(); event.currentTarget.blur(); } else if (event.key === 'Escape') { focused.current = false; setDraft(String(Number(value.toFixed(6)))); event.currentTarget.blur(); } }} />;
}
