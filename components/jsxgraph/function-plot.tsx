'use client';

import { useCallback, useRef, useState } from 'react';
import type { Board, Curve, GeometryElement, Point } from 'jsxgraph';
import { JSXGraphBoard } from './board';
import { bindPlotExpression, implicitExpression, initialParameterValues, PLOT_COLORS, validatePlotConfig } from './model';
import { ParameterControls } from './parameter-controls';
import type { FunctionPlotProps, PlotDefinition, PlotParameter, PlotPoint } from './types';
import styles from './jsxgraph.module.css';

const EMPTY_PARAMETERS: PlotParameter[] = [];
const EMPTY_POINTS: PlotPoint[] = [];
interface ScenePlot { id: string; definition: PlotDefinition; visible: boolean }
interface PlotInstance { objects: GeometryElement[]; curve: Curve; point?: Point; f?: (x: number) => number }
interface ProbeValue { x: number; y: number; slope: number }
const SEEDS: Record<PlotDefinition['type'], PlotDefinition> = {
  function: { type: 'function', expression: 'sin(x)', probe: true },
  implicit: { type: 'implicit', expression: 'x^2+y^2=4' },
  parametric: { type: 'parametric', x: '3*cos(t)', y: '2*sin(t)', range: [0, 6.283185307179586] },
};

export function FunctionPlot(props: FunctionPlotProps) {
  try { validatePlotConfig(props); }
  catch (error) { return <p className={styles.error} role="alert">画图配置无效：{error instanceof Error ? error.message : String(error)}</p>; }
  return <ConfiguredPlot key={JSON.stringify(props)} {...props} />;
}

function ConfiguredPlot({ plots, parameters = EMPTY_PARAMETERS, points = EMPTY_POINTS, editable = true, ...boardProps }: FunctionPlotProps) {
  const [scene, setScene] = useState<ScenePlot[]>(() => plots.map((definition, index) => ({ id: String(index), definition, visible: true })));
  const sceneRef = useRef(scene);
  const nextId = useRef(plots.length);
  const [values, setValues] = useState(() => initialParameterValues(parameters));
  const valuesRef = useRef(values);
  const boardRef = useRef<Board | null>(null);
  const instances = useRef(new Map<string, PlotInstance>());
  const [ready, setReady] = useState(false);
  const initialProbeIndex = plots.findIndex((definition) => definition.type === 'function' && definition.probe !== false);
  const initialProbe = initialProbeIndex < 0 ? '' : String(initialProbeIndex);
  const [probeId, setProbeId] = useState(initialProbe);
  const probeRef = useRef(probeId);
  const [tangent, setTangent] = useState(true);
  const tangentRef = useRef(tangent);
  const [probe, setProbe] = useState<ProbeValue | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newType, setNewType] = useState<PlotDefinition['type']>('function');
  const [showAdd, setShowAdd] = useState(false);
  const [newError, setNewError] = useState('');

  const createPlot = useCallback((board: Board, entry: ScenePlot, existingX?: number): PlotInstance => {
    const objects: GeometryElement[] = [];
    const names = parameters.map(({ name }) => name);
    const definition = entry.definition;
    const color = definition.color ?? PLOT_COLORS[Number(entry.id) % PLOT_COLORS.length];
    const visible = () => sceneRef.current.find(({ id }) => id === entry.id)?.visible ?? entry.visible;
    function compile(expression: string, variables: string[]) {
      const evaluate = board.jc.snippet(expression, true, [...variables, ...names].join(','), false) as (...args: number[]) => number;
      const f = bindPlotExpression(evaluate, variables.length, names, () => valuesRef.current);
      // Resolve unknown names before accepting an edit. NaN at a domain edge
      // remains valid (e.g. log(0)); JSXGraph handles discontinuous samples.
      if (typeof f(...variables.map(() => 1)) !== 'number') throw new Error('请输入数值表达式，不支持布尔比较或条件式。');
      return f;
    }
    function add<T extends GeometryElement>(object: T): T { objects.push(object); return object; }
    const attributes = { strokeColor: color, strokeWidth: 2.7, dash: definition.dashed ? 2 : 0, highlight: false, visible };
    try {
      let curve: Curve;
      let f: ((x: number) => number) | undefined;
      if (definition.type === 'function') {
        f = compile(definition.expression, ['x']);
        curve = add(board.create('functiongraph', definition.domain ? [f, ...definition.domain] : [f], attributes) as Curve);
      } else if (definition.type === 'implicit') {
        curve = add(board.create('implicitcurve', [compile(implicitExpression(definition.expression), ['x', 'y'])], attributes) as Curve);
      } else {
        curve = add(board.create('curve', [compile(definition.x, ['t']), compile(definition.y, ['t']), ...definition.range], attributes) as Curve);
      }
      let point: Point | undefined;
      if (definition.type === 'function' && f) {
        const candidates = [existingX, definition.domain ? (definition.domain[0] + definition.domain[1]) / 2 : 1, 0, -1, 2, 0.5].filter((x): x is number => x !== undefined);
        const x = candidates.find((x) => Number.isFinite(f!(x)));
        const probeVisible = () => visible() && probeRef.current === entry.id;
        if (x !== undefined) {
          point = add(board.create('glider', [x, f(x), curve], { name: '', size: 4.5, fillColor: color, strokeColor: '#fff', strokeWidth: 1.5, visible: probeVisible, tabindex: 0 }));
          add(board.create('tangent', [point], { strokeColor: color, strokeWidth: 1.4, dash: 2, visible: () => probeVisible() && tangentRef.current, highlight: false }));
          add(board.create('text', [() => point!.X() + 0.15, () => point!.Y() + 0.3, () => `(${format(point!.X())}, ${format(point!.Y())})`], { fixed: true, fontSize: 12, strokeColor: color, display: 'internal', visible: probeVisible }));
        }
      }
      return { objects, curve, point, f };
    } catch (error) {
      board.removeObject(objects.reverse());
      throw error;
    }
  }, [parameters]);

  const setup = useCallback((board: Board) => {
    boardRef.current = board;
    for (const entry of sceneRef.current) instances.current.set(entry.id, createPlot(board, entry));
    for (const point of points) {
      board.create('point', [point.x, point.y], { name: point.name ?? '', fixed: point.fixed ?? false, fillColor: point.color ?? PLOT_COLORS[0], strokeColor: point.color ?? PLOT_COLORS[0], label: { display: 'internal' }, tabindex: 0 });
    }
    let frame = 0;
    const read = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const instance = instances.current.get(probeRef.current);
        const entry = sceneRef.current.find(({ id }) => id === probeRef.current);
        if (!instance?.point || !instance.f || !entry?.visible) { setProbe(null); return; }
        const x = instance.point.X(), y = instance.point.Y();
        const h = 0.0001 * Math.max(1, Math.abs(x));
        const slope = (instance.f(x + h) - instance.f(x - h)) / (2 * h);
        setProbe((old) => old && old.x === x && old.y === y && old.slope === slope ? old : { x, y, slope });
      });
    };
    board.on('update', read);
    read();
    setReady(true);
    return () => {
      cancelAnimationFrame(frame);
      boardRef.current = null;
      instances.current.clear();
    };
  }, [createPlot, points]);

  function updateScene(next: ScenePlot[]) { sceneRef.current = next; setScene(next); boardRef.current?.update(); }
  function changeValues(next: Record<string, number>) { valuesRef.current = next; setValues(next); boardRef.current?.update(); }
  function draw(id: string, definition: PlotDefinition) {
    const board = boardRef.current;
    const current = sceneRef.current.find((entry) => entry.id === id);
    if (!board || !current) return;
    try {
      validatePlotConfig({ plots: [definition], parameters });
      const entry = { ...current, definition };
      const old = instances.current.get(id);
      const replacement = createPlot(board, entry, old?.point?.X());
      if (old) board.removeObject([...old.objects].reverse());
      instances.current.set(id, replacement);
      updateScene(sceneRef.current.map((item) => item.id === id ? entry : item));
      setErrors((old) => ({ ...old, [id]: '' }));
    } catch (error) { setErrors((old) => ({ ...old, [id]: errorMessage(error) })); }
  }
  function remove(id: string) {
    const instance = instances.current.get(id);
    if (instance) boardRef.current?.removeObject([...instance.objects].reverse());
    instances.current.delete(id);
    if (probeRef.current === id) { probeRef.current = ''; setProbeId(''); setProbe(null); }
    updateScene(sceneRef.current.filter((entry) => entry.id !== id));
  }
  function add(definition: PlotDefinition) {
    const board = boardRef.current;
    if (!board) return;
    try {
      if (sceneRef.current.length >= 20) throw new Error('一个画板最多显示 20 条曲线。');
      validatePlotConfig({ plots: [definition], parameters });
      const id = String(nextId.current++);
      const entry = { id, definition, visible: true };
      const instance = createPlot(board, entry);
      instances.current.set(id, instance);
      updateScene([...sceneRef.current, entry]);
      if (definition.type === 'function') { probeRef.current = id; setProbeId(id); board.update(); }
      setNewError('');
      setShowAdd(false);
    } catch (error) { setNewError(errorMessage(error)); }
  }
  function reset() {
    for (const id of instances.current.keys()) remove(id);
    const next = plots.map((definition, index) => ({ id: String(index), definition, visible: true }));
    sceneRef.current = next;
    nextId.current = plots.length;
    if (boardRef.current) for (const entry of next) instances.current.set(entry.id, createPlot(boardRef.current, entry));
    setScene(next);
    changeValues(initialParameterValues(parameters));
    probeRef.current = initialProbe;
    setProbeId(initialProbe);
    setErrors({});
    setShowAdd(false);
    boardRef.current?.update();
  }

  function clear() {
    for (const id of [...instances.current.keys()]) remove(id);
    setErrors({});
  }

  return <JSXGraphBoard {...boardProps} onInit={setup}>
    <div className={styles.panel}>
      <div className={styles.sectionTitle}><strong>图像与公式</strong>{editable ? <div className={styles.controls}><button type="button" disabled={!ready} onClick={() => setShowAdd((value) => !value)} aria-expanded={showAdd}>添加图像</button><button type="button" disabled={!ready || !scene.length} onClick={clear}>清空</button><button type="button" disabled={!ready} onClick={reset}>恢复示例</button></div> : null}</div>
      <div className={styles.expressionList}>
        {scene.map((entry, index) => <div key={entry.id} className={styles.expressionRow}>
          <div className={styles.expressionHeading}>
            <label className={styles.check}><input type="checkbox" checked={entry.visible} onChange={() => updateScene(sceneRef.current.map((item) => item.id === entry.id ? { ...item, visible: !item.visible } : item))} /><span className={styles.swatch} style={{ background: entry.definition.color ?? PLOT_COLORS[Number(entry.id) % PLOT_COLORS.length] }} />{entry.definition.label ?? `图像 ${index + 1}`}</label>
            <div className={styles.controls}>{entry.definition.type === 'function' ? <button type="button" aria-pressed={probeId === entry.id} disabled={!ready} onClick={() => { const id = probeId === entry.id ? '' : entry.id; probeRef.current = id; setProbeId(id); boardRef.current?.update(); }}>取点</button> : null}{editable ? <button type="button" disabled={!ready} aria-label={`删除图像 ${index + 1}`} onClick={() => remove(entry.id)}>删除</button> : null}</div>
          </div>
          {editable ? <PlotEditor key={JSON.stringify(entry.definition)} definition={entry.definition} ready={ready} onDraw={(definition) => draw(entry.id, definition)} /> : <code className={styles.expressionText}>{expressionLabel(entry.definition)}</code>}
          {errors[entry.id] ? <p className={styles.error} role="alert">{errors[entry.id]}，请检查公式后重新绘制。当前图像已保留。</p> : null}
        </div>)}
        {!scene.length ? <p className={styles.hint}>画板已清空，点击“添加图像”开始绘制。</p> : null}
      </div>
      {editable && showAdd ? <div className={styles.addForm}>
        <label className={styles.field}>图像类型<select value={newType} onChange={(event) => setNewType(event.currentTarget.value as PlotDefinition['type'])}><option value="function">显函数 y = f(x)</option><option value="implicit">隐式方程 F(x,y) = 0</option><option value="parametric">参数曲线 (x(t), y(t))</option></select></label>
        <PlotEditor key={newType} definition={SEEDS[newType]} ready={ready} onDraw={add} buttonLabel="绘制新图像" />
        {newError ? <p className={styles.error} role="alert">{newError}</p> : null}
      </div> : null}
    </div>
    {probe && probeId ? <section className={styles.readout} aria-label="取点读数">
      <ProbeInput value={probe.x} onCommit={(x) => { const instance = instances.current.get(probeRef.current); if (instance?.f && Number.isFinite(instance.f(x))) instance.point?.moveTo([x, instance.f(x)], 0); }} />
      <output>y = {format(probe.y)}</output><output>斜率 ≈ {format(probe.slope)}</output>
      <label className={styles.check}><input type="checkbox" checked={tangent} onChange={(event) => { tangentRef.current = event.currentTarget.checked; setTangent(event.currentTarget.checked); boardRef.current?.update(); }} />显示切线</label>
    </section> : null}
    <ParameterControls parameters={parameters} values={values} onChange={changeValues} onReset={() => changeValues(initialParameterValues(parameters))} />
  </JSXGraphBoard>;
}

function ProbeInput({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  function commit() {
    const next = draft?.trim() ? Number(draft) : NaN;
    if (!cancelled.current && Number.isFinite(next)) onCommit(next);
    cancelled.current = false;
    setDraft(null);
  }
  return <label className={styles.field}>取点 x<input aria-label="取点 x" type="number" step="any" value={draft ?? Number(value.toFixed(4))} onFocus={() => setDraft(String(Number(value.toFixed(4))))} onChange={(event) => setDraft(event.currentTarget.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { cancelled.current = true; event.currentTarget.blur(); } }} /></label>;
}

function PlotEditor({ definition, ready, onDraw, buttonLabel = '绘制' }: { definition: PlotDefinition; ready: boolean; onDraw: (definition: PlotDefinition) => void; buttonLabel?: string }) {
  return <form className={styles.expressionForm} onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (definition.type === 'parametric') onDraw({ ...definition, x: String(data.get('x')), y: String(data.get('y')), range: [Number(data.get('min')), Number(data.get('max'))] });
    else onDraw({ ...definition, expression: String(data.get('expression')).replace(definition.type === 'function' ? /^\s*y\s*=\s*/ : /$^/, '') });
  }}>
    {definition.type === 'parametric' ? <>
      <label className={styles.field}>x(t)<input name="x" aria-label="参数曲线 x(t)" className={styles.expressionInput} defaultValue={definition.x} maxLength={2000} required spellCheck={false} autoComplete="off" /></label>
      <label className={styles.field}>y(t)<input name="y" aria-label="参数曲线 y(t)" className={styles.expressionInput} defaultValue={definition.y} maxLength={2000} required spellCheck={false} autoComplete="off" /></label>
      <label className={styles.field}>t 起点<input name="min" type="number" step="any" defaultValue={definition.range[0]} required /></label><label className={styles.field}>t 终点<input name="max" type="number" step="any" defaultValue={definition.range[1]} required /></label>
    </> : <label className={`${styles.field} ${styles.expressionField}`}>{definition.type === 'function' ? 'y =' : '方程'}<input name="expression" aria-label={definition.type === 'function' ? '函数表达式' : '隐式方程'} className={styles.expressionInput} defaultValue={definition.expression} maxLength={2000} required spellCheck={false} autoComplete="off" /></label>}
    <button type="submit" disabled={!ready}>{buttonLabel}</button>
  </form>;
}

function format(value: number) { return Number.isFinite(value) ? Number(value.toFixed(3)).toString() : '未定义'; }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error); }
function expressionLabel(definition: PlotDefinition) { return definition.type === 'parametric' ? `(${definition.x}, ${definition.y})` : definition.expression; }
