import type { Board, BoardAttributes } from 'jsxgraph';

export type BoundingBox = [left: number, top: number, right: number, bottom: number];

export interface PlotParameter {
  name: string;
  label?: string;
  min: number;
  max: number;
  value: number;
  step?: number;
}

interface PlotStyle {
  label?: string;
  color?: string;
  dashed?: boolean;
}

export type PlotDefinition = PlotStyle & (
  | { type: 'function'; expression: string; domain?: [number, number]; probe?: boolean }
  | { type: 'implicit'; expression: string }
  | { type: 'parametric'; x: string; y: string; range: [number, number] }
);

export interface PlotPoint {
  x: number;
  y: number;
  name?: string;
  fixed?: boolean;
  color?: string;
}

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
}

export interface JSXGraphBoardProps {
  title?: string;
  description?: string;
  height?: number;
  boundingBox?: BoundingBox;
  axis?: boolean;
  grid?: boolean;
  options?: Partial<BoardAttributes>;
  /** Supply callbacks from a client component, never across the RSC boundary. */
  onInit?: (board: Board) => void | (() => void);
}
