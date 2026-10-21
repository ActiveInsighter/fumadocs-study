import type { MathPlot2DProps } from './core/types';
import { type LegendEntry, MathFigure } from './frame';
import { assignColors, collectTex2D } from './plot2d/model';
import { Plot2DClient } from './plot2d/plot-2d-client';
import { renderTexMap } from './tex';

/**
 * Interactive planar plot for MDX: explicit, parametric, polar and implicit
 * curves, inequality regions, points, sliders and Fubini slices for double
 * integral domains. See docs/math-plot.md for the authoring reference.
 */
export function MathPlot2D(props: MathPlot2DProps) {
  const { title, description, footnote, className, ...spec } = props;
  const items = spec.items ?? [];
  const colors = assignColors(items);
  const legend: LegendEntry[] = items.flatMap((item, index) => {
    if (!item.label || item.legend === false || item.type === 'point') return [];
    const kind: LegendEntry['kind'] =
      item.type === 'region'
        ? 'area'
        : 'dashed' in item && item.dashed
          ? 'dashed'
          : item.type === 'line' && item.dashed !== false
            ? 'dashed'
            : 'line';
    return [{ label: item.label, color: colors[index], kind }];
  });
  const tex = renderTexMap(collectTex2D(props));

  return (
    <MathFigure
      title={title}
      description={description}
      footnote={footnote}
      legend={legend}
      tex={tex}
      badge="2D"
      className={className}
    >
      <Plot2DClient spec={spec} tex={tex} title={title} />
    </MathFigure>
  );
}
