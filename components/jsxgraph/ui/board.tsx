'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { Download, Grid3x3, Hand, ImageDown, Maximize2, Minimize2, MousePointer2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { Board, BoardAttributes, GeometryElement, Line, Ticks } from 'jsxgraph';
import { formatNumber } from '../core/format';
import { readBoardTheme, type BoardTheme } from '../core/theme';
import type { BoundingBox } from '../plane/types';
import { cx, IconButton } from './primitives';
import styles from './jsxgraph.module.css';

export const DEFAULT_BOARD_BOX: BoundingBox = [-5, 5, 5, -5];

export interface BoardContext {
  /** Current board colours; read inside JSXGraph attribute functions. */
  theme: () => BoardTheme;
}

export interface JSXGraphBoardProps {
  title?: string;
  description?: string;
  height?: number;
  boundingBox?: BoundingBox;
  axis?: boolean;
  grid?: boolean;
  options?: Partial<BoardAttributes>;
  mode?: '2d' | '3d' | 'custom';
  /** Extra toolbar groups placed after the view controls. */
  toolbar?: ReactNode;
  /** Panels below the board, or beside it in full screen and wide layouts. */
  children?: ReactNode;
  hint?: string;
  onReset?: () => void;
  /** Supply callbacks from a client component, never across the RSC boundary. */
  onInit?: (board: Board, context: BoardContext) => void | (() => void);
}

/** Shared browser-only lifecycle, toolbar and layout for planar and spatial plots. */
export function JSXGraphBoard({
  title = '交互式坐标画板', description, height = 440,
  boundingBox = DEFAULT_BOARD_BOX, axis = true, grid = true,
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
  const [pointer, setPointer] = useState<[number, number] | null>(null);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const themeRef = useRef<BoardTheme>(readBoardTheme(null, dark));
  const planar = mode !== '3d';

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
        const theme = themeRef.current = readBoardTheme(figure.current, document.documentElement.classList.contains('dark'));
        const axisStyle = {
          strokeColor: theme.axis, strokeWidth: 1.1, highlight: false,
          ticks: { strokeColor: theme.axis, strokeOpacity: 0.6, minorTicks: 0, label: { strokeColor: theme.muted, fontSize: 11, display: 'internal', highlight: false } },
        };
        const boardOptions = {
          boundingbox: [...boundingBox], axis: planar ? axis : false,
          grid: false, keepaspectratio: true,
          renderer: 'svg', showCopyright: false, showNavigation: false, showInfobox: false,
          pan: { enabled: planar, needShift: true, needTwoFingers: true },
          zoom: { wheel: true, needShift: true },
          browserPan: planar,
          resize: { enabled: false, throttle: 100 },
          title, description: description ?? title,
          defaultAxes: { x: axisStyle, y: axisStyle },
          ...options,
        };
        // browserPan and runtime axis types are missing from 1.14's .d.ts,
        // although they are present in its documented, installed source API.
        const board = JXG.JSXGraph.initBoard(id, boardOptions as unknown as Partial<BoardAttributes>);
        boardRef.current = board;
        release = () => { boardRef.current = null; JXG.JSXGraph.freeBoard(board); };
        if (planar) board.create('grid', [], { strokeColor: theme.grid, strokeOpacity: 1, strokeWidth: 1, highlight: false, visible: grid });
        dispose = onInit?.(board, { theme: () => themeRef.current });
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
        host.current.style.touchAction = planar ? 'pan-y' : 'none';
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
  }, [visible, id, boundingBox, axis, grid, options, onInit, attempt, planar, title, description]);

  // A theme switch recolors existing elements without discarding geometry,
  // edited expressions, view position, or a 3D camera angle.
  useEffect(() => {
    const board = boardRef.current;
    if (!board || status !== 'ready') return;
    const theme = themeRef.current = readBoardTheme(figure.current, dark);
    for (const element of Object.values(board.defaultAxes ?? {}) as unknown as (Line & { defaultTicks?: Ticks })[]) {
      element.setAttribute({ strokeColor: theme.axis });
      element.defaultTicks?.setAttribute({ strokeColor: theme.axis, label: { strokeColor: theme.muted } });
    }
    for (const element of board.objectsList as GeometryElement[]) {
      if (element.elType === 'grid') element.setAttribute({ strokeColor: theme.grid, visible: showGrid });
    }
    board.fullUpdate();
  }, [dark, status, showGrid]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board || status !== 'ready' || !planar) return;
    const attr = board.attr as unknown as { pan: { enabled: boolean; needshift: boolean; needtwofingers: boolean }; browserpan: boolean };
    attr.pan = { ...attr.pan, enabled: true, needshift: !pan, needtwofingers: !pan };
    attr.browserpan = !pan;
    if (host.current) host.current.style.touchAction = pan ? 'none' : 'pan-y';
  }, [pan, status, planar]);

  // Pointer coordinates for reading the plane directly.
  useEffect(() => {
    const element = host.current;
    const board = boardRef.current;
    if (!element || !board || status !== 'ready' || !planar) return;
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const [x, y] = board.getUsrCoordsOfMouse(event);
        setPointer(Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null);
      });
    };
    const leave = () => { cancelAnimationFrame(frame); setPointer(null); };
    element.addEventListener('pointermove', move, { passive: true });
    element.addEventListener('pointerleave', leave);
    return () => { cancelAnimationFrame(frame); element.removeEventListener('pointermove', move); element.removeEventListener('pointerleave', leave); };
  }, [status, planar]);

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

  function serializeBoard(): { text: string; width: number; height: number } | null {
    const source = host.current?.querySelector('svg');
    if (!source) return null;
    const svg = source.cloneNode(true) as SVGSVGElement;
    const { width, height } = source.getBoundingClientRect();
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.style.background = themeRef.current.paper;
    svg.style.fontFamily = getComputedStyle(source).fontFamily;
    return { text: new XMLSerializer().serializeToString(svg), width, height };
  }

  function download(blob: Blob, extension: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${title.replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 60)}.${extension}`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportSvg() {
    const result = serializeBoard();
    if (result) download(new Blob([result.text], { type: 'image/svg+xml;charset=utf-8' }), 'svg');
  }

  async function exportPng() {
    const result = serializeBoard();
    if (!result) return;
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.text)}`;
    await image.decode();
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(result.width * scale);
    canvas.height = Math.round(result.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = themeRef.current.paper;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => { if (blob) download(blob, 'png'); }, 'image/png');
  }

  const ready = status === 'ready';
  return <figure ref={figure} data-plot-mode={mode} className={cx('not-prose', styles.figure, expanded && styles.expanded)}>
    <figcaption className={styles.header}>
      <div className={styles.titleRow}><span className={styles.badge}>{mode === '3d' ? '3D' : '2D'}</span><strong className={styles.title}>{title}</strong></div>
      {description ? <p className={styles.description}>{description}</p> : null}
    </figcaption>
    <div className={styles.toolbar} role="toolbar" aria-label={`${title} 工具栏`}>
      {mode === '2d' ? <div className={styles.group}>
        <IconButton label="取点" text="取点" icon={<MousePointer2 aria-hidden />} pressed={!pan} disabled={!ready} onClick={() => setPan(false)} />
        <IconButton label="平移" text="平移" icon={<Hand aria-hidden />} pressed={pan} disabled={!ready} onClick={() => setPan(true)} />
      </div> : null}
      <div className={styles.group}>
        <IconButton label="放大" icon={<ZoomIn aria-hidden />} disabled={!ready} onClick={() => boardRef.current?.zoomIn()} />
        <IconButton label="缩小" icon={<ZoomOut aria-hidden />} disabled={!ready} onClick={() => boardRef.current?.zoomOut()} />
        <IconButton label="重置视图" icon={<RotateCcw aria-hidden />} disabled={!ready} onClick={() => { boardRef.current?.setBoundingBox([...boundingBox], true); onReset?.(); }} />
        {mode === '2d' ? <IconButton label="网格" icon={<Grid3x3 aria-hidden />} pressed={showGrid} disabled={!ready} onClick={() => setShowGrid((value) => !value)} /> : null}
      </div>
      {toolbar ? <div className={styles.group}>{toolbar}</div> : null}
      <span className={styles.spacer} />
      <div className={styles.group}>
        <IconButton label="导出 SVG" icon={<Download aria-hidden />} disabled={!ready} onClick={exportSvg} />
        <IconButton label="导出 PNG" icon={<ImageDown aria-hidden />} disabled={!ready} onClick={() => void exportPng()} />
        <IconButton label={expanded ? '退出全屏' : '全屏'} icon={expanded ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />} pressed={expanded} disabled={!ready} onClick={() => void toggleFullscreen()} />
      </div>
    </div>
    <div className={styles.stage}>
      <div className={styles.viewport} style={{ '--plot-height': `${height}px` } as CSSProperties}>
        <div ref={host} id={id} data-jsxgraph-board className={styles.board} aria-label={title} aria-busy={status === 'loading'} />
        {planar && pointer ? <output className={styles.hud} aria-hidden>x {formatNumber(pointer[0], 2)} · y {formatNumber(pointer[1], 2)}</output> : null}
        {mode === '3d' && ready ? <div className={styles.axisKey} aria-hidden>
          <span style={{ color: 'var(--plot-axis-x)' }}><i />x</span><span style={{ color: 'var(--plot-axis-y)' }}><i />y</span><span style={{ color: 'var(--plot-axis-z)' }}><i />z</span>
        </div> : null}
        {status === 'loading' ? <p className={styles.overlay} role="status">{visible ? '正在准备画板…' : '滚动到此处加载画板'}</p> : null}
        {status === 'error' ? <div className={styles.overlay} role="alert"><p>无法绘制：{error}</p><button type="button" className={styles.button} onClick={() => setAttempt((value) => value + 1)}>重新加载</button></div> : null}
      </div>
      <p className={styles.hint}>{hint ?? (mode === '3d' ? '拖动画面旋转，使用视角按钮快速切换方向。' : pan ? '拖动空白处平移；滚轮缩放请按住 Shift。手机可单指平移、双指缩放。' : '拖动彩色点读取坐标；切到“平移”可直接拖动画面。按住 Shift 滚轮缩放。')}</p>
      {children ? <div className={styles.panels}>{children}</div> : null}
    </div>
  </figure>;
}
