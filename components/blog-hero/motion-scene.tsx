import type { CSSProperties } from 'react';

import { cn } from '@/lib/utils';

import { HeroScene } from './hero-scene';
import { hashSeed } from './blog-hero';
import type { HeroAccent, HeroPreset } from './schema';

import styles from './blog-hero.module.css';

const accentSlots: Record<HeroAccent, number> = { indigo: 1, clay: 2, teal: 3, ochre: 4, plum: 5, moss: 6 };

export type MotionSceneProps = {
  preset: HeroPreset;
  /** Frame height in px. */
  height?: number;
  accent?: HeroAccent;
  tone?: 'auto' | 'light' | 'dark';
  intensity?: 'calm' | 'lively';
  /** Optional data for the dataflow preset. */
  series?: number[];
  caption?: string;
  /** Accessible description; the scene itself is decorative. */
  label?: string;
  seed?: number;
  className?: string;
};

/**
 * The hero scenes as an inline MDX block (section openers, interludes):
 *
 * ```mdx
 * <MotionScene preset="dataflow" accent="teal" tone="dark" height={260} caption="数据流" />
 * ```
 */
export function MotionScene({
  preset,
  height = 280,
  accent = 'indigo',
  tone = 'auto',
  intensity = 'calm',
  series,
  caption,
  label,
  seed,
  className,
}: MotionSceneProps) {
  const slot = accentSlots[accent];
  const style = {
    height,
    '--hero-accent': `var(--chart-${slot})`,
    '--hero-accent-2': `var(--chart-${(slot % 6) + 1})`,
    '--hero-accent-3': `var(--chart-${((slot + 1) % 6) + 1})`,
  } as CSSProperties;

  return (
    <figure
      aria-label={label ?? caption}
      className={cn('not-prose', styles.inlineFrame, className)}
      data-hero-preset={preset}
      data-tone={tone}
      role={label || caption ? 'img' : undefined}
      style={style}
    >
      <div aria-hidden="true" className={styles.poster} />
      <HeroScene intensity={intensity} preset={preset} seed={seed ?? hashSeed(`${preset}-${caption ?? ''}`)} series={series} />
      {caption ? <figcaption className={styles.inlineCaption}>{caption}</figcaption> : null}
    </figure>
  );
}
