'use client';

import { AnimatePresence, motion } from 'motion/react';

import { cn } from '@/lib/utils';

import { stageEase } from './motion-presets';
import { useStage } from './stage-context';

/** Title and explanation of the current step, announced to screen readers. */
export function StageNarration({ className }: { className?: string }) {
  const { current, step, direction } = useStage();

  return (
    <div
      className={cn('relative min-h-[4.25rem] overflow-hidden px-4 py-3 @2xl/stage:px-5', className)}
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={{
            enter: (dir: number) => ({ opacity: 0, x: 18 * dir, filter: 'blur(3px)' }),
            center: { opacity: 1, x: 0, filter: 'blur(0px)' },
            exit: (dir: number) => ({ opacity: 0, x: -18 * dir, filter: 'blur(3px)' }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.34, ease: stageEase }}
          className="flex gap-3"
        >
          <span
            data-tone={current.tone ?? 'neutral'}
            className="mt-0.5 inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full border border-[var(--tone-border)] bg-[var(--tone-surface)] px-1.5 font-mono text-xs font-semibold tabular-nums text-[var(--tone-ink)]"
          >
            {step + 1}
          </span>
          <div className="min-w-0">
            <p className="m-0 text-[0.95rem] font-semibold leading-6 text-foreground">{current.title}</p>
            {current.description && (
              <p className="m-0 mt-0.5 text-sm leading-relaxed text-muted-foreground">{current.description}</p>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
