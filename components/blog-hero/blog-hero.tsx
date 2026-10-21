import type { TOCItemType } from 'fumadocs-core/toc';
import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { HeroScene } from './hero-scene';
import { HeroScroll } from './hero-scroll';
import type { HeroConfig } from './schema';

import styles from './blog-hero.module.css';

export type BlogHeroProps = {
  config: HeroConfig;
  title: string;
  description?: string;
  date?: Date;
  author?: string;
  /** Post TOC; the h2 entries feed the numbered index when `config.index`. */
  toc?: readonly TOCItemType[];
  className?: string;
};

const accentSlots = { indigo: 1, clay: 2, teal: 3, ochre: 4, plum: 5, moss: 6 } as const;

/**
 * Configurable blog hero.
 *
 * Rendered on the server: the headline, deck, index and facts are real
 * text in the static HTML, so the LCP element is text that paints on first
 * frame (it never starts transparent). The scene layer is decorative
 * (aria-hidden), sized by CSS before any JavaScript runs (no CLS), and its
 * client code loads lazily per preset.
 */
export function BlogHero({ config, title, description, date, author, toc, className }: BlogHeroProps) {
  const headline = config.headline ?? title;
  const deck = config.deck ?? description;
  const eyebrow = config.eyebrow ?? (date ? formatEyebrowDate(date) : undefined);
  const sections = config.index ? (toc ?? []).filter((item) => item.depth === 2).slice(0, 8) : [];
  const accent = accentSlots[config.accent];
  const style = {
    '--hero-accent': `var(--chart-${accent})`,
    '--hero-accent-2': `var(--chart-${(accent % 6) + 1})`,
    '--hero-accent-3': `var(--chart-${((accent + 1) % 6) + 1})`,
  } as CSSProperties;

  return (
    <HeroScroll
      className={cn(styles.hero, className)}
      data-align={config.align}
      data-height={config.height}
      data-hero-preset={config.preset}
      data-tone={config.tone}
      enabled={config.scroll}
      style={style}
    >
      <div aria-hidden="true" className={styles.backdrop} data-hero-layer="backdrop">
        <div className={styles.poster} />
        {config.preset !== 'minimal' ? (
          <HeroScene intensity={config.intensity} preset={config.preset} seed={config.seed ?? hashSeed(title)} series={config.series} />
        ) : null}
        <div className={styles.scrim} />
      </div>

      <div className={styles.content} data-hero-layer="content">
        {eyebrow ? (
          <p className={styles.eyebrow}>
            <span>{eyebrow}</span>
            {author ? <span className={styles.byline}>{author}</span> : null}
          </p>
        ) : null}
        <h1 className={styles.title}>{renderHeadline(headline)}</h1>
        {deck ? <p className={styles.deck}>{deck}</p> : null}

        {sections.length > 0 ? (
          <nav aria-label="文章目录" className={styles.index}>
            <ol>
              {sections.map((item, index) => (
                <li key={item.url}>
                  <a href={item.url}>
                    <span className={styles.indexNumber}>[{index + 1}]</span>
                    <span aria-hidden="true" className={styles.indexLeader} />
                    <span className={styles.indexTitle}>{item.title as ReactNode}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        {config.facts?.length ? (
          <dl className={styles.facts}>
            {config.facts.map((fact) => (
              <div className={styles.fact} key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </HeroScroll>
  );
}

function renderHeadline(headline: string): ReactNode {
  const lines = headline.split(/\\n|\n/);
  return lines.map((line, index) => (
    <span className={styles.titleLine} key={index}>
      {line}
    </span>
  ));
}

export function formatEyebrowDate(date: Date): string {
  return `${date.getUTCFullYear()} 年 ${date.getUTCMonth() + 1} 月 ${date.getUTCDate()} 日`;
}

/** Stable per-post seed so every post gets its own, repeatable scene layout. */
export function hashSeed(text: string): number {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
