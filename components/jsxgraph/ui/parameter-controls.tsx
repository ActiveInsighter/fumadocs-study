'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { commitParameterValue, parameterValue, startParameterAnimation } from './model';
import type { PlotParameter } from './types';
import styles from './jsxgraph.module.css';

interface ParameterControlsProps {
  parameters: PlotParameter[];
  values: Record<string, number>;
  onChange: (values: Record<string, number>) => void;
  onReset: () => void;
}

export function ParameterControls({ parameters, values, onChange, onReset }: ParameterControlsProps) {
  const [playing, setPlaying] = useState<string | null>(null);
  const playingRef = useRef(playing);
  const stopRef = useRef<(() => void) | null>(null);
  const valuesRef = useRef(values);
  const changeRef = useRef(onChange);
  function pause() {
    stopRef.current?.();
    stopRef.current = null;
    playingRef.current = null;
    setPlaying(null);
  }
  useLayoutEffect(() => {
    // External changes such as “恢复示例” must stop an animation at once.
    // Our own updates already wrote valuesRef before notifying the parent.
    if (playingRef.current && values !== valuesRef.current) pause();
    valuesRef.current = values;
    changeRef.current = onChange;
  }, [values, onChange, parameters]);

  const active = parameters.find(({ name }) => name === playing);
  const name = active?.name, min = active?.min, max = active?.max, step = active?.step;

  useEffect(() => {
    if (name === undefined || min === undefined || max === undefined) {
      if (playingRef.current) { playingRef.current = null; setPlaying(null); }
      return;
    }
    const stop = startParameterAnimation({ name, min, max, step, value: valuesRef.current[name] }, {
      getValues: () => valuesRef.current,
      onChange: (next) => { valuesRef.current = next; changeRef.current(next); },
      requestFrame: (callback) => requestAnimationFrame(callback),
      cancelFrame: (frame) => cancelAnimationFrame(frame),
      isHidden: () => document.hidden,
    });
    stopRef.current = stop;
    return () => { stop(); if (stopRef.current === stop) stopRef.current = null; };
  }, [name, min, max, step]);

  function change(name: string, value: number) {
    pause();
    const next = { ...valuesRef.current, [name]: value };
    valuesRef.current = next;
    onChange(next);
  }
  function toggle(name: string) {
    const wasPlaying = playingRef.current === name;
    pause();
    if (!wasPlaying) { playingRef.current = name; setPlaying(name); }
  }

  if (!parameters.length) return null;
  return <section className={styles.parameters} aria-label="参数控制">
    <div className={styles.sectionTitle}><strong>参数</strong><button type="button" onClick={() => { pause(); onReset(); }}>重置参数</button></div>
    {parameters.map((parameter) => <ParameterField key={parameter.name} parameter={parameter} value={values[parameter.name]} playing={playing === parameter.name} onPause={pause} onPlay={() => toggle(parameter.name)} onChange={(value) => change(parameter.name, value)} />)}
  </section>;
}

function ParameterField({ parameter, value, onChange, playing, onPlay, onPause }: { parameter: PlotParameter; value: number; onChange: (value: number) => void; playing: boolean; onPlay: () => void; onPause: () => void }) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);
  const dirty = useRef(false);
  const cancelled = useRef(false);
  const label = parameter.label ?? parameter.name;
  useEffect(() => { if (!focused.current || !dirty.current) setDraft(String(value)); }, [value]);
  function commit() {
    focused.current = false;
    dirty.current = false;
    const next = cancelled.current ? value : commitParameterValue(draft, value, parameter);
    cancelled.current = false;
    setDraft(String(next));
    if (!Object.is(next, value)) onChange(next);
  }
  return <div className={styles.parameter}>
    <label htmlFor={`${id}-range`}>{label}</label>
    <div className={styles.parameterInputs}>
      <input id={`${id}-range`} type="range" min={parameter.min} max={parameter.max} step={parameter.step ?? 0.1} value={value} onChange={(event) => onChange(parameterValue(Number(event.currentTarget.value), parameter))} />
      <input aria-label={`${label} 数值`} type="number" min={parameter.min} max={parameter.max} step={parameter.step ?? 0.1} value={draft} onFocus={() => { onPause(); focused.current = true; dirty.current = false; setDraft(String(value)); }} onChange={(event) => { dirty.current = true; setDraft(event.currentTarget.value); }} onBlur={commit} onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault();
          cancelled.current = event.key === 'Escape';
          event.currentTarget.blur();
        }
      }} />
      <button type="button" aria-label={`${playing ? '暂停' : '播放'} ${label}`} aria-pressed={playing} onClick={onPlay}>{playing ? '暂停' : '播放'}</button>
    </div>
    <span className={styles.rangeHint}>{parameter.min} 至 {parameter.max}</span>
  </div>;
}
