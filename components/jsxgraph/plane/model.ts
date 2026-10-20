import { validateNumeric } from '../core/expression';
import { validatePlotParameters } from '../core/parameters';
import { PLOT_KINDS, plotKind } from './plots';
import type { BoundingBox, FunctionPlotProps, PlotDefinition } from './types';

export const DEFAULT_BOUNDING_BOX: BoundingBox = [-5, 5, 5, -5];
export const MAX_PLOTS = 20;

export function validatePlotDefinition(plot: PlotDefinition): void {
  if (!plot || typeof plot !== 'object' || !Object.hasOwn(PLOT_KINDS, plot.type)) throw new Error(`曲线类型必须是 ${Object.keys(PLOT_KINDS).join('、')} 之一。`);
  plotKind(plot).validate(plot);
}

export function validatePlotConfig({ plots, parameters = [], points = [], boundingBox = DEFAULT_BOUNDING_BOX, height = 420 }: FunctionPlotProps): void {
  if (!Array.isArray(boundingBox) || boundingBox.length !== 4 || !boundingBox.every(Number.isFinite) || boundingBox[0] >= boundingBox[2] || boundingBox[3] >= boundingBox[1]) {
    throw new Error('boundingBox 必须是 [左, 上, 右, 下]，且左 < 右、下 < 上。');
  }
  if (!Number.isFinite(height) || height < 200 || height > 1200) throw new Error('height 必须在 200–1200 之间。');
  if (!Array.isArray(plots) || !plots.length || plots.length > MAX_PLOTS) throw new Error(`每个画板需要 1–${MAX_PLOTS} 条曲线。`);
  validatePlotParameters(parameters);
  plots.forEach(validatePlotDefinition);
  if (!Array.isArray(points)) throw new Error('points 必须是点数组。');
  for (const point of points) {
    if (!point || typeof point !== 'object') throw new Error('点必须包含 x、y 坐标。');
    validateNumeric(point.x, '点的 x 坐标');
    validateNumeric(point.y, '点的 y 坐标');
  }
}
