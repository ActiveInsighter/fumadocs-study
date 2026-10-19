'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import type { Board } from 'jsxgraph';
import { DEFAULT_BOUNDING_BOX } from './model';
import type { JSXGraphBoardProps } from './types';
import styles from './jsxgraph.module.css';

/** Only import JSXGraph in an effect: its module accesses browser globals. */
export function JSXGraphBoard({ title = '交互式坐标画板', description, height = 420, boundingBox = DEFAULT_BOUNDING_BOX, axis = true, grid = true, options, onInit }: JSXGraphBoardProps) {
  const id = `jsxgraph-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const host = useRef<HTMLDivElement>(null);
  const boardRef = useRef<Board | null>(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '240px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !host.current) return;
    let cancelled = false;
    let dispose: (() => void) | void;
    let release: (() => void) | undefined;
    setStatus('loading');
    async function initialize() {
      try {
        const { default: JXG } = await import('jsxgraph');
        if (cancelled || !host.current) return;
        const foreground = dark ? '#cbd5e1' : '#475569';
        const board = JXG.JSXGraph.initBoard(id, {
          boundingbox: [...boundingBox], axis, grid, keepaspectratio: true,
          renderer: 'svg', showCopyright: false, showNavigation: false,
          pan: { enabled: true, needShift: true, needTwoFingers: true },
          zoom: { wheel: true, needShift: true },
          resize: { enabled: true, throttle: 100 },
          title, description: description ?? title,
          defaultAxes: {
            x: { strokeColor: foreground, ticks: { strokeColor: foreground, label: { strokeColor: foreground } } },
            y: { strokeColor: foreground, ticks: { strokeColor: foreground, label: { strokeColor: foreground } } },
          },
          ...options,
        });
        boardRef.current = board;
        release = () => { boardRef.current = null; JXG.JSXGraph.freeBoard(board); };
        dispose = onInit?.(board);
        setStatus('ready');
      } catch (reason) {
        release?.();
        release = undefined;
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : String(reason));
        setStatus('error');
      }
    }
    void initialize();
    return () => {
      cancelled = true;
      try { dispose?.(); } finally { release?.(); }
    };
  }, [visible, id, dark, boundingBox, axis, grid, options, onInit, attempt, title, description]);

  return (
    <figure className={`not-prose ${styles.figure}`}>
      <figcaption className={styles.caption}>
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </figcaption>
      <div className={styles.toolbar} aria-label="画板视图控制">
        <button type="button" disabled={status !== 'ready'} onClick={() => boardRef.current?.zoomIn()}>放大</button>
        <button type="button" disabled={status !== 'ready'} onClick={() => boardRef.current?.zoomOut()}>缩小</button>
        <button type="button" disabled={status !== 'ready'} onClick={() => boardRef.current?.setBoundingBox([...boundingBox], true)}>重置视图</button>
      </div>
      <div className={styles.viewport} style={{ height }}>
        <div ref={host} id={id} className={styles.board} aria-label={title} aria-busy={status === 'loading'} />
        {status === 'loading' ? <p className={styles.overlay} role="status">{visible ? '正在加载交互画板…' : '滚动到此处加载交互画板'}</p> : null}
        {status === 'error' ? <div className={styles.overlay} role="alert"><p>图像加载失败：{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>重试</button></div> : null}
      </div>
      <p className={styles.hint}>拖动彩色点可交互；Shift + 拖动平移，Shift + 滚轮缩放。触屏可双指操作，也可使用上方按钮。</p>
    </figure>
  );
}
