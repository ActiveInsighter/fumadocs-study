'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Focus, Pause, Play, RotateCcw, Rotate3d } from 'lucide-react';
import type { Board } from 'jsxgraph';
import { createCompiler, type ExpressionCompiler } from '../core/expression';
import { errorMessage, formatNumber, formatSpaceCoordinate } from '../core/format';
import { initialParameterValues, startParameterAnimation, type PlotParameter } from '../core/parameters';
import { seriesColor } from '../core/theme';
import { JSXGraphBoard, type BoardContext } from '../ui/board';
import { MathText } from '../ui/math-text';
import { ParameterControls } from '../ui/parameter-controls';
import { cx, IconButton, NumberInput, Section, Segmented, Slider, Switch } from '../ui/primitives';
import { AXES, createRuntime, DEFAULT_SPACE_BOX, evaluateProbe, fitSurfaceBox, planeAxes, probeVariables, replaceSurfaceExpressions, surfaceExpressions, surfaceRanges, SURFACE_TITLES, SURFACE_VIEWS, validateSurfaceConfig, validateSurfaceDefinition, type PlotRuntime } from './model';
import { QUADRIC_KINDS, QUADRICS, quadricSection, quadricTex, quadricUses } from './quadrics';
import { buildScene, cameraBox, FRAME, type DisplayOptions, type InteractiveView, type Scene, type SectionState } from './scene';
import type { Axis, QuadricDefinition, SpaceBox, SpacePoint, SurfaceDefinition, SurfacePlotProps } from './types';
import styles from '../ui/jsxgraph.module.css';

const EMPTY_PARAMETERS: PlotParameter[] = [];
const EMPTY_POINTS: SpacePoint[] = [];
const BOARD_OPTIONS = { pan: { enabled: false }, zoom: { wheel: false }, keepaspectratio: true };
const NAN_RUNTIME: PlotRuntime = { patches: [() => [NaN, NaN, NaN], () => [NaN, NaN, NaN]], sheets: () => 0 };

export function SurfacePlot(props: SurfacePlotProps) {
  try { validateSurfaceConfig(props); }
  catch (error) { return <p role="alert" className={styles.error}>三维画图配置无效：{errorMessage(error)}</p>; }
  return <ConfiguredSurfacePlot key={JSON.stringify(props)} {...props} />;
}

/** Keep a value in state for rendering and in a ref for JSXGraph callbacks. */
function useLive<T>(initial: T | (() => T)) {
  const [value, setValue] = useState(initial);
  const ref = useRef(value);
  const set = useCallback((next: T) => { ref.current = next; setValue(next); }, []);
  return [value, set, ref] as const;
}

function ConfiguredSurfacePlot({
  title = '三维交互图像', description, height = 500, plots, parameters = EMPTY_PARAMETERS, points = EMPTY_POINTS,
  box = DEFAULT_SPACE_BOX, mesh = 14, probe = true, editable = true, projection = 'parallel', section, opacity = 0.9,
}: SurfacePlotProps) {
  const [definitions, setDefinitions, definitionsRef] = useLive(plots);
  const [values, setValues, valuesRef] = useLive(() => initialParameterValues(parameters));
  const [shown, setShown, shownRef] = useLive(() => plots.map(() => true));
  const [display, setDisplay, displayRef] = useLive<DisplayOptions>({ fill: true, mesh: true, density: mesh, opacity, frame: true });
  const initialSection: SectionState = { enabled: Boolean(section), axis: (typeof section === 'object' && section.axis) || 'z', value: (typeof section === 'object' && section.value) || 0 };
  const [sectionState, setSection, sectionRef] = useLive(initialSection);
  const firstProbe = plots.findIndex((plot) => plot.type !== 'implicit-surface');
  const [probeState, setProbe, probeRef] = useLive(probe && firstProbe >= 0 ? { index: firstProbe, fractions: [0.6, 0.5] } : null);
  const boxRef = useRef<SpaceBox>(box);
  const revisionRef = useRef(0);
  const runtimesRef = useRef<PlotRuntime[]>([]);
  const compileRef = useRef<ExpressionCompiler | null>(null);
  const boardRef = useRef<Board | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [ready, setReady] = useState(false);
  const [, setTick] = useState(0);
  const [errors, setErrors] = useState<string[]>(() => plots.map(() => ''));
  const [notice, setNotice] = useState('');
  const [activeView, setActiveView] = useState<string | null>(SURFACE_VIEWS[0].label);
  const [spinning, setSpinning] = useState(false);
  const [sweeping, setSweeping] = useState(false);

  const refresh = useCallback(() => { revisionRef.current++; boardRef.current?.update(); }, []);

  const setup = useCallback((board: Board, { theme }: BoardContext) => {
    const compile = createCompiler(board, parameters.map(({ name }) => name), () => valuesRef.current);
    compileRef.current = compile;
    const failures = definitionsRef.current.map(() => '');
    runtimesRef.current = definitionsRef.current.map((plot, index) => {
      try { return createRuntime(plot, compile, boxRef.current, () => revisionRef.current); }
      catch (error) { failures[index] = errorMessage(error); return NAN_RUNTIME; }
    });
    setErrors(failures);
    const scene = buildScene(board, {
      definitions: () => definitionsRef.current,
      runtimes: () => runtimesRef.current,
      shown: (index) => shownRef.current[index],
      display: () => displayRef.current,
      section: () => sectionRef.current,
      probe: () => probeRef.current,
      revision: () => revisionRef.current,
      box: () => boxRef.current,
      theme,
    }, { initialBox: boxRef.current, mesh, projection, points, compile });
    sceneRef.current = scene;
    boardRef.current = board;
    const onPointerDown = () => { setActiveView(null); setSpinning(false); };
    board.containerObj.addEventListener('pointerdown', onPointerDown, { passive: true });
    let frame = 0;
    const tick = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => setTick((value) => value + 1)); };
    board.on('update', tick);
    setReady(true);
    return () => {
      cancelAnimationFrame(frame);
      board.off('update', tick);
      board.containerObj.removeEventListener('pointerdown', onPointerDown);
      boardRef.current = null; sceneRef.current = null; compileRef.current = null;
    };
  }, [definitionsRef, displayRef, mesh, parameters, points, probeRef, projection, sectionRef, shownRef, valuesRef]);

  // Auto-rotation turns the camera slowly; any drag on the board stops it.
  useEffect(() => {
    if (!spinning) return;
    let frame = 0, previous: number | undefined;
    const turn = (time: number) => {
      const view = sceneRef.current?.view;
      if (view && previous !== undefined && !document.hidden) {
        view.setView(view.az_slide.Value() + Math.min(time - previous, 50) * 0.00035, view.el_slide.Value());
      }
      previous = time;
      frame = requestAnimationFrame(turn);
    };
    frame = requestAnimationFrame(turn);
    return () => cancelAnimationFrame(frame);
  }, [spinning]);

  // Sweep the section plane back and forth through the box.
  useEffect(() => {
    if (!sweeping) return;
    const index = AXES.indexOf(sectionRef.current.axis);
    const [min, max] = boxRef.current[index];
    return startParameterAnimation({ name: 'level', min, max, value: sectionRef.current.value, step: (max - min) / 200 }, {
      getValues: () => ({ level: sectionRef.current.value }),
      onChange: ({ level }) => { setSection({ ...sectionRef.current, value: level }); boardRef.current?.update(); },
      requestFrame: (callback) => requestAnimationFrame(callback),
      cancelFrame: (frame) => cancelAnimationFrame(frame),
      isHidden: () => document.hidden,
    });
  }, [sweeping, sectionRef, setSection]);

  function changeValues(next: Record<string, number>) { setValues(next); refresh(); }
  function changeDisplay(change: Partial<DisplayOptions>) { setDisplay({ ...displayRef.current, ...change }); refresh(); }
  function changeSection(change: Partial<SectionState>) {
    const next = { ...sectionRef.current, ...change };
    if (change.axis && change.axis !== sectionRef.current.axis) {
      const [min, max] = boxRef.current[AXES.indexOf(change.axis)];
      next.value = Math.min(max, Math.max(min, 0));
      setSweeping(false);
    }
    if (change.value !== undefined) setSweeping(false);
    setSection(next);
    boardRef.current?.update();
  }

  function setView(azimuth: number, elevation: number, label: string) {
    const view = sceneRef.current?.view;
    if (!view) return;
    setSpinning(false);
    view.bank_slide.setValue(0);
    view.setView(azimuth, elevation);
    setActiveView(label);
  }

  const resetView = useCallback(() => {
    const view = sceneRef.current?.view;
    if (!view) return;
    boxRef.current = box;
    view.bbox3D = cameraBox(box);
    setSpinning(false);
    view.bank_slide.setValue(0);
    view.setView(SURFACE_VIEWS[0].azimuth, SURFACE_VIEWS[0].elevation);
    setActiveView(SURFACE_VIEWS[0].label);
    revisionRef.current++;
  }, [box]);

  function fitImage() {
    const view = sceneRef.current?.view;
    if (!view) return;
    try {
      const fitted = fitSurfaceBox(definitionsRef.current, runtimesRef.current, shownRef.current, boxRef.current);
      boxRef.current = fitted;
      view.bbox3D = cameraBox(fitted);
      boardRef.current?.setBoundingBox([...FRAME], true);
      refresh();
      setNotice('已按当前图像调整坐标范围。');
    } catch (error) { setNotice(errorMessage(error)); }
  }

  function draw(index: number, definition: SurfaceDefinition) {
    const compile = compileRef.current;
    if (!compile) return;
    try {
      validateSurfaceDefinition(definition, box);
      const runtime = createRuntime(definition, compile, boxRef.current, () => revisionRef.current);
      runtimesRef.current = runtimesRef.current.map((item, position) => position === index ? runtime : item);
      setDefinitions(definitionsRef.current.map((item, position) => position === index ? definition : item));
      setErrors((old) => old.map((message, position) => position === index ? '' : message));
      setNotice('');
      refresh();
    } catch (error) {
      setErrors((old) => old.map((message, position) => position === index ? `${errorMessage(error).replace(/。$/, '')}，已保留上次图像。` : message));
    }
  }

  function restore() {
    const compile = compileRef.current;
    if (!compile) return;
    const failures = plots.map(() => '');
    runtimesRef.current = plots.map((plot, index) => {
      try { return createRuntime(plot, compile, boxRef.current, () => revisionRef.current); }
      catch (error) { failures[index] = errorMessage(error); return NAN_RUNTIME; }
    });
    setDefinitions(plots);
    setErrors(failures);
    setNotice('已恢复文档中的原始公式。');
    refresh();
  }

  const scene = sceneRef.current;
  const hasSurfaces = definitions.some((plot) => plot.type !== 'parametric-curve');
  const hasSheets = definitions.some((plot) => plot.type !== 'parametric-curve' && plot.type !== 'implicit-surface');
  const sectionIndex = AXES.indexOf(sectionState.axis);
  const [sectionMin, sectionMax] = boxRef.current[sectionIndex];

  return (
    <JSXGraphBoard title={title} description={description} height={height} boundingBox={FRAME} axis={false} grid={false} mode="3d" options={BOARD_OPTIONS} onInit={setup} onReset={resetView}
      hint="拖动画面旋转；视角按钮快速切换方向。打开“截面”可用平面切开曲面，观察截痕形状。"
      toolbar={<>
        {SURFACE_VIEWS.map(({ label, azimuth, elevation }) => <button key={label} type="button" className={styles.iconButton} aria-pressed={activeView === label} disabled={!ready} onClick={() => setView(azimuth, elevation, label)}>{label}</button>)}
        <IconButton label="适应图像" icon={<Focus aria-hidden />} disabled={!ready} onClick={fitImage} />
        <IconButton label="自动旋转" icon={<Rotate3d aria-hidden />} pressed={spinning} disabled={!ready} onClick={() => { setSpinning((value) => !value); setActiveView(null); }} />
      </>}
    >
      <Section title="图像与公式" label="三维图像与公式" meta={`${definitions.length} 个`} actions={editable ? <IconButton label="恢复公式" icon={<RotateCcw aria-hidden />} disabled={!ready} onClick={restore} /> : null}>
        <div className={styles.rows}>
          {definitions.map((plot, index) => {
            const color = seriesColor(index, plot.color);
            const quadric = plot.type === 'quadric' ? scene && ready ? runtimesRef.current[index]?.quadric?.() : null : null;
            return <div key={index} className={cx(styles.row, !shown[index] && styles.rowHidden)}>
              <div className={styles.rowHead}>
                <label className={styles.legend} title={shown[index] ? '隐藏图像' : '显示图像'}>
                  <input type="checkbox" checked={shown[index]} onChange={() => { setShown(shownRef.current.map((value, item) => item === index ? !value : value)); refresh(); }} />
                  <span className={styles.swatch} style={{ '--swatch': color } as CSSProperties} aria-hidden />
                  {plot.label ?? (plot.type === 'quadric' ? QUADRICS[plot.kind].name : `图像 ${index + 1}`)}
                  <span className={styles.kindTag}>{plot.type === 'quadric' ? '二次曲面' : SURFACE_TITLES[plot.type]}</span>
                </label>
              </div>
              {plot.type === 'quadric' ? <>
                <MathText tex={quadricTex(plot.kind, { axis: plot.axis ?? 'z', center: [0, 0, 0] }, null)} label={`${QUADRICS[plot.kind].name}标准方程`} />
                {quadric ? <MathText tex={quadricTex(plot.kind, quadric.placement, quadric.values)} label="当前方程" /> : null}
                {editable ? <QuadricEditor key={JSON.stringify(plot)} definition={plot} ready={ready} onDraw={(definition) => draw(index, definition)} /> : null}
              </> : editable
                ? <ExpressionEditor key={JSON.stringify(plot)} definition={plot} ready={ready} onDraw={(definition) => draw(index, definition)} />
                : <code className={styles.formula}>{surfaceExpressions(plot).map(([label, expression]) => `${label} = ${expression}`).join('，')}</code>}
              {errors[index] ? <p role="alert" className={styles.error}>{errors[index]}</p> : null}
            </div>;
          })}
        </div>
        {notice ? <p role="status" className={styles.note}>{notice}</p> : null}
      </Section>

      {hasSurfaces ? <Section title="截面" label="截面" defaultOpen={Boolean(section)} meta={sectionState.enabled ? `${sectionState.axis} = ${formatNumber(sectionState.value, 2)}` : '关闭'}>
        <div className={styles.controlRow}>
          <Switch checked={sectionState.enabled} disabled={!ready} onChange={(enabled) => { changeSection({ enabled }); if (!enabled) setSweeping(false); }}>显示截面</Switch>
          <Segmented label="截面方向" value={sectionState.axis} disabled={!ready} onChange={(axis: Axis) => changeSection({ axis, enabled: true })} options={AXES.map((axis) => ({ value: axis, label: `${axis} = k` }))} />
        </div>
        <div className={styles.controlRow}>
          <div style={{ flex: '1 1 14rem' }}><Slider label={`k（${sectionState.axis} 的取值）`} min={sectionMin} max={sectionMax} step={(sectionMax - sectionMin) / 200} value={sectionState.value} disabled={!ready} format={(value) => formatNumber(value, 2)} onChange={(value) => changeSection({ value, enabled: true })} /></div>
          <NumberInput label="截面位置 k" value={sectionState.value} min={sectionMin} max={sectionMax} className={styles.compact} onCommit={(value) => changeSection({ value, enabled: true })} />
          <IconButton label={sweeping ? '暂停扫描' : '扫描截面'} icon={sweeping ? <Pause aria-hidden /> : <Play aria-hidden />} pressed={sweeping} disabled={!ready} onClick={() => { if (!sectionRef.current.enabled) changeSection({ enabled: true }); setSweeping((value) => !value); }} />
        </div>
        {sectionState.enabled && scene ? <div className={styles.sectionGrid}>
          <div className={styles.rows}>
            {definitions.map((plot, index) => {
              if (!shown[index] || plot.type === 'parametric-curve') return null;
              const runtime = runtimesRef.current[index];
              const quadric = plot.type === 'quadric' ? runtime?.quadric?.() : null;
              const analysis = plot.type === 'quadric' && quadric ? quadricSection(plot.kind, quadric.values, quadric.placement, sectionState.axis, sectionState.value) : null;
              const empty = !scene.section(index)?.segments.length;
              return <div key={index} className={styles.readout}>
                <span className={styles.stat}><span style={{ color: seriesColor(index, plot.color) }}>■</span><strong>{plot.label ?? (plot.type === 'quadric' ? QUADRICS[plot.kind].name : `图像 ${index + 1}`)}</strong></span>
                {analysis ? <><span className={styles.stat}><span>截痕</span><strong>{analysis.curve}</strong></span><MathText tex={analysis.tex} label="截痕方程" /></>
                  : <><span className={styles.stat}><span>截痕</span><strong>{empty ? '此处无交线' : '见截面图'}</strong></span>{empty ? null : <code className={styles.formula}>{traceEquation(plot, sectionState.axis, sectionState.value)}</code>}</>}
              </div>;
            })}
          </div>
          <SectionInset scene={scene} definitions={definitions} shown={shown} axis={sectionState.axis} box={boxRef.current} />
        </div> : <p className={styles.note}>截面是平面 {sectionState.axis} = k 与曲面的交线。移动 k 或点击扫描，观察截痕从椭圆变成双曲线等变化。</p>}
      </Section> : null}

      {hasSurfaces ? <Section title="显示" label="曲面显示设置" defaultOpen={false}>
        <div className={styles.controlRow}>
          {hasSheets ? <>
            <Switch checked={display.fill} disabled={!ready} onChange={(fill) => changeDisplay({ fill })}>显示曲面</Switch>
            <Switch checked={display.mesh} disabled={!ready} onChange={(meshShown) => changeDisplay({ mesh: meshShown })}>显示网格</Switch>
          </> : null}
          <Switch checked={display.frame} disabled={!ready} onChange={(frame) => changeDisplay({ frame })}>边框</Switch>
        </div>
        <Slider label={hasSheets ? '网格密度' : '截线密度'} min={8} max={40} step={2} value={display.density} disabled={!ready} onChange={(density) => changeDisplay({ density })} />
        {hasSheets ? <Slider label="曲面不透明度" min={0.2} max={1} step={0.05} value={display.opacity} disabled={!ready || !display.fill} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => changeDisplay({ opacity: value })} /> : null}
      </Section> : null}

      {probe && probeState ? <ProbePanel definitions={definitions} runtimes={runtimesRef.current} box={boxRef.current} ready={ready} probe={probeState} onChange={(next) => { setProbe(next); boardRef.current?.update(); }} /> : null}
      <ParameterControls parameters={parameters} values={values} onChange={changeValues} onReset={() => changeValues(initialParameterValues(parameters))} />
    </JSXGraphBoard>
  );
}

/** Readable trace equation: substitute the fixed coordinate into the formula. */
function traceEquation(plot: SurfaceDefinition, axis: Axis, value: number): string {
  const level = formatNumber(value, 2);
  const substitute = (expression: string) => expression.replace(new RegExp(`\\b${axis}\\b`, 'g'), `(${level})`);
  if (plot.type === 'implicit-surface') return `${substitute(plot.expression)}${plot.expression.includes('=') ? '' : ' = 0'}`;
  if (plot.type === 'surface') return axis === 'z' ? `${plot.expression} = ${level}（等高线）` : `z = ${substitute(plot.expression)}`;
  return `${axis} = ${level} 截参数曲面`;
}

function ProbePanel({ definitions, runtimes, box, ready, probe, onChange }: { definitions: SurfaceDefinition[]; runtimes: PlotRuntime[]; box: SpaceBox; ready: boolean; probe: { index: number; fractions: number[] }; onChange: (probe: { index: number; fractions: number[] }) => void }) {
  const plot = definitions[probe.index];
  const ranges = surfaceRanges(plot, box);
  const variables = probeVariables(plot);
  const inputs = ranges.map(([min, max], index) => min + (max - min) * probe.fractions[index]);
  const point = ready && runtimes[probe.index] ? evaluateProbe(plot, runtimes[probe.index], box, probe.fractions) : [NaN, NaN, NaN];
  const targets = definitions.map((item, index) => ({ item, index })).filter(({ item }) => item.type !== 'implicit-surface');
  const setInput = (index: number, value: number) => {
    const [min, max] = ranges[index];
    onChange({ ...probe, fractions: probe.fractions.map((fraction, item) => item === index ? (value - min) / (max - min) : fraction) });
  };
  return <Section title="坐标探针" label="三维坐标探针" meta={ready ? `P = (${point.map(formatSpaceCoordinate).join(', ')})` : undefined} defaultOpen={false}>
    {targets.length > 1 ? <label className={styles.field}>查看图像<select value={probe.index} onChange={(event) => onChange({ index: Number(event.currentTarget.value), fractions: [0.6, 0.5] })}>
      {targets.map(({ item, index }) => <option value={index} key={index}>{item.label ?? `图像 ${index + 1}`}</option>)}
    </select></label> : null}
    {ranges.map(([min, max], index) => <div key={variables[index]} className={styles.controlRow}>
      <div style={{ flex: '1 1 14rem' }}><Slider label={variables[index]} min={min} max={max} step={(max - min) / 200} value={inputs[index]} disabled={!ready} format={formatSpaceCoordinate} onChange={(value) => setInput(index, value)} /></div>
      <NumberInput label={`${variables[index]} 坐标数值`} value={inputs[index]} min={min} max={max} className={styles.compact} onCommit={(value) => setInput(index, value)} />
    </div>)}
    <output className={styles.readout}>{ready ? <>P = ({point.map(formatSpaceCoordinate).join(', ')}){point.every(Number.isFinite) ? '' : ' · 当前坐标处函数未定义'}</> : '画板加载后显示三维坐标。'}</output>
  </Section>;
}

/** The trace drawn flat in the section plane, with equal axis scales. */
function SectionInset({ scene, definitions, shown, axis, box }: { scene: Scene; definitions: SurfaceDefinition[]; shown: boolean[]; axis: Axis; box: SpaceBox }) {
  const [p, q] = planeAxes(axis);
  const [[p0, p1], [q0, q1]] = [box[p], box[q]];
  const letters = ['x', 'y', 'z'];
  const pad = Math.max(p1 - p0, q1 - q0) * 0.04;
  return <svg className={styles.inset} viewBox={`${p0 - pad} ${-q1 - pad} ${p1 - p0 + 2 * pad} ${q1 - q0 + 2 * pad}`} role="img" aria-label={`截面图：横轴 ${letters[p]}，纵轴 ${letters[q]}`}>
    <rect x={p0} y={-q1} width={p1 - p0} height={q1 - q0} fill="none" stroke="var(--plot-grid)" vectorEffect="non-scaling-stroke" />
    {p0 < 0 && p1 > 0 ? <line x1={0} x2={0} y1={-q1} y2={-q0} stroke="var(--plot-axis)" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" /> : null}
    {q0 < 0 && q1 > 0 ? <line x1={p0} x2={p1} y1={0} y2={0} stroke="var(--plot-axis)" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" /> : null}
    {definitions.map((plot, index) => {
      if (!shown[index]) return null;
      const trace = scene.section(index);
      if (!trace?.segments.length) return null;
      const d = trace.segments.map(([a, b, c, e]) => `M${a} ${-b}L${c} ${-e}`).join('');
      return <path key={index} d={d} fill="none" stroke={seriesColor(index, plot.color)} strokeWidth={2.2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />;
    })}
    <text x={p1 - pad * 0.2} y={q0 < 0 && q1 > 0 ? -pad * 0.6 : -q0 - pad * 0.4} textAnchor="end" fontSize={(q1 - q0) * 0.06}>{letters[p]}</text>
    <text x={p0 < 0 && p1 > 0 ? pad * 0.5 : p0 + pad * 0.4} y={-q1 + pad * 1.6} fontSize={(q1 - q0) * 0.06}>{letters[q]}</text>
  </svg>;
}

function ExpressionEditor({ definition, ready, onDraw }: { definition: SurfaceDefinition; ready: boolean; onDraw: (definition: SurfaceDefinition) => void }) {
  const fields = surfaceExpressions(definition);
  return <form className={styles.form} onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onDraw(replaceSurfaceExpressions(definition, fields.map(([label]) => String(data.get(label) ?? ''))));
  }}>
    {fields.map(([label, expression]) => <label key={label} className={cx(styles.field, styles.fieldWide)}>{label} =
      <input name={label} aria-label={`三维表达式 ${label}`} className={cx(styles.input, styles.mono)} defaultValue={expression} maxLength={2000} required spellCheck={false} autoComplete="off" autoCapitalize="off" />
    </label>)}
    <button type="submit" className={cx(styles.button, styles.primary)} disabled={!ready}>绘制</button>
  </form>;
}

function QuadricEditor({ definition, ready, onDraw }: { definition: QuadricDefinition & SurfaceDefinition; ready: boolean; onDraw: (definition: SurfaceDefinition) => void }) {
  const [kind, setKind] = useState(definition.kind);
  const [axis, setAxis] = useState<Axis>(definition.axis ?? 'z');
  const uses = quadricUses(kind);
  return <form className={styles.form} onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const read = (name: 'a' | 'b' | 'c') => {
      const text = String(data.get(name) ?? '').trim();
      return text === '' ? undefined : Number.isFinite(Number(text)) ? Number(text) : text;
    };
    onDraw({ ...definition, kind, axis, a: read('a'), b: uses.includes('b') ? read('b') : definition.b, c: uses.includes('c') ? read('c') : definition.c });
  }}>
    <label className={cx(styles.field, styles.fieldWide)}>曲面类型
      <select value={kind} onChange={(event) => setKind(event.currentTarget.value as typeof kind)}>
        {QUADRIC_KINDS.map((value) => <option key={value} value={value}>{QUADRICS[value].name}</option>)}
      </select>
    </label>
    <label className={styles.field}>对称轴<Segmented label="对称轴" value={axis} onChange={setAxis} options={AXES.map((value) => ({ value, label: value }))} /></label>
    {uses.map((name) => <label key={name} className={styles.field}>{kind === 'sphere' ? '半径 a' : name}
      <input name={name} aria-label={`二次曲面参数 ${name}`} className={cx(styles.input, styles.mono)} defaultValue={String(definition[name] ?? 1)} spellCheck={false} autoComplete="off" autoCapitalize="off" />
    </label>)}
    <button type="submit" className={cx(styles.button, styles.primary)} disabled={!ready}>绘制</button>
  </form>;
}
