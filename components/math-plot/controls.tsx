'use client';

import { Pause, Play } from 'lucide-react';
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react';

import { type Palette, readPalette } from './core/palette';
import { formatNumber } from './core/sampling';
import type { ParamSpec } from './core/types';
import styles from './math-plot.module.css';
import type { TexMap } from './tex';

/** Palette read from the figure, refreshed whenever the theme class on <html> changes. */
export function usePalette(ref: RefObject<HTMLElement | null>): Palette | null {
  const [palette, setPalette] = useState<Palette | null>(null);
  useEffect(() => {
    const update = () => setPalette(readPalette(ref.current));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    return () => observer.disconnect();
  }, [ref]);
  return palette;
}

/** Slider values plus a ping-pong animation for parameters marked `animate`. */
export function useParams(params: ParamSpec[] | undefined) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries((params ?? []).map((p) => [p.name, p.value])),
  );
  const [playing, setPlaying] = useState<string | null>(null);
  const direction = useRef(1);

  useEffect(() => {
    if (!playing) return;
    const spec = params?.find((p) => p.name === playing);
    if (!spec) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last) / 1000;
      last = now;
      setValues((current) => {
        const span = spec.max - spec.min;
        let next = (current[spec.name] ?? spec.value) + direction.current * span * dt * 0.22;
        if (next >= spec.max) {
          next = spec.max;
          direction.current = -1;
        } else if (next <= spec.min) {
          next = spec.min;
          direction.current = 1;
        }
        return { ...current, [spec.name]: next };
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, params]);

  const set = useCallback((name: string, value: number) => {
    setPlaying(null);
    setValues((current) => ({ ...current, [name]: value }));
  }, []);

  return { values, set, playing, setPlaying };
}

export function ParamControls({
  params,
  values,
  onChange,
  playing,
  onPlay,
  tex,
}: {
  params: ParamSpec[];
  values: Record<string, number>;
  onChange: (name: string, value: number) => void;
  playing: string | null;
  onPlay: (name: string | null) => void;
  tex: TexMap;
}) {
  if (!params.length) return null;
  return (
    <div className={styles.params}>
      {params.map((p) => {
        const value = values[p.name] ?? p.value;
        const label = p.label ?? p.name;
        const isPlaying = playing === p.name;
        return (
          <label key={p.name} className={styles.param}>
            <span className={styles.paramName} dangerouslySetInnerHTML={{ __html: tex[label] ?? label }} />
            <input
              type="range"
              min={p.min}
              max={p.max}
              step={p.step ?? (p.max - p.min) / 200}
              value={value}
              onChange={(e) => onChange(p.name, Number(e.target.value))}
              aria-label={`参数 ${p.name}`}
            />
            <output className={styles.paramValue}>{formatNumber(value, 2)}</output>
            {p.animate ? (
              <button
                type="button"
                className={styles.iconButton}
                onClick={(e) => {
                  e.preventDefault();
                  onPlay(isPlaying ? null : p.name);
                }}
                aria-label={isPlaying ? `暂停 ${p.name}` : `播放 ${p.name}`}
                aria-pressed={isPlaying}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              </button>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}

export function ToolButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={styles.toolButton}
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
    >
      {children}
    </button>
  );
}

/** Mount children only once the element is near the viewport, and report visibility afterwards. */
export function useNearViewport(ref: RefObject<HTMLElement | null>, margin = '320px') {
  const [state, setState] = useState({ seen: false, visible: false });
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setState({ seen: true, visible: true });
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = Boolean(entry?.isIntersecting);
        setState((s) => ({ seen: s.seen || visible, visible }));
      },
      { rootMargin: `${margin} 0px ${margin} 0px` },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, margin]);
  return state;
}

export function ErrorList({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <ul className={styles.errors} role="alert">
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  );
}
