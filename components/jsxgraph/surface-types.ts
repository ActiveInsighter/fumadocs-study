import type { PlotParameter } from './types';

export type NumericRange = [minimum: number, maximum: number];
export type SpaceBox = [x: NumericRange, y: NumericRange, z: NumericRange];

interface SurfaceStyle {
  label?: string;
  color?: string;
}

export type SurfaceDefinition = SurfaceStyle & (
  | { type: 'surface'; expression: string; domain?: [NumericRange, NumericRange] }
  | { type: 'parametric-surface'; x: string; y: string; z: string; ranges: [NumericRange, NumericRange] }
  | { type: 'parametric-curve'; x: string; y: string; z: string; range: NumericRange }
);

/** Every prop is serializable and can be written directly in MDX. */
export interface SurfacePlotProps {
  title?: string;
  description?: string;
  height?: number;
  plots: SurfaceDefinition[];
  parameters?: PlotParameter[];
  box?: SpaceBox;
  /** Facet resolution at initialization; readers can change the overlay mesh separately. */
  mesh?: number;
  probe?: boolean;
  editable?: boolean;
  projection?: 'parallel' | 'central';
}
