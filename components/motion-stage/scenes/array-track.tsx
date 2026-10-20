'use client';

import { motion } from 'motion/react';
import { useId, useMemo } from 'react';

import { cn } from '@/lib/utils';

import { stageSpring } from '../motion-presets';
import { useStage } from '../stage-context';
import { frameAt } from '../step-match';
import type { StageTone } from '../types';

export type ArrayFrame = {
  /** Array contents on this step. Omit to keep the previous frame's values. */
  values?: (number | string)[];
  /** Indices in focus (e.g. being swapped). */
  active?: number[];
  /** Indices being compared. */
  compare?: number[];
  /** Indices already in their final place. */
  done?: number[];
  /** Indices faded out. */
  muted?: number[];
  /** Window [lo, hi] (inclusive) that is still in play; the rest fades. */
  range?: [number, number];
  /** Named pointers under the array, e.g. { i: 0, j: 3 }. Negative hides. */
  pointers?: Record<string, number>;
};

export type ArrayTrackProps = {
  /** One frame per step; the last frame holds for later steps. */
  frames: ArrayFrame[];
  variant?: 'cells' | 'bars';
  /** Show index numbers under the cells. */
  indices?: boolean;
  /** Caption above the track, e.g. "arr". */
  label?: string;
  /** Override the colours of active / compare / done. */
  tones?: Partial<Record<'active' | 'compare' | 'done', StageTone>>;
  className?: string;
};

type ResolvedFrame = Required<Pick<ArrayFrame, 'values'>> & ArrayFrame & { ids: string[] };

/**
 * Keeps element identity across frames: the k-th occurrence of a value keeps
 * the id it had in the previous frame. Swaps therefore animate as moves, and
 * overwritten values enter as new elements.
 */
function resolveFrames(frames: ArrayFrame[]): ResolvedFrame[] {
  let counter = 0;
  let previous: { values: (number | string)[]; ids: string[] } | undefined;

  return frames.map((frame) => {
    const values = frame.values ?? previous?.values ?? [];
    let ids: string[];
    if (!previous) {
      ids = values.map(() => `e${counter++}`);
    } else {
      const pool = new Map<string, string[]>();
      previous.values.forEach((value, index) => {
        const key = String(value);
        pool.set(key, [...(pool.get(key) ?? []), previous!.ids[index]]);
      });
      ids = values.map((value) => pool.get(String(value))?.shift() ?? `e${counter++}`);
    }
    previous = { values, ids };
    return { ...frame, values, ids };
  });
}

export function ArrayTrack({ frames, variant = 'cells', indices = true, label, tones, className }: ArrayTrackProps) {
  const { step } = useStage();
  const scope = useId();
  const resolved = useMemo(() => resolveFrames(frames), [frames]);
  const frame = frameAt(resolved, step);
  const max = useMemo(
    () => Math.max(1, ...resolved.flatMap((item) => item.values.map((value) => (typeof value === 'number' ? value : 0)))),
    [resolved],
  );

  if (!frame) return null;

  const toneOf = (index: number): StageTone | undefined => {
    if (frame.active?.includes(index)) return tones?.active ?? 'amber';
    if (frame.compare?.includes(index)) return tones?.compare ?? 'blue';
    if (frame.done?.includes(index)) return tones?.done ?? 'green';
    return undefined;
  };
  const isFaded = (index: number) =>
    Boolean(frame.muted?.includes(index)) || (frame.range ? index < frame.range[0] || index > frame.range[1] : false);

  const pointerSlots = frame.values.map((_, index) =>
    Object.entries(frame.pointers ?? {})
      .filter(([, at]) => at === index)
      .map(([name]) => name),
  );
  const hasPointers = Object.keys(frame.pointers ?? {}).length > 0 || resolved.some((item) => item.pointers);

  return (
    <div className={cn('mx-auto flex w-full max-w-2xl flex-col gap-2', className)}>
      {label && <p className="m-0 font-mono text-xs text-muted-foreground">{label}</p>}

      <div className={cn('flex w-full justify-center gap-1.5 @lg/stage:gap-2', variant === 'bars' && 'h-44 items-end')}>
        {frame.values.map((value, index) => {
          const id = frame.ids[index];
          const tone = toneOf(index);
          const emphasis = frame.active?.includes(index);
          const ratio = typeof value === 'number' ? Math.max(value / max, 0.08) : 0.5;
          return (
            <motion.div
              key={id}
              layout="position"
              data-tone={tone ?? 'neutral'}
              transition={stageSpring}
              animate={{ opacity: isFaded(index) ? 0.32 : 1, y: emphasis && variant === 'cells' ? -6 : 0 }}
              className={cn(
                'relative flex min-w-0 flex-1 basis-0 justify-center',
                variant === 'cells' ? 'max-w-14' : 'h-full max-w-12 items-end',
              )}
            >
              {variant === 'cells' ? (
                <div
                  className={cn(
                    'flex aspect-square w-full items-center justify-center rounded-[var(--ui-radius-control)] border font-mono text-sm font-semibold tabular-nums transition-[background-color,border-color,color,box-shadow] duration-300 @lg/stage:text-base',
                    tone
                      ? 'border-[var(--tone-solid)] bg-[var(--tone-surface)] text-[var(--tone-ink)]'
                      : 'border-[var(--stage-line)] bg-background text-foreground',
                    emphasis && 'shadow-[0_8px_18px_-10px_var(--tone-solid)]',
                  )}
                >
                  {value}
                </div>
              ) : (
                <motion.div
                  className={cn(
                    'flex w-full items-start justify-center rounded-t-md border border-b-0 pt-1 font-mono text-[0.7rem] font-semibold tabular-nums transition-[background-color,border-color,color] duration-300',
                    tone
                      ? 'border-[var(--tone-solid)] bg-[var(--tone-surface)] text-[var(--tone-ink)]'
                      : 'border-[var(--stage-line-strong)] bg-[var(--ui-fill-strong)] text-foreground',
                  )}
                  initial={false}
                  animate={{ height: `${ratio * 100}%` }}
                  transition={stageSpring}
                >
                  {value}
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {(indices || hasPointers) && (
        <div className="flex w-full justify-center gap-1.5 @lg/stage:gap-2">
          {frame.values.map((_, index) => (
            <div
              key={index}
              className={cn(
                'flex min-w-0 flex-1 basis-0 flex-col items-center gap-1',
                variant === 'cells' ? 'max-w-14' : 'max-w-12',
              )}
            >
              {indices && <span className="font-mono text-[0.65rem] tabular-nums text-muted-foreground/70">{index}</span>}
              {pointerSlots[index].map((name) => (
                <motion.span
                  key={name}
                  layoutId={`${scope}-ptr-${name}`}
                  transition={stageSpring}
                  data-tone="violet"
                  className="flex flex-col items-center font-mono text-[0.7rem] font-semibold leading-none text-[var(--tone-solid)]"
                >
                  <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden className="mb-0.5">
                    <path d="M5 0 L10 6 L0 6 Z" fill="currentColor" />
                  </svg>
                  {name}
                </motion.span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
