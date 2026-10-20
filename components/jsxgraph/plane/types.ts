import type { Numeric } from '../core/expression';
import type { PlotParameter } from '../core/parameters';

export type BoundingBox = [left: number, top: number, right: number, bottom: number];

interface PlotStyle {
  label?: string;
  color?: string;
  dashed?: boolean;
}

export interface FunctionDefinition {
  type: 'function';
  /** Right-hand side of y = f(x); a leading `y=` is accepted. */
  expression: string;
  domain?: [Numeric, Numeric];
  /** Draggable point with coordinate, slope and tangent readouts. */
  probe?: boolean;
  /** Show the derivative curve y = f'(x), computed numerically. */
  derivative?: boolean;
  /** Shade the signed area between the curve and the x-axis on [a, b]. */
  area?: [Numeric, Numeric];
}

export type PlotDefinition = PlotStyle & (
  | FunctionDefinition
  | { type: 'implicit'; expression: string }
  | { type: 'parametric'; x: string; y: string; range: [Numeric, Numeric] }
  | { type: 'polar'; expression: string; range?: [Numeric, Numeric] }
);

export type PlotType = PlotDefinition['type'];

export interface PlotPoint {
  /** Two numbers make a draggable point; expressions follow the parameters. */
  x: Numeric;
  y: Numeric;
  name?: string;
  fixed?: boolean;
  color?: string;
}

/** Every prop is serializable and can be written directly in MDX. */
export interface FunctionPlotProps {
  title?: string;
  description?: string;
  plots: PlotDefinition[];
  parameters?: PlotParameter[];
  points?: PlotPoint[];
  boundingBox?: BoundingBox;
  height?: number;
  axis?: boolean;
  grid?: boolean;
  editable?: boolean;
}
