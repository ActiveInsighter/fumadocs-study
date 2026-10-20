import type { Board, GeometryElement, Slider, View3D, View3DAttributes } from 'jsxgraph';
import type { Segment } from '../core/contours';
import { compileNumeric, type ExpressionCompiler } from '../core/expression';
import { colorHue, seriesColor, type BoardTheme } from '../core/theme';
import { AXES, evaluateProbe, implicitWireframe, liftSegments, patchSection, sliceSegments, SURFACE_VIEWS, type PlotRuntime } from './model';
import type { Axis, SpaceBox, SpacePoint, SurfaceDefinition } from './types';

// JSXGraph 1.14's bundled declarations omit these documented View3D APIs.
export interface InteractiveView extends View3D {
  bbox3D: SpaceBox;
  az_slide: Slider;
  el_slide: Slider;
  bank_slide: Slider;
  setView(azimuth: number, elevation: number, distance?: number): this;
}

export interface DisplayOptions { fill: boolean; mesh: boolean; density: number; opacity: number; frame: boolean }
export interface SectionState { enabled: boolean; axis: Axis; value: number }
export interface ProbeState { index: number; fractions: number[] }

/** Live state read by JSXGraph attribute functions on every update. */
export interface SceneState {
  definitions: () => SurfaceDefinition[];
  runtimes: () => PlotRuntime[];
  shown: (index: number) => boolean;
  display: () => DisplayOptions;
  section: () => SectionState;
  probe: () => ProbeState | null;
  /** Bumped when formulas or parameter values change; keys cached geometry. */
  revision: () => number;
  /** Current coordinate box (fitting the view replaces it). */
  box: () => SpaceBox;
  theme: () => BoardTheme;
}

export interface SectionTrace { path: [number[], number[], number[]]; segments: Segment[] }

export interface Scene {
  view: InteractiveView;
  /** Cached trace of plot `index` in the current section plane. */
  section: (index: number) => SectionTrace | null;
}

type Create3D = (kind: 'line3d' | 'curve3d' | 'point3d' | 'functiongraph3d' | 'parametricsurface3d', parents: unknown[], attributes: Record<string, unknown>) => GeometryElement & { updateDataArray?: () => void; dataX?: number[]; dataY?: number[]; dataZ?: number[] };
const SECTION_STEPS = 72;
const SLICE_STEPS = 36;

export const FRAME: [number, number, number, number] = [-6.5, 5.5, 6.5, -5.5];

export function cameraBox(box: SpaceBox): SpaceBox {
  // Parallel View3D scales against x/y extents only. A cubic camera volume
  // keeps tall surfaces inside the viewport without distorting coordinates.
  const span = Math.max(...box.map(([min, max]) => max - min));
  return box.map(([min, max]) => {
    const center = min + (max - min) / 2;
    return [center - span / 2, center + span / 2];
  }) as SpaceBox;
}

/** Memoize by a string key; geometry is recomputed only when the key changes. */
function keyed<T>(compute: () => T) {
  let key: string | null = null;
  let value: T;
  return (next: string): T => {
    if (next !== key) { key = next; value = compute(); }
    return value;
  };
}

export function buildScene(board: Board, state: SceneState, options: { initialBox: SpaceBox; mesh: number; projection: 'parallel' | 'central'; points: SpacePoint[]; compile: ExpressionCompiler }): Scene {
  const { theme } = state;
  const axisColor = (index: number) => () => [theme().axisX, theme().axisY, theme().axisZ][index];
  const viewAttributes = {
    projection: options.projection, axesPosition: 'none',
    trackball: { enabled: true, button: 0, key: 'none', outside: true },
    az: { slider: { visible: false, start: SURFACE_VIEWS[0].azimuth }, keyboard: { enabled: true, key: 'none' } },
    el: { slider: { visible: false, start: SURFACE_VIEWS[0].elevation }, keyboard: { enabled: true, key: 'none' } },
    bank: { slider: { visible: false } },
    xPlaneFront: { visible: false }, yPlaneFront: { visible: false }, zPlaneFront: { visible: false },
    xPlaneRear: { visible: false }, yPlaneRear: { visible: false }, zPlaneRear: { visible: false },
    depthOrder: { enabled: true },
  } as unknown as View3DAttributes;
  const view = board.create('view3d', [[-5, -4.1], [10, 8.2], cameraBox(options.initialBox)], viewAttributes) as InteractiveView;
  // The shipped declarations also omit function-valued attributes for some
  // 3D elements. This narrow bridge follows the installed 1.14 source API.
  const create3D = view.create.bind(view) as Create3D;
  const dataCurve = (attributes: Record<string, unknown>, fill: () => [number[], number[], number[]]) => {
    const curve = create3D('curve3d', [[0], [0], [0]], attributes);
    curve.updateDataArray = function () { [this.dataX, this.dataY, this.dataZ] = fill(); };
    return curve;
  };

  // Bounding frame: twelve faint edges help depth perception while rotating.
  dataCurve({ strokeColor: () => theme().grid, strokeWidth: 1, highlight: false, visible: () => state.display().frame }, () => {
    const [[x0, x1], [y0, y1], [z0, z1]] = state.box();
    const X: number[] = [], Y: number[] = [], Z: number[] = [];
    const edge = (a: number[], b: number[]) => { X.push(a[0], b[0], NaN); Y.push(a[1], b[1], NaN); Z.push(a[2], b[2], NaN); };
    for (const y of [y0, y1]) for (const z of [z0, z1]) edge([x0, y, z], [x1, y, z]);
    for (const x of [x0, x1]) for (const z of [z0, z1]) edge([x, y0, z], [x, y1, z]);
    for (const x of [x0, x1]) for (const y of [y0, y1]) edge([x, y, z0], [x, y, z1]);
    return [X, Y, Z];
  });

  // Axes cross at the origin when it is inside the box, else at the nearest face.
  const cross = (coordinate: number) => Math.max(state.box()[coordinate][0], Math.min(0, state.box()[coordinate][1]));
  AXES.forEach((name, axisIndex) => {
    const endpoint = (end: 0 | 1) => [0, 1, 2].map((coordinate) => () => coordinate === axisIndex ? state.box()[coordinate][end] : cross(coordinate));
    create3D('line3d', [endpoint(0), endpoint(1)], {
      name, withLabel: true, strokeColor: axisColor(axisIndex), strokeWidth: 1.6, highlight: false,
      label: { strokeColor: axisColor(axisIndex), fontSize: 14, display: 'internal', offset: [6, 4], cssStyle: 'font-weight:600' },
      straightFirst: false, straightLast: false, lastArrow: { type: 2, size: 6 }, fixed: true, point1: { visible: false }, point2: { visible: false },
    });
  });

  const runtime = (index: number) => state.runtimes()[index];
  state.definitions().forEach((plot, index) => {
    const color = seriesColor(index, plot.color);
    const shown = () => state.shown(index);
    if (plot.type === 'parametric-curve') {
      const point = (t: number) => runtime(index).curve?.(t) ?? [NaN, NaN, NaN];
      create3D('curve3d', [(t: number) => point(t)[0], (t: number) => point(t)[1], (t: number) => point(t)[2], [0, 1]], { strokeColor: color, strokeWidth: 3, highlight: false, layer: 13, visible: shown, numberPointsHigh: 400 });
      return;
    }
    if (plot.type === 'implicit-surface') {
      const wireframe = keyed(() => {
        const F = runtime(index).implicit;
        return F ? implicitWireframe(F, state.box(), Math.max(4, Math.round(state.display().density / 2)), SLICE_STEPS) : [[], [], []] as [number[], number[], number[]];
      });
      dataCurve({ strokeColor: color, strokeWidth: 1.4, strokeOpacity: 0.9, highlight: false, visible: shown }, () => wireframe(`${state.revision()}|${state.display().density}|${state.box().flat().join(',')}`));
      return;
    }
    // Native surface topology is immutable in JSXGraph. Each sheet keeps a
    // shaded mesh and a separate adjustable wireframe; edits swap runtimes.
    const sheets = plot.type === 'quadric' ? 2 : 1;
    for (let sheet = 0; sheet < sheets; sheet++) {
      const active = () => shown() && sheet < runtime(index).sheets();
      const vertex = (s: number, t: number) => runtime(index).patches[sheet](s, t);
      const parents = [(s: number, t: number) => vertex(s, t)[0], (s: number, t: number) => vertex(s, t)[1], (s: number, t: number) => vertex(s, t)[2], [0, 1], [0, 1]];
      create3D('parametricsurface3d', parents, {
        type: 'shader', tiling: 'rectangle', stepsU: options.mesh, stepsV: options.mesh,
        polyhedron: {
          visible: () => active() && state.display().fill,
          fillColorArray: [color], fillOpacity: () => state.display().opacity, strokeWidth: 0, highlight: false,
          shader: { enabled: true, fixed: false, hue: colorHue(color, index), saturation: 70, minLightness: 46, maxLightness: 80 },
        },
      });
      create3D('parametricsurface3d', parents, {
        type: 'wireframe', stepsU: () => state.display().density, stepsV: () => state.display().density,
        strokeColor: color, strokeWidth: 0.6, strokeOpacity: 0.75, highlight: false,
        visible: () => active() && state.display().mesh,
      });
    }
  });

  // Cross-section: the plane and, for every surface, its trace in that plane.
  const sectionCaches = state.definitions().map((plot, index) => keyed((): SectionTrace | null => {
    const { axis, value } = state.section();
    const current = runtime(index);
    if (!current || plot.type === 'parametric-curve') return null;
    // Implicit surfaces are sliced directly. Sheets are cut in their own
    // parameter square so traces stop where the drawn surface stops.
    if (plot.type === 'implicit-surface' && current.implicit) {
      const segments = sliceSegments(current.implicit, axis, value, state.box(), SECTION_STEPS);
      return { segments, path: liftSegments(segments, axis, value) };
    }
    const traces = current.patches.slice(0, current.sheets()).map((patch) => patchSection(patch, axis, value, SECTION_STEPS));
    return {
      segments: traces.flatMap((trace) => trace.segments),
      path: [0, 1, 2].map((coordinate) => traces.flatMap((trace) => trace.path[coordinate])) as [number[], number[], number[]],
    };
  }));
  const section = (index: number) => {
    const { enabled, axis, value } = state.section();
    if (!enabled || !state.shown(index)) return null;
    return sectionCaches[index](`${state.revision()}|${axis}|${value}|${state.box().flat().join(',')}`);
  };
  dataCurve({
    strokeColor: () => theme().accent, strokeWidth: 1, strokeOpacity: 0.7, fillColor: () => theme().accent, fillOpacity: 0.1, highlight: false,
    visible: () => state.section().enabled,
  }, () => {
    const { axis, value } = state.section();
    const index = AXES.indexOf(axis);
    const others = [0, 1, 2].filter((coordinate) => coordinate !== index);
    const corners = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]].map(([i, j]) => {
      const point = [0, 0, 0];
      point[index] = value;
      point[others[0]] = state.box()[others[0]][i];
      point[others[1]] = state.box()[others[1]][j];
      return point;
    });
    return [corners.map((p) => p[0]), corners.map((p) => p[1]), corners.map((p) => p[2])];
  });
  state.definitions().forEach((_, index) => {
    dataCurve({ strokeColor: () => theme().ink, strokeWidth: 3.2, highlight: false, layer: 13, visible: () => section(index) !== null }, () => section(index)?.path ?? [[], [], []]);
  });

  // Probe point on the selected plot.
  const probePoint = () => {
    const probe = state.probe();
    if (!probe) return [NaN, NaN, NaN];
    const plot = state.definitions()[probe.index];
    return evaluateProbe(plot, runtime(probe.index), state.box(), probe.fractions);
  };
  create3D('point3d', [() => probePoint()[0], () => probePoint()[1], () => probePoint()[2]], {
    name: 'P', size: 4, fixed: true, fillColor: '#f59e0b', strokeColor: '#92400e', highlight: false, showInfobox: false,
    visible: () => { const probe = state.probe(); return probe !== null && state.shown(probe.index) && probePoint().every(Number.isFinite); },
    label: { strokeColor: () => theme().ink, display: 'internal', offset: [8, 8] },
  });

  for (const [index, point] of options.points.entries()) {
    const color = point.color ?? seriesColor(index + 3);
    const coordinates = AXES.map((axis) => compileNumeric(point[axis], options.compile));
    create3D('point3d', coordinates, {
      name: point.name ?? '', size: 3.5, fixed: true, fillColor: color, strokeColor: color, highlight: false, showInfobox: false,
      label: { strokeColor: () => theme().ink, display: 'internal', offset: [8, 8] },
    });
  }

  return { view, section };
}
