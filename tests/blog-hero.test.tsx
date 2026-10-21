import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BlogHero, detectMotionLevel, formatEyebrowDate, hashSeed, heroSchema } from '../components/blog-hero';
import { MotionScene } from '../components/blog-hero/motion-scene';
import { layoutSeries, smoothPath } from '../components/blog-hero/scenes/dataflow-scene';
import { createFrameBudget, seededRandom } from '../components/blog-hero/use-hero-motion';

describe('hero frontmatter schema', () => {
  it('fills every field with a default from just a preset', () => {
    const config = heroSchema.parse({ preset: 'aurora' });
    expect(config).toMatchObject({
      preset: 'aurora',
      align: 'center',
      tone: 'auto',
      accent: 'indigo',
      height: 'tall',
      index: false,
      intensity: 'calm',
      scroll: true,
    });
  });

  it('rejects unknown presets and oversized fact lists', () => {
    expect(heroSchema.safeParse({ preset: 'webgl' }).success).toBe(false);
    const facts = Array.from({ length: 5 }, (_, index) => ({ label: `k${index}`, value: 'v' }));
    expect(heroSchema.safeParse({ facts }).success).toBe(false);
  });

  it('keeps the example post valid', () => {
    const source = readFileSync(join(process.cwd(), 'content/blog/designing-study-charts.mdx'), 'utf8');
    expect(source).toMatch(/^hero:\n {2}preset: dataflow/m);
  });
});

describe('motion budget', () => {
  it('degrades for reduced motion, data saver and low-power hardware', () => {
    expect(detectMotionLevel({ reducedMotion: true, cores: 16 })).toBe('static');
    expect(detectMotionLevel({ reducedMotion: false, saveData: true })).toBe('static');
    expect(detectMotionLevel({ reducedMotion: false, cores: 4 })).toBe('reduced');
    expect(detectMotionLevel({ reducedMotion: false, memory: 2, cores: 8 })).toBe('reduced');
    expect(detectMotionLevel({ reducedMotion: false, cores: 8, memory: 8 })).toBe('full');
  });

  it('flags sustained slow frames', () => {
    const budget = createFrameBudget(34, 5);
    let ok = true;
    for (let frame = 0; frame <= 5; frame += 1) ok = budget.tick(frame * 60);
    expect(ok).toBe(false);
  });

  it('produces deterministic scene layouts', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(hashSeed('同一标题')).toBe(hashSeed('同一标题'));
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });
});

describe('dataflow geometry', () => {
  it('lays a rising series out left-to-right and bottom-to-top', () => {
    const points = layoutSeries([10, 20, 30]);
    expect(points[0]!.x).toBeLessThan(points[2]!.x);
    expect(points[0]!.y).toBeGreaterThan(points[2]!.y);
    expect(smoothPath(points)).toMatch(/^M[\d.]+,[\d.]+C/);
    expect(smoothPath([])).toBe('');
  });
});

describe('BlogHero server render', () => {
  const config = heroSchema.parse({
    preset: 'dataflow',
    headline: '第一行\n第二行',
    index: true,
    facts: [{ label: '阅读时间', value: '8 分钟' }],
  });

  it('renders the headline as a real h1 with the index and facts', () => {
    const html = renderToStaticMarkup(
      <BlogHero
        author="作者"
        config={config}
        date={new Date('2026-10-21T00:00:00Z')}
        description="导语"
        title="标题"
        toc={[
          { title: '第一节', url: '#a', depth: 2 },
          { title: '小节', url: '#a-1', depth: 3 },
          { title: '第二节', url: '#b', depth: 2 },
        ]}
      />,
    );
    expect(html).toMatch(/<h1[^>]*>.*第一行.*第二行.*<\/h1>/);
    expect(html).toContain('导语');
    expect(html).toContain('2026 年 10 月 21 日');
    expect(html).toContain('href="#a"');
    expect(html).toContain('href="#b"');
    expect(html).not.toContain('href="#a-1"');
    expect(html).toContain('阅读时间');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-hero-preset="dataflow"');
  });

  it('falls back to the post title and date when no overrides are set', () => {
    const html = renderToStaticMarkup(
      <BlogHero config={heroSchema.parse({})} date={new Date('2026-01-05T00:00:00Z')} title="普通标题" />,
    );
    expect(html).toContain('普通标题');
    expect(html).toContain(formatEyebrowDate(new Date('2026-01-05T00:00:00Z')));
    expect(html).not.toContain('文章目录');
  });

  it('renders inline scenes as labelled, decorative figures', () => {
    const html = renderToStaticMarkup(<MotionScene caption="数据流" preset="dataflow" />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="数据流"');
    expect(html).toContain('<figcaption');
  });
});
