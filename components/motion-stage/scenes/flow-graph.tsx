'use client';

import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

import { cn } from '@/lib/utils';

import { stageSpring, TRAVEL_SECONDS } from '../motion-presets';
import { useStage } from '../stage-context';
import { frameAt } from '../step-match';
import type { StageTone } from '../types';
import { useElementSize } from '../use-element-size';

export type FlowNode = {
  id: string;
  label: string;
  sub?: string;
  /** Centre position in percent of the canvas (0–100). */
  x: number;
  y: number;
  tone?: StageTone;
  shape?: 'box' | 'pill' | 'circle' | 'diamond';
};

export type FlowEdge = {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
  /** Bend in px; positive bends to the left of the direction of travel. */
  curve?: number;
};

export type FlowFrame = {
  /** Nodes in focus. */
  active?: string[];
  /** Nodes already visited. */
  done?: string[];
  /** Nodes faded out. */
  muted?: string[];
  /** Edges being travelled on this step, written "from->to". */
  edges?: string[];
};

export type FlowGraphProps = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** One frame per step; the last frame holds. */
  frames?: FlowFrame[];
  /** Canvas height in px. */
  height?: number;
  /**
   * Narrowest layout width (px). Below it the graph scales down (to at most
   * MIN_SCALE) and then scrolls sideways, following the focused node.
   */
  minWidth?: number;
  className?: string;
};

/** Smallest zoom before the graph scrolls instead; keeps labels legible. */
const MIN_SCALE = 0.72;
/** Width of the fade that hints at more graph beyond a scroll edge. */
const FADE = 28;

type Point = { x: number; y: number };
type Size = { w: number; h: number };

const quad = (a: Point, c: Point, b: Point, t: number): Point => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
});

/** Where the ray from a node centre towards `toward` leaves the node outline. */
function exitPoint(center: Point, size: Size, toward: Point, shape: FlowNode['shape'], gap = 5): Point {
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const hw = size.w / 2 + gap;
  const hh = size.h / 2 + gap;
  let distance: number;
  if (shape === 'circle') distance = Math.max(hw, hh);
  else if (shape === 'diamond') distance = 1 / (Math.abs(ux) / hw + Math.abs(uy) / hh);
  else
    distance = Math.min(
      Math.abs(ux) > 1e-6 ? hw / Math.abs(ux) : Infinity,
      Math.abs(uy) > 1e-6 ? hh / Math.abs(uy) : Infinity,
    );
  return { x: center.x + ux * distance, y: center.y + uy * distance };
}

/**
 * Nodes placed by percentage with arrows between them. Each frame lights up
 * nodes and sends a packet along the edges taken on that step.
 */
export function FlowGraph({ nodes, edges, frames = [], height = 300, minWidth = 0, className }: FlowGraphProps) {
  const { step, speed, epoch } = useStage();
  const measure = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const { width: available } = useElementSize(measure);
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  const [scrollEdges, setEdges] = useState({ start: true, end: true });

  // Lay out at `width` (never below minWidth), then zoom to fit what is left.
  const width = Math.max(available, minWidth);
  const scale = available > 0 && available < width ? Math.max(available / width, MIN_SCALE) : 1;
  const frame = frameAt(frames, step) ?? {};
  const travel = TRAVEL_SECONDS / speed;

  useLayoutEffect(() => {
    const next: Record<string, Size> = {};
    nodeRefs.current.forEach((node, id) => {
      next[id] = { w: node.offsetWidth, h: node.offsetHeight };
    });
    setSizes((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
  }, [width, nodes]);

  const centerOf = (node: FlowNode): Point => ({ x: (node.x / 100) * width, y: (node.y / 100) * height });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const activeEdges = new Set(frame.edges ?? []);

  const stateOf = (id: string) =>
    frame.active?.includes(id)
      ? 'active'
      : frame.done?.includes(id)
        ? 'done'
        : frame.muted?.includes(id)
          ? 'muted'
          : 'idle';

  const ready = available > 0 && Object.keys(sizes).length === nodes.length;
  const focus = frame.active?.[0];

  const updateEdges = () => {
    const container = scroller.current;
    if (!container) return;
    const start = container.scrollLeft <= 1;
    const end = container.scrollLeft + container.clientWidth >= container.scrollWidth - 1;
    setEdges((previous) => (previous.start === start && previous.end === end ? previous : { start, end }));
  };

  // When the graph scrolls sideways, keep the focused node in view.
  useEffect(() => {
    const container = scroller.current;
    const node = focus ? byId.get(focus) : undefined;
    updateEdges();
    if (!container || !node || container.scrollWidth <= container.clientWidth) return;
    const left = (node.x / 100) * container.scrollWidth - container.clientWidth / 2;
    container.scrollTo({ left: Math.max(left, 0), behavior: 'smooth' });
    // byId is rebuilt every render; the focused id and the zoom are the real triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, scale, available]);

  const fade =
    scrollEdges.start && scrollEdges.end
      ? undefined
      : `linear-gradient(to right, ${scrollEdges.start ? '#000' : 'transparent'}, #000 ${FADE}px, #000 calc(100% - ${FADE}px), ${scrollEdges.end ? '#000' : 'transparent'})`;
  const scrollerStyle: CSSProperties | undefined = fade ? { maskImage: fade, WebkitMaskImage: fade } : undefined;

  return (
    <div
      ref={scroller}
      onScroll={updateEdges}
      style={scrollerStyle}
      className={cn(
        '-mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 [scrollbar-width:none] @2xl/stage:-mx-6 @2xl/stage:w-[calc(100%+3rem)] @2xl/stage:px-6',
        className,
      )}
    >
      <div ref={measure} aria-hidden className="h-0 w-full" />
      <div
        className="relative"
        style={available > 0 ? { width: width * scale, height: height * scale } : { height, minWidth }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left select-none"
          style={available > 0 ? { width, height, transform: scale < 1 ? `scale(${scale})` : undefined } : { width: '100%', height }}
        >
          {ready && (
            <svg className="absolute inset-0" width={width} height={height} aria-hidden>
              {edges.map((edge) => {
                const from = byId.get(edge.from);
                const to = byId.get(edge.to);
                if (!from || !to) return null;
                const a = centerOf(from);
                const b = centerOf(to);
                const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
                const bend = edge.curve ?? 0;
                const control = { x: mid.x + (-(b.y - a.y) / length) * bend, y: mid.y + ((b.x - a.x) / length) * bend };
                const start = exitPoint(a, sizes[from.id], control, from.shape);
                const end = exitPoint(b, sizes[to.id], control, to.shape, 7);
                const key = `${edge.from}->${edge.to}`;
                const live = activeEdges.has(key);
                const angle = Math.atan2(end.y - control.y, end.x - control.x);
                const head = 8;
                const headPoints = [
                  [end.x, end.y],
                  [end.x - head * Math.cos(angle - 0.42), end.y - head * Math.sin(angle - 0.42)],
                  [end.x - head * Math.cos(angle + 0.42), end.y - head * Math.sin(angle + 0.42)],
                ]
                  .map((point) => point.join(','))
                  .join(' ');
                const path = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
                const samples = Array.from({ length: 13 }, (_, index) => quad(start, control, end, index / 12));
                const labelPoint = quad(start, control, end, 0.5);
                const tone = to.tone ?? 'neutral';
                return (
                  <g key={key} data-tone={tone}>
                    <path
                      d={path}
                      fill="none"
                      stroke={live ? 'var(--tone-solid)' : 'var(--stage-line-strong)'}
                      strokeWidth={live ? 2 : 1.4}
                      strokeDasharray={edge.dashed ? '5 5' : undefined}
                      className="transition-[stroke,stroke-width] duration-300"
                    />
                    {live && (
                      <motion.path
                        key={`flow-${epoch}`}
                        d={path}
                        fill="none"
                        stroke="var(--tone-solid)"
                        strokeWidth={6}
                        strokeLinecap="round"
                        opacity={0.18}
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: travel, ease: 'easeInOut' }}
                      />
                    )}
                    <polygon
                      points={headPoints}
                      fill={live ? 'var(--tone-solid)' : 'var(--stage-line-strong)'}
                      className="transition-[fill] duration-300"
                    />
                    {live && (
                      <motion.circle
                        key={`packet-${epoch}`}
                        r={4.5}
                        fill="var(--tone-solid)"
                        stroke="var(--background)"
                        strokeWidth={2}
                        initial={{ cx: start.x, cy: start.y, opacity: 1 }}
                        animate={{
                          cx: samples.map((point) => point.x),
                          cy: samples.map((point) => point.y),
                          opacity: [1, 1, 0],
                        }}
                        transition={{
                          cx: { duration: travel, ease: 'easeInOut' },
                          cy: { duration: travel, ease: 'easeInOut' },
                          opacity: { duration: travel + 0.2, times: [0, 0.85, 1] },
                        }}
                      />
                    )}
                    {edge.label && (
                      <foreignObject
                        x={labelPoint.x - 60}
                        y={labelPoint.y - 11}
                        width={120}
                        height={22}
                        className="overflow-visible"
                      >
                        <div className="flex h-full items-center justify-center">
                          <span
                            className={cn(
                              'rounded bg-background px-1 text-[0.68rem] leading-4 whitespace-nowrap transition-colors duration-300',
                              live ? 'font-medium text-foreground' : 'text-muted-foreground',
                            )}
                          >
                            {edge.label}
                          </span>
                        </div>
                      </foreignObject>
                    )}
                  </g>
                );
              })}
            </svg>
          )}

          {nodes.map((node) => {
            const state = stateOf(node.id);
            const shape = node.shape ?? 'box';
            return (
              <div
                key={node.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
              >
                <motion.div
                  ref={(element) => {
                    if (element) nodeRefs.current.set(node.id, element);
                    else nodeRefs.current.delete(node.id);
                  }}
                  data-tone={node.tone ?? 'neutral'}
                  initial={false}
                  animate={{
                    scale: state === 'active' ? 1.06 : 1,
                    opacity: state === 'muted' ? 0.35 : 1,
                  }}
                  transition={stageSpring}
                  className={cn(
                    'relative flex max-w-36 flex-col items-center justify-center border text-center transition-[border-color,box-shadow,background-color] duration-300',
                    shape === 'box' && 'rounded-[var(--ui-radius-control)] px-3 py-1.5',
                    shape === 'pill' && 'rounded-full px-4 py-1.5',
                    shape === 'circle' && 'size-14 rounded-full p-1',
                    shape === 'diamond' && 'size-[4.5rem] p-2',
                    shape !== 'diamond' && 'bg-[var(--tone-surface)]',
                    shape === 'diamond'
                      ? 'border-transparent'
                      : state === 'active'
                        ? 'border-[var(--tone-solid)]'
                        : 'border-[var(--tone-border)]',
                    state === 'active' &&
                      shape !== 'diamond' &&
                      'shadow-[0_0_0_3px_color-mix(in_oklch,var(--tone-solid)_22%,transparent),0_10px_24px_-12px_var(--tone-solid)]',
                  )}
                >
                  {shape === 'diamond' && (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute inset-[11%] rotate-45 rounded-md border bg-[var(--tone-surface)] transition-[border-color,box-shadow] duration-300',
                        state === 'active'
                          ? 'border-[var(--tone-solid)] shadow-[0_0_0_3px_color-mix(in_oklch,var(--tone-solid)_22%,transparent)]'
                          : 'border-[var(--tone-border)]',
                      )}
                    />
                  )}
                  <span className="relative text-[0.8rem] font-semibold leading-tight whitespace-nowrap text-[var(--tone-ink)]">
                    {node.label}
                  </span>
                  {node.sub && (
                    <span className="relative font-mono text-[0.62rem] leading-tight whitespace-nowrap text-[var(--tone-ink)] opacity-70">
                      {node.sub}
                    </span>
                  )}
                  {state === 'done' && (
                    <motion.span
                      aria-hidden
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ ...stageSpring, delay: 0.05 }}
                      className={cn(
                        'absolute grid size-4 place-items-center rounded-full bg-[var(--tone-solid)] text-background ring-2 ring-[var(--stage-canvas)]',
                        shape === 'diamond' ? 'top-[3%] left-[calc(50%-0.5rem)]' : '-top-1.5 -right-1.5',
                      )}
                    >
                      <Check className="size-2.5" strokeWidth={3.5} />
                    </motion.span>
                  )}
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
