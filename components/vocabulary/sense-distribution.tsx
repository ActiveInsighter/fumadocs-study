'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { StudyPieChart } from '@/components/charts';
import { StudyCardSection, studyCardReveal } from '@/components/ui/study-card';
import { senseColor, type SenseSummary } from './model';

type SenseDistributionProps = {
  word: string;
  summary: SenseSummary;
  /** Reveal order of the section within the aside. */
  order: number;
  /** Shows a sense in the main pane. */
  onSelect: (order: number) => void;
};

/**
 * How the occurrences split across senses: the study donut, total in the
 * hole, beside a legend. Hovering the chart or legend highlights only this
 * section (the main pane never rerenders the chart); choosing a sense asks
 * the caller to show it.
 */
export function SenseDistribution({ word, summary, order, onSelect }: SenseDistributionProps) {
  const { senses, total } = summary;
  const [active, setActive] = useState<string | null>(null);
  // Keep Pie.data identity across hover: Recharts otherwise treats it as new
  // data and can replay its entry animation.
  const data = useMemo(() => senses.map(({ gloss, count }) => ({ gloss, count })), [senses]);
  const colors = useMemo(() => Object.fromEntries(senses.map((sense, index) => [sense.gloss, senseColor(index)])), [senses]);

  const select = (index: number) => {
    setActive(senses[index]?.gloss ?? null);
    onSelect(index);
  };

  return (
    <StudyCardSection
      className="wc-detail-summary"
      label="义项分布"
      meta={`${senses.length} 个义项 · 共 ${total} 次`}
      {...studyCardReveal(order)}
    >
      <div className="wc-detail-distribution">
        <div className="wc-detail-donut">
          <StudyPieChart
            variant="inline"
            title={`${word} 的义项分布`}
            summary={senses.map((sense) => `${sense.gloss} ${sense.percentage}%`).join('，')}
            data={data}
            nameKey="gloss"
            valueKey="count"
            donut
            centerLabel={String(total)}
            centerCaption="次出现"
            colors={colors}
            maxSlices={Math.max(1, senses.length)}
            height={156}
            activeName={active}
            onActiveNameChange={setActive}
            onSliceClick={(name) => {
              const index = senses.findIndex((sense) => sense.gloss === name);
              if (index >= 0) select(index);
            }}
          />
        </div>
        <ol className="wc-detail-legend" onPointerLeave={() => setActive(null)}>
          {senses.map((sense, index) => (
            <li key={`${sense.gloss}-${index}`}>
              <button
                type="button"
                className="wc-detail-legend-item"
                title={sense.gloss}
                data-active={active === sense.gloss ? '' : undefined}
                data-dim={active && active !== sense.gloss ? '' : undefined}
                style={{ '--wc-sense-color': senseColor(index) } as CSSProperties}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') setActive(sense.gloss);
                }}
                onFocus={(event) => {
                  if (event.currentTarget.matches(':focus-visible')) setActive(sense.gloss);
                }}
                onBlur={() => setActive(null)}
                onClick={() => select(index)}
              >
                <span className="wc-detail-swatch" aria-hidden="true" />
                <span className="wc-detail-legend-gloss">{sense.gloss}</span>
                <span className="wc-detail-legend-pct">{sense.percentage}%</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </StudyCardSection>
  );
}
