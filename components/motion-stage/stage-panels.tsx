'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef } from 'react';

import { cn } from '@/lib/utils';

import { stageEase } from './motion-presets';
import { useStage } from './stage-context';
import type { StageValue } from './types';

/** Removes the shared indentation of a template literal block. */
export function dedent(source: string | string[]): string[] {
  const lines = (Array.isArray(source) ? source.join('\n') : source).replace(/\t/g, '  ').split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const indent = Math.min(
    ...lines.filter((line) => line.trim()).map((line) => line.length - line.trimStart().length),
  );
  return lines.map((line) => line.slice(Number.isFinite(indent) ? indent : 0));
}

/**
 * Pseudo-code / source panel. The lines listed in the current step's `lines`
 * are highlighted, and the panel scrolls itself (never the page) to keep the
 * first highlighted line in view.
 */
export function StageCode({ code, title, className }: { code: string | string[]; title?: string; className?: string }) {
  const { current } = useStage();
  const lines = useMemo(() => dedent(code), [code]);
  const active = useMemo(() => new Set(current.lines ?? []), [current.lines]);
  const scroller = useRef<HTMLDivElement>(null);
  const firstActive = current.lines?.length ? Math.min(...current.lines) : undefined;

  useEffect(() => {
    const container = scroller.current;
    if (!container || firstActive === undefined) return;
    const row = container.querySelector<HTMLElement>(`[data-line="${firstActive}"]`);
    if (!row) return;
    const top = row.offsetTop - container.clientHeight / 2 + row.offsetHeight / 2;
    container.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
  }, [firstActive]);

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <PanelLabel>{title ?? '代码'}</PanelLabel>
      <div
        ref={scroller}
        className="relative max-h-80 overflow-auto rounded-[var(--ui-radius-control)] bg-[var(--ui-fill)] py-2 font-mono text-[0.76rem] leading-[1.6rem] [scrollbar-width:thin]"
      >
        {lines.map((line, index) => {
          const number = index + 1;
          const on = active.has(number);
          return (
            <div key={index} data-line={number} className="relative flex pr-3">
              <motion.span
                aria-hidden
                className="absolute inset-0 bg-[var(--stage-code-highlight)]"
                initial={false}
                animate={{ opacity: on ? 1 : 0 }}
                transition={{ duration: 0.25 }}
              />
              <motion.span
                aria-hidden
                className="absolute inset-y-0 left-0 w-[3px] origin-top bg-[var(--stage-code-marker)]"
                initial={false}
                animate={{ scaleY: on ? 1 : 0 }}
                transition={{ duration: 0.25, ease: stageEase }}
              />
              <span className="relative w-9 shrink-0 select-none pr-3 text-right tabular-nums text-muted-foreground/60">
                {number}
              </span>
              <span
                className={cn(
                  'relative whitespace-pre transition-colors duration-200',
                  on ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {line || ' '}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Watch panel for the current step's `vars`. Values that differ from the
 * previous step flash once, so the eye lands on what just changed.
 */
export function StageWatch({ className }: { className?: string }) {
  const { steps, step } = useStage();
  const keys = useMemo(() => {
    const seen = new Set<string>();
    for (const item of steps) for (const key of Object.keys(item.vars ?? {})) seen.add(key);
    return [...seen];
  }, [steps]);

  if (keys.length === 0) return null;
  const vars = steps[step]?.vars ?? {};
  const previous = step > 0 ? steps[step - 1]?.vars ?? {} : vars;

  return (
    <div className={cn('flex flex-col', className)}>
      <PanelLabel>变量</PanelLabel>
      <dl className="m-0 grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-1.5">
        {keys.map((key) => {
          const value = key in vars ? vars[key] : undefined;
          const changed = step > 0 && formatValue(previous[key]) !== formatValue(value);
          return (
            <div
              key={key}
              className="relative flex items-baseline justify-between gap-2 overflow-hidden rounded-md bg-[var(--ui-fill)] px-2.5 py-1.5"
            >
              {changed && (
                <motion.span
                  key={`${step}-${key}`}
                  aria-hidden
                  className="absolute inset-0 bg-[var(--stage-changed)]"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 1.4, ease: 'easeOut' }}
                />
              )}
              <dt className="relative font-mono text-xs text-muted-foreground">{key}</dt>
              <dd className="relative m-0 grid min-w-0 overflow-hidden font-mono text-[0.8rem] font-medium tabular-nums text-foreground">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={formatValue(value)}
                    className="truncate [grid-area:1/1]"
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -12, opacity: 0 }}
                    transition={{ duration: 0.28, ease: stageEase }}
                  >
                    {formatValue(value)}
                  </motion.span>
                </AnimatePresence>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function formatValue(value: StageValue | undefined): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 mb-1.5 text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </p>
  );
}
