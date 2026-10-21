/**
 * Serialisable specs for <MathPlot2D> and <MathPlot3D>.
 *
 * Everything here can be written inline in MDX: numbers, strings and plain
 * objects. Mathematical expressions are strings compiled by core/expr.ts and
 * may reference the slider parameters declared in `params`.
 */

/** A number, or an expression such as "2pi", "sqrt(2)" or "a/2" (params allowed). */
export type NumberLike = number | string;
export type RangeLike = readonly [NumberLike, NumberLike];

/** Named palette entries (see styles/tokens/components.css, --math-plot-*). */
export type PlotColor = 'blue' | 'green' | 'coral' | 'teal' | 'amber' | 'plum' | 'gray' | 'ink';

export interface ParamSpec {
  /** Letters only, e.g. "a" or "k"; avoid names of built-in variables (x, y, z, t, u, v, r, theta…). */
  name: string;
  /** TeX label; defaults to the name. */
  label?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  /** Show a play button that sweeps the parameter back and forth. */
  animate?: boolean;
}

interface Labelled {
  /** TeX label drawn next to the item. */
  label?: string;
  color?: PlotColor;
  /** Hide from the legend while still drawing the item. */
  legend?: boolean;
}

interface Stroked extends Labelled {
  dashed?: boolean;
  /** Line width in CSS pixels (2D) or a relative weight (3D). */
  width?: number;
  /** Thin full curve with a bold stroke only where it borders a filled region. */
  boundary?: boolean;
  /** Where the label sits along the curve, 0–1. */
  labelAt?: number;
  /** Number of direction arrows (oriented curves). */
  arrows?: number;
}

/* -------------------------------------------------------------------- 2D */

/** y = f(x) (or x = f(y) with of: "y"). */
export interface Function2D extends Stroked {
  type: 'function';
  fn: string;
  of?: 'x' | 'y';
  /** Restrict the independent variable; defaults to the visible window. */
  domain?: RangeLike;
}

/** (x(t), y(t)). */
export interface Parametric2D extends Stroked {
  type: 'parametric';
  x: string;
  y: string;
  t: RangeLike;
  samples?: number;
}

/** r = r(θ); the parameter is available as both theta and t. */
export interface Polar2D extends Stroked {
  type: 'polar';
  r: string;
  theta?: RangeLike;
  samples?: number;
}

/** F(x, y) = 0, or an equation "x^2 + y^2 = 1". */
export interface Implicit2D extends Stroked {
  type: 'implicit';
  eq: string;
}

/** Filled region given by a predicate, e.g. "x^2 + y^2 <= 1 && y >= 0". r and theta are also bound. */
export interface Region2D extends Labelled {
  type: 'region';
  where: string;
  /** Faint context layer that is not part of the integration domain. */
  faint?: boolean;
  /** Fill opacity multiplier. */
  opacity?: number;
}

export interface Point2D extends Labelled {
  type: 'point';
  at: RangeLike;
  /** Label direction in degrees (0 = right, 90 = up). */
  dir?: number;
  /** Hollow marker (open endpoint / removable discontinuity). */
  open?: boolean;
}

export interface Segment2D extends Stroked {
  type: 'segment';
  from: RangeLike;
  to: RangeLike;
}

/** Vertical (x = c) or horizontal (y = c) reference line, dashed by default. */
export interface Line2D extends Stroked {
  type: 'line';
  x?: NumberLike;
  y?: NumberLike;
}

export type PlotItem2D =
  | Function2D
  | Parametric2D
  | Polar2D
  | Implicit2D
  | Region2D
  | Point2D
  | Segment2D
  | Line2D;

/** TeX bounds shown for slices whose position lies in [from, to]. */
export interface SlicePiece {
  from: NumberLike;
  to: NumberLike;
  lo?: string;
  hi?: string;
  /** Free-form TeX that replaces lo/hi (e.g. a disconnected slice). */
  tex?: string;
}

export interface SliceSpec {
  /** x: vertical lines (X 型), y: horizontal lines (Y 型), polar: rays from the origin. */
  mode: 'x' | 'y' | 'polar';
  range: RangeLike;
  /** Tab label, e.g. "先 y 后 x". */
  label?: string;
  pieces?: SlicePiece[];
}

export interface MathPlot2DProps {
  title: string;
  description?: string;
  footnote?: string;
  /** Visible window. */
  x?: RangeLike;
  y?: RangeLike;
  items: PlotItem2D[];
  params?: ParamSpec[];
  /** Integration domain predicate; defaults to the union of non-faint regions. */
  domain?: string;
  slices?: SliceSpec[];
  /** Show the numeric area of the domain. */
  area?: boolean;
  /** Keep 1:1 axis scale (default true). Set false to stretch to the frame. */
  equal?: boolean;
  /** Plot height in px (default responsive 16:10, 260–460px). */
  height?: number;
  /** Hide the grid and keep only the axes. */
  minimal?: boolean;
  /** Label the x-axis in multiples of π (trigonometric graphs). */
  piTicks?: boolean;
  className?: string;
}

/* -------------------------------------------------------------------- 3D */

/** z = f(x, y) over a rectangle, an optional predicate, or a polar sector. */
export interface Surface3D extends Labelled {
  type: 'surface';
  z: string;
  x?: RangeLike;
  y?: RangeLike;
  /** Polar domain: r ∈ [r0, r1], θ ∈ theta (defaults to a full turn). */
  r?: RangeLike;
  theta?: RangeLike;
  /** Clip the domain with a predicate in x, y (boundary cut exactly). */
  where?: string;
  /** Colour by height (default true for surfaces). */
  colormap?: boolean;
  /** Level curves projected onto the floor. */
  contours?: boolean | number;
  opacity?: number;
  wireframe?: boolean;
  resolution?: number;
}

/** (x(u,v), y(u,v), z(u,v)). */
export interface Parametric3D extends Labelled {
  type: 'parametric';
  x: string;
  y: string;
  z: string;
  u: RangeLike;
  v: RangeLike;
  /** Colour by height; defaults to true unless a `color` is given. */
  colormap?: boolean;
  opacity?: number;
  wireframe?: boolean;
  resolution?: number | readonly [number, number];
}

/** Implicit surface F(x, y, z) = 0 (e.g. "x^2/4 + y^2 - z^2 = 1"), meshed by marching tetrahedra. */
export interface Implicit3D extends Labelled {
  type: 'implicit';
  eq: string;
  /** Colour by height; defaults to true unless a `color` is given. */
  colormap?: boolean;
  opacity?: number;
  resolution?: number;
}

/** Closed solid given by inequalities, e.g. "x^2 + y^2 <= z && z <= 1" (triple-integral domains). */
export interface Solid3D extends Labelled {
  type: 'solid';
  where: string;
  opacity?: number;
  resolution?: number;
  /** Shade the xy-projection D_xy on the floor. */
  projection?: boolean;
}

/** Curved-top cylinder: solid under z = f(x, y) over a planar region (double integrals). */
export interface Cylinder3D extends Labelled {
  type: 'cylinder';
  z: string;
  where: string;
  x?: RangeLike;
  y?: RangeLike;
  resolution?: number;
}

export interface Curve3D extends Labelled {
  type: 'curve';
  x: string;
  y: string;
  z: string;
  t: RangeLike;
  dashed?: boolean;
  arrows?: number;
  tube?: boolean;
}

export interface Point3D extends Labelled {
  type: 'point';
  at: readonly [NumberLike, NumberLike, NumberLike];
}

export type PlotItem3D =
  | Surface3D
  | Parametric3D
  | Implicit3D
  | Solid3D
  | Cylinder3D
  | Curve3D
  | Point3D;

export interface MathPlot3DProps {
  title: string;
  description?: string;
  footnote?: string;
  /** Scene box; surfaces are clipped to it. */
  x?: RangeLike;
  y?: RangeLike;
  z?: RangeLike;
  items: PlotItem3D[];
  params?: ParamSpec[];
  /** Camera direction from the box centre. */
  camera?: readonly [number, number, number];
  /** Show a horizontal z-section slider for solids. */
  section?: boolean;
  /** Show the numeric volume of solid items. */
  volume?: boolean;
  /** Scale z so the box looks cubic (useful when z spans a much larger range). */
  aspect?: 'equal' | 'cube';
  height?: number;
  autoRotate?: boolean;
  className?: string;
}
