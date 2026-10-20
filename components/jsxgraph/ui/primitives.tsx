'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './jsxgraph.module.css';

export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

interface IconButtonProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  /** Show the label beside the icon on wider boards. */
  text?: string;
}

export function IconButton({ label, icon, onClick, pressed, disabled, text }: IconButtonProps) {
  return <button type="button" className={styles.iconButton} aria-label={label} title={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
    {icon}{text ? <span className={styles.toolLabel}>{text}</span> : null}
  </button>;
}

interface SectionProps {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  label?: string;
}

/** A collapsible panel; actions stay outside the toggle so they remain clickable. */
export function Section({ title, meta, actions, defaultOpen = true, children, label }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return <section className={styles.section} aria-label={label ?? title}>
    <div className={styles.sectionHeader}>
      <button type="button" className={styles.sectionToggle} aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}>
        <ChevronDown aria-hidden />{title}{meta ? <span className={styles.sectionMeta}>{meta}</span> : null}
      </button>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
    <div id={id} className={styles.sectionBody} hidden={!open}>{children}</div>
  </section>;
}

export function Switch({ checked, onChange, children, disabled }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return <label className={styles.switch}><input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.currentTarget.checked)} /><span>{children}</span></label>;
}

export function Segmented<T extends string>({ label, value, options, onChange, disabled }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; disabled?: boolean }) {
  return <div className={styles.segmented} role="group" aria-label={label}>
    {options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} disabled={disabled} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  disabled?: boolean;
}

export function Slider({ label, value, min, max, step, onChange, format = String, disabled }: SliderProps) {
  const id = useId();
  return <div className={styles.slider}>
    <span id={id}>{label}</span>
    <input type="range" aria-labelledby={id} min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.currentTarget.value))} />
    <output>{format(value)}</output>
  </div>;
}

/**
 * Number entry that commits on Enter or blur. Escape, empty and invalid
 * drafts restore the current value instead of moving the plot.
 */
export function NumberInput({ label, value, onCommit, min, max, step = 'any', digits = 4, className }: { label: string; value: number; onCommit: (value: number) => void; min?: number; max?: number; step?: number | 'any'; digits?: number; className?: string }) {
  const shown = Number.isFinite(value) ? String(Number(value.toFixed(digits))) : '';
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  function commit() {
    const text = cancelled.current ? null : draft;
    cancelled.current = false;
    setDraft(null);
    const next = text?.trim() ? Number(text) : NaN;
    if (!Number.isFinite(next)) return;
    const bounded = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, next));
    if (bounded !== value) onCommit(bounded);
  }
  return <input aria-label={label} className={cx(styles.input, styles.mono, className)} type="number" inputMode="decimal" min={min} max={max} step={step}
    value={draft ?? shown}
    onFocus={() => setDraft(shown)}
    onChange={(event) => setDraft(event.currentTarget.value)}
    onBlur={commit}
    onKeyDown={(event) => {
      if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
      if (event.key === 'Escape') { cancelled.current = true; event.currentTarget.blur(); }
    }} />;
}
