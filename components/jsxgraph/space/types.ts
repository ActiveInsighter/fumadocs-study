import type { Numeric } from '../core/expression';
import type { PlotParameter } from '../core/parameters';

export type NumericRange = [minimum: number, maximum: number];
export type SpaceBox = [x: NumericRange, y: NumericRange, z: NumericRange];
export type Axis = 'x' | 'y' | 'z';

export type QuadricKind =
  | 'sphere' | 'ellipsoid'
  | 'hyperboloid-one-sheet' | 'hyperboloid-two-sheets' | 'cone'
  | 'elliptic-paraboloid' | 'hyperbolic-paraboloid'
  | 'elliptic-cylinder' | 'hyperbolic-cylinder' | 'parabolic-cylinder';

export interface QuadricDefinition {
  type: 'quadric';
  kind: QuadricKind;
  /** Semi-axes or scale factors; numbers or parameter expressions. Default 1. */
  a?: Numeric;
  b?: Numeric;
  c?: Numeric;
  /** Axis of symmetry (the variable with the distinguished sign). Default z. */
  axis?: Axis;
  /** Translate the surface: the equation uses (x-h), (y-k), (z-l). */
  center?: [Numeric, Numeric, Numeric];
  /** How far the open sheets extend, in the surface's own parameter. */
  extent?: number;
}

interface SurfaceStyle {
  label?: string;
  color?: string;
}

export type SurfaceDefinition = SurfaceStyle & (
  | { type: 'surface'; expression: string; domain?: [NumericRange, NumericRange] }
  | { type: 'parametric-surface'; x: string; y: string; z: string; ranges: [NumericRange, NumericRange] }
  | { type: 'parametric-curve'; x: string; y: string; z: string; range: NumericRange }
  /** F(x,y,z)=0 or lhs=rhs, drawn as families of level curves (slices). */
  | { type: 'implicit-surface'; expression: string }
  | QuadricDefinition
);

export type SurfaceType = SurfaceDefinition['type'];

export interface SpacePoint {
  x: Numeric;
  y: Numeric;
  z: Numeric;
  name?: string;
  color?: string;
}

export interface SectionOptions {
  axis?: Axis;
  value?: number;
}

/** Every prop is serializable and can be written directly in MDX. */
export interface SurfacePlotProps {
  title?: string;
  description?: string;
  height?: number;
  plots: SurfaceDefinition[];
  parameters?: PlotParameter[];
  points?: SpacePoint[];
  box?: SpaceBox;
  /** Facet resolution at initialization; readers can change the overlay mesh separately. */
  mesh?: number;
  probe?: boolean;
  editable?: boolean;
  projection?: 'parallel' | 'central';
  /** Show the cross-section tool; `true` starts with the plane z = 0. */
  section?: boolean | SectionOptions;
  /** Initial surface opacity, 0.2–1. */
  opacity?: number;
}
