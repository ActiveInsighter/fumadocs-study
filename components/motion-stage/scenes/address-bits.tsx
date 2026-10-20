'use client';

import { AnimatePresence, motion } from 'motion/react';

import { cn } from '@/lib/utils';

import { stageEase, stageSpring } from '../motion-presets';
import { useStage } from '../stage-context';
import { matchesStep } from '../step-match';
import type { StageTone, StepMatch } from '../types';

export type AddressField = {
  /** Field name, e.g. 页号 / 页内偏移 / 段号. */
  label: string;
  /** Binary digits; spaces are ignored. */
  bits: string;
  tone?: StageTone;
  /** Decoded value shown under the field, e.g. "= 2". */
  value?: string;
  /** Steps on which this field is emphasised. */
  activeAt?: StepMatch;
};

export type AddressBitsProps = {
  fields: AddressField[];
  /** Caption, e.g. "逻辑地址 (16 位)". */
  label?: string;
  /** Steps on which the address is shown split into fields (default: always). */
  splitAt?: StepMatch;
  className?: string;
};

/**
 * A binary address that splits into coloured fields — page number + offset,
 * segment + offset, tag + index + block offset.
 */
export function AddressBits({ fields, label, splitAt, className }: AddressBitsProps) {
  const { step } = useStage();
  const split = matchesStep(step, splitAt);
  let bitIndex = 0;
  const total = fields.reduce((sum, field) => sum + field.bits.replace(/\s+/g, '').length, 0);

  return (
    <div className={cn('mx-auto flex w-full max-w-xl flex-col gap-2', className)}>
      {label && (
        <div className="flex items-baseline justify-between gap-2">
          <p className="m-0 text-xs font-medium text-muted-foreground">{label}</p>
          <p className="m-0 font-mono text-[0.65rem] text-muted-foreground/70">{total} bit</p>
        </div>
      )}
      <motion.div layout className={cn('flex w-full items-start', split ? 'gap-2.5' : 'gap-0')} transition={stageSpring}>
        {fields.map((field, fieldIndex) => {
          const bits = field.bits.replace(/\s+/g, '').split('');
          const active = field.activeAt !== undefined && matchesStep(step, field.activeAt);
          const tone = split ? field.tone ?? 'neutral' : 'neutral';
          return (
            <motion.div
              key={fieldIndex}
              layout
              transition={stageSpring}
              data-tone={tone}
              className="flex min-w-0 flex-col items-stretch gap-1.5"
              style={{ flexGrow: bits.length, flexBasis: 0 }}
            >
              <motion.div
                layout
                transition={stageSpring}
                className={cn(
                  'flex overflow-hidden border font-mono text-xs font-semibold tabular-nums transition-[border-color,background-color,box-shadow] duration-300 @lg/stage:text-sm',
                  split ? 'rounded-[var(--ui-radius-control)]' : cn(
                    fieldIndex === 0 && 'rounded-l-[var(--ui-radius-control)]',
                    fieldIndex === fields.length - 1 && 'rounded-r-[var(--ui-radius-control)]',
                    fieldIndex > 0 && 'border-l-0',
                  ),
                  'border-[var(--tone-border)] bg-[var(--tone-surface)] text-[var(--tone-ink)]',
                  active && 'border-[var(--tone-solid)] shadow-[0_0_0_3px_color-mix(in_oklch,var(--tone-solid)_22%,transparent)]',
                )}
              >
                {bits.map((bit, index) => {
                  const order = bitIndex++;
                  return (
                    <motion.span
                      key={index}
                      className={cn(
                        'flex h-9 min-w-0 flex-1 items-center justify-center',
                        index > 0 && 'border-l border-[color-mix(in_oklch,var(--tone-border)_70%,transparent)]',
                      )}
                      initial={false}
                      animate={{ y: active ? [0, -3, 0] : 0 }}
                      transition={{ duration: 0.4, delay: active ? order * 0.015 : 0 }}
                    >
                      {bit}
                    </motion.span>
                  );
                })}
              </motion.div>
              <AnimatePresence initial={false}>
                {split && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.3, ease: stageEase, delay: 0.12 }}
                    className="flex flex-col items-center gap-0.5 text-center"
                  >
                    <span className="h-1.5 w-full rounded-b-sm border-x border-b border-[var(--tone-solid)] opacity-60" />
                    <span className="text-xs font-semibold text-[var(--tone-ink)] dark:text-[var(--tone-solid)]">{field.label}</span>
                    {field.value && <span className="font-mono text-[0.68rem] text-muted-foreground">{field.value}</span>}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
