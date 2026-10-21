import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import type { PlotColor } from './core/types';
import styles from './math-plot.module.css';
import type { TexMap } from './tex';

export interface LegendEntry {
  label: string;
  color: PlotColor;
  kind: 'line' | 'dashed' | 'area' | 'point';
}

/** Server-rendered figure shell shared by the 2D and 3D plots. */
export function MathFigure({
  title,
  description,
  footnote,
  legend,
  tex,
  badge,
  className,
  children,
}: {
  title: string;
  description?: string;
  footnote?: string;
  legend: LegendEntry[];
  tex: TexMap;
  badge: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure className={cn(styles.figure, 'not-prose', className)} aria-label={title}>
      <figcaption className={styles.caption}>
        <div className={styles.titleRow}>
          <span className={styles.title}>{title}</span>
          <span className={styles.badge}>{badge}</span>
        </div>
        {description ? <p className={styles.description}>{description}</p> : null}
      </figcaption>
      {legend.length ? (
        <ul className={styles.legend} aria-label="图例">
          {legend.map((entry, index) => (
            <li key={`${entry.label}-${index}`} className={styles.legendItem} data-color={entry.color}>
              <span className={styles.swatch} data-kind={entry.kind} aria-hidden="true" />
              <span
                className={styles.legendLabel}
                dangerouslySetInnerHTML={{ __html: tex[entry.label] ?? escapeHtml(entry.label) }}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {children}
      {footnote ? <p className={styles.footnote}>{footnote}</p> : null}
    </figure>
  );
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
