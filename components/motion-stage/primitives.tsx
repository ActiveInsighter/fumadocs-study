'use client';

import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { revealVariants, stageEase, stageFade, stageSpring, type RevealEffect } from './motion-presets';
import { useStage } from './stage-context';
import { frameAt, matchesStep } from './step-match';
import type { StageTone, StepMatch } from './types';

/* ------------------------------------------------------------------------ */
/* StageReveal                                                              */
/* ------------------------------------------------------------------------ */

export type StageRevealProps = {
  /** Steps on which the content is shown (see StepMatch). */
  at?: StepMatch;
  effect?: RevealEffect;
  /** Seconds to wait after the step starts. */
  delay?: number;
  /**
   * What happens off-step: `unmount` removes it (layout reflows), `hold` keeps
   * its space invisible (no layout jump), `dim` keeps it visible but faded.
   */
  inactive?: 'unmount' | 'hold' | 'dim';
  inline?: boolean;
  className?: string;
  children: ReactNode;
};

/** Shows its children only on the matching steps, with an enter/exit effect. */
export function StageReveal({
  at,
  effect = 'rise',
  delay = 0,
  inactive = 'unmount',
  inline = false,
  className,
  children,
}: StageRevealProps) {
  const { step, direction } = useStage();
  const shown = matchesStep(step, at);
  const Component = inline ? motion.span : motion.div;
  const variants = revealVariants[effect];
  const transition = { ...stageFade, delay: shown ? delay : 0 };

  if (inactive === 'unmount') {
    return (
      <AnimatePresence initial={false} custom={direction}>
        {shown && (
          <Component
            className={className}
            custom={direction}
            variants={variants}
            initial="hidden"
            animate="shown"
            exit="hidden"
            transition={transition}
          >
            {children}
          </Component>
        )}
      </AnimatePresence>
    );
  }

  return (
    <Component
      className={cn(inactive === 'hold' && !shown && 'pointer-events-none', className)}
      custom={direction}
      variants={variants}
      initial={false}
      animate={shown ? 'shown' : inactive === 'dim' ? { opacity: 0.28, filter: 'saturate(0.3)' } : 'hidden'}
      transition={transition}
      aria-hidden={inactive === 'hold' && !shown ? true : undefined}
    >
      {children}
    </Component>
  );
}

/* ------------------------------------------------------------------------ */
/* StageSwitch / StageCase                                                  */
/* ------------------------------------------------------------------------ */

/**
 * Stacks its StageCase children in one grid cell, so swapping cases
 * cross-fades in place and the box keeps the size of the largest case.
 */
export function StageSwitch({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('grid [&>*]:[grid-area:1/1]', className)}>{children}</div>;
}

export function StageCase({
  at,
  effect = 'slide',
  className,
  children,
}: {
  at?: StepMatch;
  effect?: RevealEffect;
  className?: string;
  children: ReactNode;
}) {
  return (
    <StageReveal at={at} effect={effect} inactive="hold" className={className}>
      {children}
    </StageReveal>
  );
}

/* ------------------------------------------------------------------------ */
/* StageText                                                                */
/* ------------------------------------------------------------------------ */

/**
 * Inline text that changes per step (frame semantics: the last value holds).
 * Each change rolls the old value out and the new one in.
 */
export function StageText({ values, className }: { values: (string | number)[]; className?: string }) {
  const { step, direction } = useStage();
  const value = String(frameAt(values, step) ?? '');

  return (
    <span className={cn('relative inline-grid overflow-hidden align-bottom', className)}>
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.span
          key={value}
          custom={direction}
          className="[grid-area:1/1]"
          variants={{
            enter: (dir: number) => ({ y: `${70 * dir}%`, opacity: 0 }),
            center: { y: '0%', opacity: 1 },
            exit: (dir: number) => ({ y: `${-70 * dir}%`, opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3, ease: stageEase }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/* StageBadge                                                               */
/* ------------------------------------------------------------------------ */

export function StageBadge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: StageTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      data-tone={tone}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-[var(--tone-border)] bg-[var(--tone-surface)] px-2 py-0.5 text-xs font-medium leading-5 whitespace-nowrap text-[var(--tone-ink)]',
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/* StageNode                                                                */
/* ------------------------------------------------------------------------ */

export type StageNodeState = 'idle' | 'active' | 'done' | 'muted';

export type StageNodeProps = {
  label?: ReactNode;
  /** Secondary line under the label, e.g. an address or a size. */
  sub?: ReactNode;
  tone?: StageTone;
  /** Force a state; otherwise derived from the *At props below. */
  state?: StageNodeState;
  activeAt?: StepMatch;
  doneAt?: StepMatch;
  mutedAt?: StepMatch;
  /** Steps on which the node exists at all (default: every step). */
  at?: StepMatch;
  shape?: 'box' | 'pill' | 'circle';
  /**
   * Shared-layout id: two nodes with the same id on different steps morph
   * into each other (scoped to this stage).
   */
  layoutId?: string;
  className?: string;
  children?: ReactNode;
};

/** Resolves a node state from step gating props. Active wins over done/muted. */
export function useNodeState({
  state,
  activeAt,
  doneAt,
  mutedAt,
}: Pick<StageNodeProps, 'state' | 'activeAt' | 'doneAt' | 'mutedAt'>): StageNodeState {
  const { step } = useStage();
  if (state) return state;
  if (activeAt !== undefined && matchesStep(step, activeAt)) return 'active';
  if (doneAt !== undefined && matchesStep(step, doneAt)) return 'done';
  if (mutedAt !== undefined && matchesStep(step, mutedAt)) return 'muted';
  return 'idle';
}

/**
 * The basic block of every scene: a toned box that can be idle, active
 * (lifted with a ring), done or muted, and can morph via layoutId.
 */
export function StageNode({
  label,
  sub,
  tone = 'neutral',
  state,
  activeAt,
  doneAt,
  mutedAt,
  at,
  shape = 'box',
  layoutId,
  className,
  children,
}: StageNodeProps) {
  const { step } = useStage();
  const resolved = useNodeState({ state, activeAt, doneAt, mutedAt });
  const present = matchesStep(step, at);

  return (
    <AnimatePresence initial={false}>
      {present && (
        <motion.div
          layout
          layoutId={layoutId}
          data-tone={tone}
          data-state={resolved}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{
            opacity: resolved === 'muted' ? 0.4 : 1,
            scale: resolved === 'active' ? 1.04 : 1,
            y: resolved === 'active' ? -2 : 0,
          }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={stageSpring}
          className={cn(
            'relative flex min-w-0 flex-col items-center justify-center gap-0.5 border bg-[var(--tone-surface)] px-3 py-2 text-center text-[var(--tone-ink)] transition-[border-color,box-shadow] duration-300',
            shape === 'box' && 'rounded-[var(--ui-radius-control)]',
            shape === 'pill' && 'rounded-full px-4',
            shape === 'circle' && 'aspect-square rounded-full p-2',
            resolved === 'active'
              ? 'border-[var(--tone-solid)] shadow-[0_0_0_3px_color-mix(in_oklch,var(--tone-solid)_22%,transparent),0_8px_20px_-10px_color-mix(in_oklch,var(--tone-solid)_70%,transparent)]'
              : 'border-[var(--tone-border)]',
            resolved === 'muted' && 'saturate-[0.3]',
            className,
          )}
        >
          {label !== undefined && <span className="text-sm font-semibold leading-tight">{label}</span>}
          {sub !== undefined && (
            <span className="font-mono text-[0.7rem] leading-tight opacity-70">{sub}</span>
          )}
          {children}
          {resolved === 'done' && (
            <motion.span
              aria-hidden
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={stageSpring}
              className="absolute -top-1.5 -right-1.5 size-3 rounded-full border-2 border-background bg-[var(--tone-solid)]"
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
