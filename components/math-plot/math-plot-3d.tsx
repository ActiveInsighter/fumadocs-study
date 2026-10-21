import type { MathPlot3DProps } from './core/types';
import { type LegendEntry, MathFigure } from './frame';
import { assignColors3D, collectTex3D } from './plot3d/model';
import { Plot3DClient } from './plot3d/plot-3d-client';
import { renderTexMap } from './tex';

/**
 * Interactive WebGL plot for MDX: graphs z = f(x, y), parametric and implicit
 * surfaces (quadrics), solids given by inequalities (triple-integral domains),
 * curved-top cylinders, space curves and points. Three.js is loaded lazily.
 * See docs/math-plot.md for the authoring reference.
 */
export function MathPlot3D(props: MathPlot3DProps) {
  const { title, description, footnote, className, ...spec } = props;
  const items = spec.items ?? [];
  const colors = assignColors3D(items);
  const legend: LegendEntry[] = items.flatMap((item, index) => {
    if (!item.label || item.legend === false || item.type === 'point') return [];
    const kind: LegendEntry['kind'] =
      item.type === 'curve' ? (item.dashed ? 'dashed' : 'line') : 'area';
    return [{ label: item.label, color: colors[index], kind }];
  });
  const tex = renderTexMap(collectTex3D(props));

  return (
    <MathFigure
      title={title}
      description={description}
      footnote={footnote}
      legend={legend}
      tex={tex}
      badge="3D"
      className={className}
    >
      <Plot3DClient spec={spec} tex={tex} title={title} />
    </MathFigure>
  );
}
