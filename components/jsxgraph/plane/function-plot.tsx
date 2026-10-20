'use client';

import { useCallback, useRef, useState, type CSSProperties } from 'react';
import { Plus, RotateCcw, Trash2, X } from 'lucide-react';
import type { Board } from 'jsxgraph';
import { compileNumeric, createCompiler, type ExpressionCompiler } from '../core/expression';
import { errorMessage, formatNumber } from '../core/format';
import { initialParameterValues, type PlotParameter } from '../core/parameters';
import { seriesColor } from '../core/theme';
import { JSXGraphBoard, type BoardContext } from '../ui/board';
import { ParameterControls } from '../ui/parameter-controls';
import { cx, IconButton, NumberInput, Section, Segmented, Switch } from '../ui/primitives';
import { MAX_PLOTS, validatePlotConfig, validatePlotDefinition } from './model';
import { centralDerivative, PLOT_KINDS, plotKind, type PlotInstance, type PlotState } from './plots';
import type { FunctionPlotProps, PlotDefinition, PlotPoint, PlotType } from './types';
import styles from '../ui/jsxgraph.module.css';

const EMPTY_PARAMETERS: PlotParameter[] = [];
const EMPTY_POINTS: PlotPoint[] = [];

interface ScenePlot { id: string; definition: PlotDefinition; visible: boolean; derivative: boolean }
interface ProbeReadout { x: number; y: number; slope: number }
interface AreaReadout { id: string; a: number; b: number; value: number }

const sceneFrom = (plots: PlotDefinition[]): ScenePlot[] => plots.map((definition, index) => ({
  id: String(index), definition, visible: true, derivative: definition.type === 'function' && Boolean(definition.derivative),
}));
const firstProbe = (scene: ScenePlot[]) => scene.find(({ definition }) => definition.type === 'function' && definition.probe !== false)?.id ?? '';

export function FunctionPlot(props: FunctionPlotProps) {
  try { validatePlotConfig(props); }
  catch (error) { return <p className={styles.error} role="alert">画图配置无效：{errorMessage(error)}</p>; }
  return <ConfiguredPlot key={JSON.stringify(props)} {...props} />;
}

function ConfiguredPlot({ plots, parameters = EMPTY_PARAMETERS, points = EMPTY_POINTS, editable = true, ...boardProps }: FunctionPlotProps) {
  const [scene, setScene] = useState(() => sceneFrom(plots));
  const sceneRef = useRef(scene);
  const nextId = useRef(plots.length);
  const [values, setValues] = useState(() => initialParameterValues(parameters));
  const valuesRef = useRef(values);
  const boardRef = useRef<Board | null>(null);
  const compileRef = useRef<ExpressionCompiler | null>(null);
  const instances = useRef(new Map<string, PlotInstance>());
  const [ready, setReady] = useState(false);
  const [probeId, setProbeId] = useState(() => firstProbe(scene));
  const probeRef = useRef(probeId);
  const [tangent, setTangent] = useState(true);
  const tangentRef = useRef(tangent);
  const [probe, setProbe] = useState<ProbeReadout | null>(null);
  const [areas, setAreas] = useState<AreaReadout[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<PlotType | null>(null);
  const [addError, setAddError] = useState('');

  const stateOf = useCallback((id: string) => (): PlotState => {
    const entry = sceneRef.current.find((item) => item.id === id);
    return { visible: entry?.visible ?? false, probe: probeRef.current === id, tangent: tangentRef.current, derivative: entry?.derivative ?? false };
  }, []);

  const createInstance = useCallback((entry: ScenePlot, probeX?: number): PlotInstance => {
    const board = boardRef.current, compile = compileRef.current;
    if (!board || !compile) throw new Error('画板尚未准备好。');
    return plotKind(entry.definition).create({ board, compile, color: seriesColor(Number(entry.id), entry.definition.color), state: stateOf(entry.id), probeX }, entry.definition);
  }, [stateOf]);

  const setup = useCallback((board: Board, { theme }: BoardContext) => {
    boardRef.current = board;
    compileRef.current = createCompiler(board, parameters.map(({ name }) => name), () => valuesRef.current);
    const failures: Record<string, string> = {};
    for (const entry of sceneRef.current) {
      try { instances.current.set(entry.id, createInstance(entry)); }
      catch (error) { failures[entry.id] = errorMessage(error); }
    }
    setErrors(failures);
    for (const [index, point] of points.entries()) {
      const color = point.color ?? seriesColor(index);
      const label = { display: 'internal', strokeColor: () => theme().ink, fontSize: 13, offset: [8, 8], highlight: false };
      const free = typeof point.x === 'number' && typeof point.y === 'number' && !point.fixed;
      const coordinates = free ? [point.x, point.y] : [compileNumeric(point.x, compileRef.current), compileNumeric(point.y, compileRef.current)];
      board.create('point', coordinates, { name: point.name ?? '', fixed: !free, size: 3.5, fillColor: color, strokeColor: color, label, tabindex: free ? 0 : -1, showInfobox: false });
    }

    let frame = 0;
    const read = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const entry = sceneRef.current.find(({ id }) => id === probeRef.current);
        const instance = instances.current.get(probeRef.current);
        if (!instance?.probe || !instance.f || !entry?.visible) setProbe(null);
        else {
          const x = instance.probe.X(), y = instance.probe.Y(), slope = centralDerivative(instance.f, x);
          setProbe((old) => old && old.x === x && old.y === y && Object.is(old.slope, slope) ? old : { x, y, slope });
        }
        const next = sceneRef.current.flatMap(({ id, visible }) => {
          const area = instances.current.get(id)?.area;
          if (!area || !visible) return [];
          const [a, b] = area.bounds();
          return [{ id, a, b, value: area.value() }];
        });
        setAreas((old) => JSON.stringify(old) === JSON.stringify(next) ? old : next);
      });
    };
    board.on('update', read);
    read();
    setReady(true);
    return () => {
      cancelAnimationFrame(frame);
      board.off('update', read);
      boardRef.current = null;
      compileRef.current = null;
      instances.current.clear();
    };
  }, [createInstance, parameters, points]);

  function updateScene(next: ScenePlot[]) { sceneRef.current = next; setScene(next); boardRef.current?.update(); }
  function changeValues(next: Record<string, number>) { valuesRef.current = next; setValues(next); boardRef.current?.update(); }
  function patch(id: string, change: Partial<ScenePlot>) { updateScene(sceneRef.current.map((item) => item.id === id ? { ...item, ...change } : item)); }
  function selectProbe(id: string) { probeRef.current = id; setProbeId(id); boardRef.current?.update(); }
  function discard(id: string) {
    const instance = instances.current.get(id);
    if (instance) boardRef.current?.removeObject([...instance.objects].reverse());
    instances.current.delete(id);
  }

  function draw(id: string, definition: PlotDefinition) {
    const current = sceneRef.current.find((entry) => entry.id === id);
    if (!current) return;
    try {
      validatePlotDefinition(definition);
      const entry = { ...current, definition };
      const replacement = createInstance(entry, instances.current.get(id)?.probe?.X());
      discard(id);
      instances.current.set(id, replacement);
      updateScene(sceneRef.current.map((item) => item.id === id ? entry : item));
      setErrors((old) => ({ ...old, [id]: '' }));
    } catch (error) { setErrors((old) => ({ ...old, [id]: errorMessage(error) })); }
  }
  function remove(id: string) {
    discard(id);
    if (probeRef.current === id) { selectProbe(''); setProbe(null); }
    updateScene(sceneRef.current.filter((entry) => entry.id !== id));
  }
  function add(definition: PlotDefinition) {
    try {
      if (sceneRef.current.length >= MAX_PLOTS) throw new Error(`一个画板最多显示 ${MAX_PLOTS} 条曲线。`);
      validatePlotDefinition(definition);
      const entry = { id: String(nextId.current++), definition, visible: true, derivative: false };
      instances.current.set(entry.id, createInstance(entry));
      updateScene([...sceneRef.current, entry]);
      if (definition.type === 'function') selectProbe(entry.id);
      setAddError('');
      setAdding(null);
    } catch (error) { setAddError(errorMessage(error)); }
  }
  function reset() {
    for (const id of [...instances.current.keys()]) discard(id);
    const next = sceneFrom(plots);
    sceneRef.current = next;
    nextId.current = plots.length;
    const failures: Record<string, string> = {};
    for (const entry of next) {
      try { instances.current.set(entry.id, createInstance(entry)); }
      catch (error) { failures[entry.id] = errorMessage(error); }
    }
    setScene(next);
    setErrors(failures);
    setAdding(null);
    selectProbe(firstProbe(next));
    changeValues(initialParameterValues(parameters));
  }
  function clear() {
    for (const id of [...instances.current.keys()]) discard(id);
    selectProbe('');
    updateScene([]);
    setErrors({});
  }

  const labelOf = (entry: ScenePlot) => entry.definition.label ?? `图像 ${scene.indexOf(entry) + 1}`;
  const probeEntry = scene.find(({ id }) => id === probeId);

  return <JSXGraphBoard {...boardProps} onInit={setup}>
    <Section title="图像与公式" label="图像与公式" meta={`${scene.length} 个`} actions={editable ? <>
      <IconButton label="添加图像" text="添加" icon={<Plus aria-hidden />} pressed={adding !== null} disabled={!ready} onClick={() => { setAddError(''); setAdding((value) => value ? null : 'function'); }} />
      <IconButton label="清空" icon={<Trash2 aria-hidden />} disabled={!ready || !scene.length} onClick={clear} />
      <IconButton label="恢复示例" icon={<RotateCcw aria-hidden />} disabled={!ready} onClick={reset} />
    </> : null}>
      {editable && adding ? <div className={styles.addForm}>
        <Segmented label="图像类型" value={adding} onChange={setAdding} options={(Object.keys(PLOT_KINDS) as PlotType[]).map((type) => ({ value: type, label: PLOT_KINDS[type].title }))} />
        <PlotEditor key={adding} definition={PLOT_KINDS[adding].seed} ready={ready} onDraw={add} buttonLabel="绘制新图像" />
        {addError ? <p className={styles.error} role="alert">{addError}</p> : null}
      </div> : null}
      <div className={styles.rows}>
        {scene.map((entry, index) => {
          const color = seriesColor(Number(entry.id), entry.definition.color);
          const isFunction = entry.definition.type === 'function';
          return <div key={entry.id} className={cx(styles.row, !entry.visible && styles.rowHidden)}>
            <div className={styles.rowHead}>
              <label className={styles.legend} title={entry.visible ? '隐藏图像' : '显示图像'}>
                <input type="checkbox" checked={entry.visible} onChange={() => patch(entry.id, { visible: !entry.visible })} />
                <span className={styles.swatch} style={{ '--swatch': color } as CSSProperties} aria-hidden />
                {labelOf(entry)}<span className={styles.kindTag}>{PLOT_KINDS[entry.definition.type].title}</span>
              </label>
              <div className={styles.rowTools}>
                {isFunction ? <>
                  <button type="button" className={styles.chip} aria-pressed={probeId === entry.id} disabled={!ready} onClick={() => selectProbe(probeId === entry.id ? '' : entry.id)}>取点</button>
                  <button type="button" className={styles.chip} aria-pressed={entry.derivative} disabled={!ready} onClick={() => patch(entry.id, { derivative: !entry.derivative })}>导数</button>
                </> : null}
                {editable ? <IconButton label={`删除图像 ${index + 1}`} icon={<X aria-hidden />} disabled={!ready} onClick={() => remove(entry.id)} /> : null}
              </div>
            </div>
            {editable
              ? <PlotEditor key={JSON.stringify(entry.definition)} definition={entry.definition} ready={ready} onDraw={(definition) => draw(entry.id, definition)} />
              : <code className={styles.formula}>{plotKind(entry.definition).describe(entry.definition)}</code>}
            {errors[entry.id] ? <p className={styles.error} role="alert">{errors[entry.id].replace(/。$/, '')}{instances.current.has(entry.id) ? '，当前图像已保留。' : '。'}</p> : null}
          </div>;
        })}
        {!scene.length ? <p className={styles.note}>画板已清空，点击“添加”开始绘制。</p> : null}
      </div>
    </Section>
    {(probe && probeEntry) || areas.length ? <Section title="读数" label="取点读数">
      {probe && probeEntry ? <div className={styles.readout}>
        <label className={styles.inlineField}>取点 x<NumberInput label="取点 x" value={probe.x} onCommit={(x) => {
          const instance = instances.current.get(probeRef.current);
          if (instance?.f && Number.isFinite(instance.f(x))) instance.probe?.moveTo([x, instance.f(x)], 0);
        }} /></label>
        <span className={styles.stat}><span>y</span><output>{formatNumber(probe.y)}</output></span>
        <span className={styles.stat}><span>斜率 f′(x)</span><output>{formatNumber(probe.slope)}</output></span>
        <Switch checked={tangent} onChange={(checked) => { tangentRef.current = checked; setTangent(checked); boardRef.current?.update(); }}>显示切线</Switch>
      </div> : null}
      {areas.map((area) => <div key={area.id} className={styles.readout}>
        <span className={styles.stat}><span>{labelOf(scene.find(({ id }) => id === area.id)!)} 在 [{formatNumber(area.a)}, {formatNumber(area.b)}] 上的定积分</span><output>≈ {formatNumber(area.value, 4)}</output></span>
      </div>)}
    </Section> : null}
    <ParameterControls parameters={parameters} values={values} onChange={changeValues} onReset={() => changeValues(initialParameterValues(parameters))} />
  </JSXGraphBoard>;
}

function PlotEditor({ definition, ready, onDraw, buttonLabel = '绘制' }: { definition: PlotDefinition; ready: boolean; onDraw: (definition: PlotDefinition) => void; buttonLabel?: string }) {
  const kind = plotKind(definition);
  return <form className={styles.form} onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onDraw(kind.read(definition, Object.fromEntries(kind.fields.map(({ key }) => [key, String(data.get(key) ?? '')]))));
  }}>
    {kind.fields.map((field) => <label key={field.key} className={cx(styles.field, field.wide && styles.fieldWide)}>{field.label}
      <input name={field.key} aria-label={field.aria} className={cx(styles.input, styles.mono)} defaultValue={field.value(definition)} maxLength={2000} required spellCheck={false} autoComplete="off" autoCapitalize="off" />
    </label>)}
    <button type="submit" className={cx(styles.button, styles.primary)} disabled={!ready}>{buttonLabel}</button>
  </form>;
}
