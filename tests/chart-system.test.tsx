import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { exportFileName, toCsv, wrapText } from '../components/charts/core/export';
import { createFormatter, formatValue } from '../components/charts/core/format';
import { estimateTextWidth, placePointLabels } from '../components/charts/core/labels';
import {
  createBrokenScale,
  linearTicks,
  logTicks,
  niceLinearDomain,
  paddedLogDomain,
  snapLogDomain,
} from '../components/charts/core/scales';
import { resolveColor, resolveSeries, toggleHidden } from '../components/charts/core/series';
import { paretoFrontier, tradeoffAxes, tradeoffSeriesFromRows } from '../components/charts/core/tradeoff';
import { StudyBarChart, StudyLineChart, StudyTradeoffChart } from '../components/charts';
import { buildNiceHistogramBins } from '../components/charts/study-chart-model';
import { funnelStages } from '../components/charts/types/funnel-chart';
import { endLabelsFit } from '../components/charts/types/line-chart';
import { foldSlices } from '../components/charts/types/pie-chart';
import { normalizeRadialItems } from '../components/charts/types/radial-chart';
import { groupRows } from '../components/charts/types/scatter-chart';
import { buildTreemap } from '../components/charts/types/treemap-chart';

describe('chart formatting', () => {
  it('formats presets and specs without throwing on gaps', () => {
    expect(createFormatter('percent', 'en-US')(52.63)).toBe('52.6%');
    expect(createFormatter('ratio', 'en-US')(0.526)).toBe('52.6%');
    expect(createFormatter('usd', 'en-US')(11.1)).toBe('$11.1');
    expect(createFormatter('multiplier', 'en-US')(1.6)).toBe('1.6×');
    expect(createFormatter({ suffix: ' 分', digits: 0 }, 'en-US')(18.4)).toBe('18 分');
    expect(createFormatter('compact', 'en-US')(12_900)).toBe('12.9K');
    expect(createFormatter('number')(Number.NaN)).toBe('–');
    expect(formatValue(undefined, createFormatter())).toBe('–');
    expect(formatValue('12', createFormatter('integer', 'en-US'))).toBe('12');
  });
});

describe('chart scales', () => {
  it('chooses readable log ticks with human mantissas', () => {
    expect(logTicks([8.5, 50])).toEqual([10, 15, 20, 30, 40, 50]);
    expect(logTicks([0.15, 4])).toEqual([0.2, 0.3, 0.5, 1, 2, 3]);
    expect(logTicks([1, 10_000])).toEqual([1, 10, 100, 1000, 10_000]);
    expect(logTicks([-1, 10])).toEqual([]);
  });

  it('pads and snaps log domains to labelled ticks', () => {
    const padded = paddedLogDomain([11.1, 44.6], 0.05);
    expect(padded[0]).toBeLessThan(11.1);
    expect(padded[1]).toBeGreaterThan(44.6);
    expect(snapLogDomain(padded)).toEqual([10, 50]);
  });

  it('builds nice linear domains and ticks', () => {
    expect(niceLinearDomain([12.4, 52.6], { includeZero: true, tickCount: 6 })).toEqual([0, 60]);
    expect(linearTicks([0, 60], 6)).toEqual([0, 10, 20, 30, 40, 50, 60]);
  });

  it('compresses the empty band of a broken axis but keeps zero', () => {
    const scale = createBrokenScale(50, 70, 0.1);
    expect(scale.toPlot(0)).toBe(0);
    expect(scale.toPlot(50)).toBeCloseTo(0.1);
    expect(scale.toPlot(70)).toBeCloseTo(1);
    expect(scale.fromPlot(scale.toPlot(63))).toBeCloseTo(63);
  });
});

describe('chart series', () => {
  it('assigns categorical slots in order and never cycles past eight', () => {
    const series = resolveSeries(Array.from({ length: 10 }, (_, index) => ({ key: `s${index}` })));
    expect(series[0]?.color).toBe('var(--chart-1)');
    expect(series[7]?.color).toBe('var(--chart-8)');
    expect(series[8]?.color).toBe('var(--chart-other)');
    expect(resolveColor('3', 0)).toBe('var(--chart-3)');
    expect(resolveColor('editorial-2', 0)).toBe('var(--chart-editorial-2)');
    expect(resolveColor('#123456', 0)).toBe('#123456');
  });

  it('keeps at least one series visible when toggling', () => {
    const keys = ['a', 'b'];
    const hidden = toggleHidden(new Set(), 'a', keys);
    expect([...hidden]).toEqual(['a']);
    expect([...toggleHidden(hidden, 'b', keys)]).toEqual(['a']);
    expect([...toggleHidden(hidden, 'a', keys)]).toEqual([]);
  });
});

describe('point label placement', () => {
  it('flips a label away from a colliding neighbour', () => {
    const placed = placePointLabels(
      [
        { id: 'top', x: 100, y: 100, text: 'high', group: 'a' },
        { id: 'below', x: 100, y: 124, text: 'xhigh', group: 'b' },
      ],
      { bounds: { x: 0, y: 0, width: 400, height: 300 } },
    );
    expect(placed.get('top')?.side).toBe('above');
    expect(placed.get('below')?.side).toBe('below');
  });

  it('respects author overrides and hidden labels', () => {
    const placed = placePointLabels([
      { id: 'a', x: 50, y: 50, text: 'low', group: 'a', side: 'below' },
      { id: 'b', x: 150, y: 50, text: 'max', group: 'a', side: 'hide' },
    ]);
    expect(placed.get('a')?.side).toBe('below');
    expect(placed.has('b')).toBe(false);
  });

  it('measures CJK glyphs wider than Latin ones', () => {
    expect(estimateTextWidth('档位', 12)).toBeGreaterThan(estimateTextWidth('ab', 12));
  });
});

describe('tradeoff model', () => {
  const series = tradeoffSeriesFromRows({
    data: [
      { series: 'new', label: 'low', x: 1.2, y: 61 },
      { series: 'new', label: 'max', x: 7.5, y: 72 },
      { series: 'old', label: 'low', x: 2.4, y: 55 },
      { series: 'old', label: 'max', x: 16, y: 64 },
      { series: 'old', label: 'bad', x: 'n/a', y: 64 },
    ],
    seriesKey: 'series',
    xKey: 'x',
    yKey: 'y',
    labelKey: 'label',
  });

  it('groups rows into ordered series and drops invalid points', () => {
    expect(series.map((item) => item.key)).toEqual(['new', 'old']);
    expect(series[1]?.points).toHaveLength(2);
  });

  it('breaks the value axis when the data sits far from zero', () => {
    const axes = tradeoffAxes(series);
    expect(axes.yBreak).toBeDefined();
    expect(axes.yPlotTicks[0]).toEqual({ plot: 0, value: 0 });
    expect(axes.xTicks.length).toBeGreaterThanOrEqual(4);
    expect(tradeoffAxes(series, { yBreak: false }).yBreak).toBeUndefined();
  });

  it('starts at zero without a break when the data spans widely', () => {
    const axes = tradeoffAxes([{ key: 'a', points: [{ x: 10, y: 12 }, { x: 40, y: 52 }] }]);
    expect(axes.yBreak).toBeUndefined();
    expect(axes.yDomain[0]).toBe(0);
  });

  it('finds the cost-performance frontier', () => {
    const frontier = paretoFrontier([
      { x: 1, y: 50 },
      { x: 2, y: 45 },
      { x: 3, y: 60 },
      { x: 4, y: 58 },
    ]);
    expect(frontier.map((point) => point.x)).toEqual([1, 3]);
  });
});

describe('chart type models', () => {
  it('folds small pie slices into Other', () => {
    const slices = foldSlices(
      [
        { name: 'a', v: 50 },
        { name: 'b', v: 30 },
        { name: 'c', v: 10 },
        { name: 'd', v: 6 },
        { name: 'e', v: 4 },
      ],
      'name',
      'v',
      3,
    );
    expect(slices.map((slice) => slice.name)).toEqual(['a', 'b', '其他']);
    expect(slices.at(-1)?.value).toBe(20);
    expect(slices.at(-1)?.color).toBe('var(--chart-other)');
  });

  it('computes funnel conversion against the first and previous stage', () => {
    const stages = funnelStages([
      { name: 'a', value: 200 },
      { name: 'b', value: 100 },
      { name: 'c', value: 50 },
    ]);
    expect(stages[2]?.ofFirst).toBe(0.25);
    expect(stages[2]?.ofPrevious).toBe(0.5);
  });

  it('nests treemap rows by group with one colour per group', () => {
    const tree = buildTreemap(
      [
        { group: 'x', name: 'a', value: 2 },
        { group: 'y', name: 'b', value: 3 },
        { group: 'x', name: 'c', value: 0 },
      ],
      { groupKey: 'group' },
    );
    expect(tree.groups.map((group) => group.name)).toEqual(['x', 'y']);
    expect(tree.leaves).toHaveLength(2);
  });

  it('clamps radial progress and groups scatter rows', () => {
    expect(normalizeRadialItems({ items: [{ label: 'a', value: 120, max: 100 }] })[0]?.ratio).toBe(1);
    expect(groupRows([{ g: 'b' }, { g: 'a' }, { g: 'b' }], 'g', ['a']).map((group) => group.key)).toEqual(['a', 'b']);
  });

  it('bins histograms on round boundaries', () => {
    const bins = buildNiceHistogramBins([58, 61, 66, 70, 74, 79, 85, 92], 7);
    expect(bins[0]?.start).toBe(55);
    expect(bins.every((bin) => Number.isInteger(bin.start))).toBe(true);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(8);
  });

  it('drops end labels when line ends converge', () => {
    const rows = [
      { a: 0, b: 50 },
      { a: 80, b: 82 },
    ];
    expect(endLabelsFit(rows, ['a', 'b'])).toBe(false);
    expect(endLabelsFit([{ a: 10, b: 90 }], ['a', 'b'])).toBe(true);
  });
});

describe('chart export helpers', () => {
  it('builds safe file names, CSV and wrapped footnotes', () => {
    expect(exportFileName('章节 练习量 / 2026', 'svg')).toBe('章节-练习量-2026.svg');
    expect(toCsv([{ a: 'x,y', b: 1 }], [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }])).toBe('A,B\n"x,y",1');
    const lines = wrapText('这是一个需要换行的很长很长的脚注文本', 60, 12);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe('这是一个需要换行的很长很长的脚注文本');
  });
});

describe('chart server render', () => {
  it('renders a captioned figure with a screen-reader data table', () => {
    const html = renderToStaticMarkup(
      <StudyBarChart
        data={[
          { chapter: '极限', count: 18 },
          { chapter: '导数', count: 14 },
        ]}
        series={[{ key: 'count', label: '题目数量' }]}
        summary="积分题最多"
        title="章节练习量"
        xKey="chapter"
      />,
    );
    expect(html).toContain('<figcaption');
    expect(html).toContain('章节练习量');
    expect(html).toContain('class="sr-only"');
    expect(html).toContain('<th');
    expect(html).toContain('极限');
    expect(html).toContain('积分题最多');
  });

  it('keeps the legacy Study API working', () => {
    const html = renderToStaticMarkup(
      <StudyLineChart
        data={[{ stage: 'W1', math: 62 }]}
        description="示例"
        series={[{ key: 'math', label: '数学' }]}
        title="阶段正确率"
        xKey="stage"
        yLabel="正确率"
      />,
    );
    expect(html).toContain('阶段正确率');
    expect(html).toContain('示例');
  });

  it('renders an empty state instead of an empty plot', () => {
    const html = renderToStaticMarkup(
      <StudyTradeoffChart emptyMessage="暂无数据" series={[]} title="空图" />,
    );
    expect(html).toContain('暂无数据');
  });
});

describe('series css keys', () => {
  it('keeps distinct non-ASCII keys distinct', async () => {
    const { cssKey } = await import('../components/charts/core/series');
    expect(cssKey('新模型')).not.toBe(cssKey('旧模型'));
    expect(cssKey('a.b')).not.toBe(cssKey('a b'));
    expect(cssKey('math_1')).toBe('math_1');
    expect(cssKey('新模型')).toMatch(/^[\w-]+$/);
  });
});
