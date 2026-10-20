'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useMemo } from 'react';

import { cn } from '@/lib/utils';

import { stageEase, stageSpring } from '../motion-presets';
import { useStage } from '../stage-context';
import { frameAt } from '../step-match';
import type { StageTone } from '../types';

export type GridBlock = {
  label?: string;
  sub?: string;
  tone?: StageTone;
};

export type GridMark = { index: number; label: string; tone?: StageTone };

export type BlockFrame = {
  /**
   * Persistent patch: { "2": { label: "P3" } } writes block 2 from this step
   * on; null empties it. Later frames build on earlier ones.
   */
  set?: Record<string, GridBlock | null>;
  /** Blocks in focus on this step only. */
  active?: number[];
  /** Blocks faded on this step only. */
  muted?: number[];
  /** Small tags on blocks for this step only, e.g. 命中 / 缺页 / LRU. */
  marks?: GridMark[];
};

export type BlockGridProps = {
  /** Initial contents. Use {} for an empty slot. */
  blocks: GridBlock[];
  frames?: BlockFrame[];
  /** Fixed column count; by default the grid fills the width. */
  columns?: number;
  /**
   * Label for each slot. "{i}" is the index, "{hex}" the index in hex.
   * Example: "帧 {i}", "0x{hex}". Set to "" to hide.
   */
  indexLabel?: string;
  title?: string;
  /** Tone used for focused blocks without a tone of their own. */
  activeTone?: StageTone;
  className?: string;
};

function formatIndex(template: string, index: number) {
  return template.replaceAll('{i}', String(index)).replaceAll('{hex}', index.toString(16).toUpperCase());
}

/**
 * A row/grid of slots — page frames, cache lines, TLB entries, disk blocks.
 * Contents change through persistent patches; focus and tags are per step.
 */
export function BlockGrid({
  blocks,
  frames = [],
  columns,
  indexLabel = '{i}',
  title,
  activeTone = 'amber',
  className,
}: BlockGridProps) {
  const { step } = useStage();

  const contents = useMemo(() => {
    const history: GridBlock[][] = [];
    let current = blocks.map((block) => ({ ...block }));
    for (const frame of frames) {
      if (frame.set) {
        current = current.map((block, index) => {
          const patch = frame.set?.[String(index)];
          if (patch === undefined) return block;
          return patch === null ? {} : { ...block, ...patch };
        });
      }
      history.push(current);
    }
    return history;
  }, [blocks, frames]);

  const cells = frameAt(contents, step) ?? blocks;
  const frame = frameAt(frames, step) ?? {};

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      {title && <p className="m-0 text-xs font-medium text-muted-foreground">{title}</p>}
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: columns
            ? `repeat(${columns}, minmax(0, 1fr))`
            : 'repeat(auto-fit, minmax(min(5.5rem, 100%), 1fr))',
        }}
      >
        {cells.map((block, index) => {
          const active = frame.active?.includes(index) ?? false;
          const muted = frame.muted?.includes(index) ?? false;
          const empty = !block.label;
          const marks = frame.marks?.filter((mark) => mark.index === index) ?? [];
          const tone = block.tone ?? (active ? activeTone : 'neutral');
          return (
            <motion.div
              key={index}
              data-tone={tone}
              initial={false}
              animate={{ opacity: muted ? 0.38 : 1, y: active ? -3 : 0 }}
              transition={stageSpring}
              className={cn(
                'relative flex min-h-[4.25rem] min-w-0 flex-col rounded-[var(--ui-radius-control)] border px-2.5 py-2 transition-[border-color,box-shadow,background-color] duration-300',
                empty
                  ? 'border-dashed border-[var(--stage-line-strong)] bg-transparent'
                  : 'border-[var(--tone-border)] bg-[var(--tone-surface)] text-[var(--tone-ink)]',
                active &&
                  'border-solid border-[var(--tone-solid)] shadow-[0_0_0_3px_color-mix(in_oklch,var(--tone-solid)_20%,transparent)]',
              )}
            >
              {indexLabel !== '' && (
                <span className="font-mono text-[0.62rem] leading-none text-muted-foreground">
                  {formatIndex(indexLabel, index)}
                </span>
              )}
              <div className="grid flex-1 place-items-center">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={block.label ?? '∅'}
                    initial={{ opacity: 0, scale: 0.7, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 1.2, filter: 'blur(4px)' }}
                    transition={{ duration: 0.32, ease: stageEase }}
                    className="flex flex-col items-center text-center [grid-area:1/1]"
                  >
                    <span className={cn('text-sm font-semibold leading-tight', empty && 'font-normal text-muted-foreground/60')}>
                      {block.label ?? '空'}
                    </span>
                    {block.sub && <span className="font-mono text-[0.66rem] leading-tight opacity-70">{block.sub}</span>}
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="pointer-events-none absolute -top-2 right-1.5 flex gap-1">
                <AnimatePresence>
                  {marks.map((mark) => (
                    <motion.span
                      key={`${step}-${mark.label}`}
                      data-tone={mark.tone ?? 'rose'}
                      initial={{ opacity: 0, y: 4, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={stageSpring}
                      className="rounded-full bg-[var(--tone-solid)] px-1.5 text-[0.6rem] font-semibold leading-4 whitespace-nowrap text-background"
                    >
                      {mark.label}
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
