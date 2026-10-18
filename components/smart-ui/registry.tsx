'use client';

import { defineRegistry, useBoundProp } from '@json-render/react';
import { cva } from 'class-variance-authority';
import { CheckIcon, CircleAlertIcon, CircleCheckIcon } from 'lucide-react';
import { useId, type CSSProperties } from 'react';
import { studyCatalog } from '@/lib/smart-ui/catalog';
import { decomposeAddress } from '@/lib/smart-ui/memory-address';
import { cn } from '@/lib/utils';

const focusRing = 'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none';

const buttonVariants = cva(
  `inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors ${focusRing}`,
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/85',
        secondary: 'border border-input bg-background text-foreground hover:bg-foreground/5',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
);

const textVariants = cva('m-0 text-[0.9375rem] leading-relaxed whitespace-pre-wrap', {
  variants: {
    tone: {
      normal: 'text-foreground',
      muted: 'text-muted-foreground',
      success: 'flex items-start gap-2.5 rounded-lg border border-foreground/15 bg-foreground/[0.04] px-3.5 py-3 text-foreground',
      warning: 'flex items-start gap-2.5 rounded-lg border border-dashed border-foreground/35 px-3.5 py-3 text-foreground',
    },
  },
  defaultVariants: { tone: 'normal' },
});

const optionClass = cn(
  'flex cursor-pointer items-start gap-3 rounded-lg border border-input px-3.5 py-3 text-[0.9375rem] leading-snug transition-colors',
  'hover:bg-foreground/[0.04] has-checked:border-foreground has-checked:bg-foreground/[0.04] has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50',
);

/** Fields are told apart by tone only, so the palette stays black and white. */
const FIELD_TONE = ['border-t-foreground', 'border-t-foreground/55', 'border-t-foreground/25'];

export const { registry } = defineRegistry(studyCatalog, {
  components: {
    Stack: ({ props, children }) => (
      <div className={cn('flex min-w-0 gap-3', props.direction === 'horizontal' ? 'flex-row flex-wrap items-center' : 'flex-col')}>
        {children}
      </div>
    ),
    Card: ({ props, children }) => (
      <section
        data-slot="smart-card"
        aria-label={props.title}
        className="min-w-0 in-data-[slot=smart-card]:rounded-lg in-data-[slot=smart-card]:border in-data-[slot=smart-card]:p-4"
      >
        <h3 className="m-0 text-lg leading-snug font-semibold tracking-tight">{props.title}</h3>
        {props.description ? <p className="mt-1 mb-0 text-sm text-muted-foreground">{props.description}</p> : null}
        <div className="mt-5 flex min-w-0 flex-col gap-4">{children}</div>
      </section>
    ),
    Text: ({ props }) => {
      const tone = props.tone ?? 'normal';
      const Icon = tone === 'success' ? CircleCheckIcon : tone === 'warning' ? CircleAlertIcon : null;
      return (
        <p data-slot="smart-text" className={textVariants({ tone })} role={Icon ? 'status' : undefined}>
          {Icon ? <Icon aria-hidden className="mt-[0.2em] size-4 shrink-0" /> : null}
          <span>{props.text}</span>
        </p>
      );
    },
    Choice: function Choice({ props, bindings }) {
      const name = useId();
      const [value, setValue] = useBoundProp<string>(props.value, bindings?.value);
      return (
        <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-[0.9375rem] font-medium">{props.label}</legend>
          {props.options.map((option) => (
            <label key={option.value} className={optionClass}>
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={() => setValue(option.value)}
                className="mt-[0.2em] size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-input bg-background outline-none transition-[border-width] checked:border-[5px] checked:border-foreground"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      );
    },
    Slider: function Slider({ props, bindings }) {
      const [value, setValue] = useBoundProp<number>(props.value, bindings?.value);
      const current = value ?? props.min;
      const percent = ((current - props.min) / (props.max - props.min)) * 100;
      return (
        <label className="grid gap-3">
          <span className="flex items-baseline justify-between gap-4 text-[0.9375rem] font-medium">
            {props.label}
            <output className="font-mono text-sm tabular-nums">{value}</output>
          </span>
          <input
            type="range"
            className="smart-ui-range"
            min={props.min}
            max={props.max}
            step={props.step ?? 1}
            value={current}
            style={{ '--smart-ui-fill': `${percent}%` } as CSSProperties}
            onChange={(event) => setValue(Number(event.target.value))}
          />
        </label>
      );
    },
    Toggle: function Toggle({ props, bindings }) {
      const [checked, setChecked] = useBoundProp<boolean>(props.checked, bindings?.checked);
      return (
        <label className={optionClass}>
          <span className="relative mt-[0.2em] inline-flex size-4 shrink-0">
            <input
              type="checkbox"
              checked={checked ?? false}
              onChange={(event) => setChecked(event.target.checked)}
              className="peer size-4 cursor-pointer appearance-none rounded-[5px] border border-input bg-background outline-none transition-colors checked:border-foreground checked:bg-foreground"
            />
            <CheckIcon aria-hidden strokeWidth={3} className="pointer-events-none absolute inset-0 m-auto size-3 text-background opacity-0 peer-checked:opacity-100" />
          </span>
          <span>{props.label}</span>
        </label>
      );
    },
    Button: ({ props, emit }) => (
      <button type="button" className={buttonVariants({ variant: props.variant })} onClick={() => emit('press')}>
        {props.label}
      </button>
    ),
    Progress: ({ props }) => {
      const completed = props.values.filter(Boolean).length;
      return (
        <label className="grid gap-2.5">
          <span className="flex items-baseline justify-between gap-4 text-[0.9375rem] font-medium">
            {props.label}
            <output className="font-mono text-sm tabular-nums">{completed} / {props.values.length}</output>
          </span>
          <progress className="smart-ui-progress" value={completed} max={props.values.length} />
        </label>
      );
    },
    MemoryAddress: ({ props }) => {
      const result = decomposeAddress(props.address, props.blockBytes, props.lines);
      return (
        <div className="grid gap-3" aria-live="polite" aria-label="Cache 地址分解结果">
          <div className="grid grid-cols-3 gap-2">
            {result.fields.map((field, index) => (
              <div key={field.label} className={cn('grid min-w-0 gap-2 rounded-lg border border-t-2 px-2 py-3 text-center', FIELD_TONE[index])}>
                <span className="text-xs text-muted-foreground">{field.label} · {field.width} 位</span>
                <code className="font-mono text-[clamp(0.75rem,2.4vw,1.125rem)] tracking-wide break-all tabular-nums">{field.bits || '无'}</code>
                <strong className="font-mono text-sm tabular-nums">{field.value}</strong>
              </div>
            ))}
          </div>
          <p className="m-0 text-sm text-muted-foreground">内存块 {result.block} 映射到 Cache 第 {result.line} 行，块内偏移 {result.offset} 字节。</p>
        </div>
      );
    },
  },
});
