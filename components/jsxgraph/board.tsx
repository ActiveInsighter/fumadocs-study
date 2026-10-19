'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import type { Board, BoardAttributes, GeometryElement, Line, Ticks } from 'jsxgraph';
import { DEFAULT_BOUNDING_BOX } from './model';
import type { JSXGraphBoardProps } from './types';
import styles from './jsxgraph.module.css';

/** Shared browser-only lifecycle and controls for both planar and spatial plots. */
export function JSXGraphBoard({
  title = '交互式坐标画板', description, height = 440,
  boundingBox = DEFAULT_BOUNDING_BOX, axis = true, grid = true,
  options, onInit, mode = '2d', toolbar, children, hint, onReset,
}: JSXGraphBoardProps) {
  const id = `jsxgraph-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const host = useRef<HTMLDivElement>(null);
  const figure = useRef<HTMLElement>(null);
  const boardRef = useRef<Board | null>(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [pan, setPan] = useState(false);
  const [showGrid, setShowGrid] = useState(grid);
  const [expanded, setExpanded] = useState(false);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const darkRef = useRef(dark);
  darkRef.current = dark;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '300px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !host.current) return;
    let cancelled = false;
    let dispose: (() => void) | void;
    let release: (() => void) | undefined;
    let observer: ResizeObserver | undefined;
    let frame = 0;
    setStatus('loading');
    async function initialize() {
      try {
        const { default: JXG } = await import('jsxgraph');
        if (cancelled || !host.current) return;
        const foreground = darkRef.current ? '#cbd5e1' : '#64748b';
        const boardOptions = {
          boundingbox: [...boundingBox], axis: mode === '3d' ? false : axis,
          grid: false, keepaspectratio: true,
          renderer: 'svg', showCopyright: false, showNavigation: false,
          pan: { enabled: mode !== '3d', needShift: true, needTwoFingers: true },
          zoom: { wheel: true, needShift: true },
          browserPan: mode !== '3d',
          resize: { enabled: false, throttle: 100 },
          title, description: description ?? title,
          defaultAxes: {
            x: { strokeColor: foreground, ticks: { strokeColor: foreground, label: { strokeColor: foreground, display: 'internal' } } },
            y: { strokeColor: foreground, ticks: { strokeColor: foreground, label: { strokeColor: foreground, display: 'internal' } } },
          },
          ...options,
        };
        // browserPan and runtime axis types are missing from 1.14's .d.ts,
        // although they are present in its documented, installed source API.
        const board = JXG.JSXGraph.initBoard(id, boardOptions as unknown as Partial<BoardAttributes>);
        boardRef.current = board;
        release = () => { boardRef.current = null; JXG.JSXGraph.freeBoard(board); };
        if (mode !== '3d') board.create('grid', [], { strokeColor: darkRef.current ? '#334155' : '#e2e8f0', strokeOpacity: 0.75, visible: grid });
        dispose = onInit?.(board);
        // JSXGraph's built-in dimensions can be measured midway through layout
        // transitions. Observe the actual host and resize at the next frame.
        const resize = () => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => {
            const element = host.current;
            if (cancelled || !element || element.clientWidth === 0 || element.clientHeight === 0) return;
            if (Math.abs(board.canvasWidth - element.clientWidth) > 0.5 || Math.abs(board.canvasHeight - element.clientHeight) > 0.5) {
              board.resizeContainer(element.clientWidth, element.clientHeight, true, false);
            }
          });
        };
        if ('ResizeObserver' in window) {
          observer = new ResizeObserver(resize);
          observer.observe(host.current);
        }
        resize();
        host.current.style.touchAction = mode === '3d' ? 'none' : 'pan-y';
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
      observer?.disconnect();
      cancelAnimationFrame(frame);
      try { dispose?.(); } finally { release?.(); }
    };
  }, [visible, id, boundingBox, axis, grid, options, onInit, attempt, mode, title, description]);

  // A theme switch recolors existing elements without discarding geometry,
  // edited expressions, view position, or a 3D camera angle.
  useEffect(() => {
    const board = boardRef.current;
    if (!board || status !== 'ready') return;
    const foreground = dark ? '#cbd5e1' : '#64748b';
    for (const element of Object.values(board.defaultAxes ?? {}) as unknown as (Line & { defaultTicks?: Ticks })[]) {
      element.setAttribute({ strokeColor: foreground });
      element.defaultTicks?.setAttribute({ strokeColor: foreground, label: { strokeColor: foreground } });
    }
    for (const element of board.objectsList as GeometryElement[]) {
      if (element.elType === 'grid') element.setAttribute({ strokeColor: dark ? '#334155' : '#cbd5e1', visible: showGrid });
    }
    board.update();
  }, [dark, status, showGrid]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board || status !== 'ready' || mode === '3d') return;
    const attr = board.attr as unknown as { pan: { enabled: boolean; needshift: boolean; needtwofingers: boolean }; browserpan: boolean };
    attr.pan = { ...attr.pan, enabled: true, needshift: !pan, needtwofingers: !pan };
    attr.browserpan = !pan;
    if (host.current) host.current.style.touchAction = pan ? 'none' : 'pan-y';
  }, [pan, status, mode]);

  useEffect(() => {
    const fullscreen = () => setExpanded(document.fullscreenElement === figure.current);
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !document.fullscreenElement) setExpanded(false); };
    document.addEventListener('fullscreenchange', fullscreen);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('fullscreenchange', fullscreen); document.removeEventListener('keydown', escape); };
  }, []);

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (expanded) setExpanded(false);
    else {
      try { await figure.current?.requestFullscreen(); }
      catch { setExpanded(true); }
    }
  }

  function exportImage() {
    const source = host.current?.querySelector('svg');
    if (!source) return;
    const svg = source.cloneNode(true) as SVGSVGElement;
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.style.background = dark ? '#0f172a' : '#ffffff';
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${title.replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 60)}.svg`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <figure ref={figure} data-plot-mode={mode} className={`not-prose ${styles.figure} ${expanded ? styles.expanded : ''}`}>
    <figcaption className={styles.caption}>
      <div><span className={styles.dimension}>{mode === '3d' ? '3D' : '2D'}</span><strong>{title}</strong></div>
      {description ? <p>{description}</p> : null}
    </figcaption>
    <div className={styles.toolbar} aria-label={`${title} 工具栏`}>
      {mode === '2d' ? <><button type="button" disabled={status !== 'ready'} aria-pressed={!pan} onClick={() => setPan(false)}>取点</button><button type="button" disabled={status !== 'ready'} aria-pressed={pan} onClick={() => setPan(true)}>平移</button></> : null}
      <button type="button" aria-label="放大" disabled={status !== 'ready'} onClick={() => boardRef.current?.zoomIn()}>＋</button>
      <button type="button" aria-label="缩小" disabled={status !== 'ready'} onClick={() => boardRef.current?.zoomOut()}>−</button>
      <button type="button" disabled={status !== 'ready'} onClick={() => { boardRef.current?.setBoundingBox([...boundingBox], true); onReset?.(); }}>重置视图</button>
      {mode === '2d' ? <button type="button" disabled={status !== 'ready'} aria-pressed={showGrid} onClick={() => setShowGrid((value) => !value)}>网格</button> : null}
      {toolbar}
      <span className={styles.toolbarSpacer} />
      <button type="button" disabled={status !== 'ready'} aria-pressed={expanded} onClick={() => void toggleFullscreen()}>{expanded ? '退出全屏' : '全屏'}</button>
      <button type="button" disabled={status !== 'ready'} onClick={exportImage}>导出 SVG</button>
    </div>
    <div className={styles.viewport} style={{ '--plot-height': `${height}px` } as React.CSSProperties}>
      <div ref={host} id={id} data-jsxgraph-board className={styles.board} aria-label={title} aria-busy={status === 'loading'} />
      {status === 'loading' ? <p className={styles.overlay} role="status">{visible ? '正在准备画板…' : '滚动到此处加载画板'}</p> : null}
      {status === 'error' ? <div className={styles.overlay} role="alert"><p>无法绘制：{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>重新加载</button></div> : null}
    </div>
    <p className={styles.hint}>{hint ?? (mode === '3d' ? '拖动画面旋转，使用视角按钮快速切换方向。' : pan ? '拖动空白处平移；滚轮缩放请按住 Shift。手机可单指平移、双指缩放。' : '拖动彩色点取坐标；切到“平移”可直接拖动画面。手机在取点模式下可上下滚动页面。')}</p>
    {children}
  </figure>;
}
