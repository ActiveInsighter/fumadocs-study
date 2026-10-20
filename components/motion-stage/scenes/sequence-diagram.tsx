'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useId, useMemo, useRef } from 'react';

import { cn } from '@/lib/utils';

import { stageEase, stageSpring, TRAVEL_SECONDS } from '../motion-presets';
import { useStage } from '../stage-context';
import type { StageTone } from '../types';
import { useElementSize } from '../use-element-size';

export type SequenceActor = {
  id: string;
  label: string;
  /** Small line under the label, e.g. an address or a role. */
  caption?: string;
  tone?: StageTone;
};

export type SequenceMessage = {
  from: string;
  to: string;
  /** Text above the arrow, e.g. "SYN=1, seq=x". */
  label: string;
  /** Muted text under the arrow. */
  detail?: string;
  /** Step on which the message is sent. Several messages may share a step. */
  at: number;
  tone?: StageTone;
  /** The packet is dropped half way (retransmission demos). */
  lost?: boolean;
  dashed?: boolean;
};

export type SequenceState = {
  actor: string;
  /** Step from which the actor is in this state. */
  at: number;
  label: string;
  tone?: StageTone;
};

export type SequenceDiagramProps = {
  actors: SequenceActor[];
  messages: SequenceMessage[];
  /** State changes per actor (e.g. TCP states). Shown in the header and beside the lifeline. */
  states?: SequenceState[];
  /** Height of one message row in px. */
  rowHeight?: number;
  className?: string;
};

const BODY_PADDING = 18;

/**
 * Lifelines with messages travelling between actors, one row per message.
 * The message of the current step draws itself while a packet travels along
 * it; earlier messages stay as a quiet trace, later ones are not sent yet.
 */
export function SequenceDiagram({
  actors,
  messages,
  states = [],
  rowHeight: baseRowHeight = 68,
  className,
}: SequenceDiagramProps) {
  const { step, speed } = useStage();
  const body = useRef<HTMLDivElement>(null);
  const scope = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const { width } = useElementSize(body);
  const travel = TRAVEL_SECONDS / speed;

  // State marks sit outside the first and last lifelines, so the gutter must
  // fit the widest one (mono text: ~0.62em per Latin char, ~1em per CJK char).
  const stateGutter = useMemo(() => {
    const em = width >= 512 ? 10.9 : 9.9;
    const widest = Math.max(
      0,
      ...states.map((state) =>
        Array.from(state.label).reduce((sum, char) => sum + (char.charCodeAt(0) > 0x2e7f ? em : em * 0.62), 0),
      ),
    );
    return widest + 24;
  }, [states, width]);

  const lanes = useMemo(() => {
    const count = actors.length;
    const gutter = states.length
      ? Math.min(Math.max(width * 0.2, stateGutter, 70), Math.max(width * 0.3, 70), 140)
      : Math.max(width * 0.12, 44);
    const span = Math.max(width - gutter * 2, 0);
    return new Map(
      actors.map((actor, index) => [actor.id, count === 1 ? width / 2 : gutter + (span * index) / (count - 1)]),
    );
  }, [actors, stateGutter, states.length, width]);

  // Narrow lanes wrap long labels; give every row room for the tallest label
  // (mono ~0.6em per char, plus slack because balanced wrapping breaks early).
  const labelLines = Math.max(
    1,
    ...messages.map((message) => {
      const span = Math.abs((lanes.get(message.to) ?? 0) - (lanes.get(message.from) ?? 0));
      const room = Math.max(span - 16, 80) - 12;
      const text = message.label.length * (width >= 512 ? 12 : 10.9) * 0.6 * 1.12;
      return Math.ceil(text / room);
    }),
  );
  const rowHeight = width > 0 ? baseRowHeight + (labelLines - 1) * 16 : baseRowHeight;

  const rows = messages.map((message, index) => {
    const top = BODY_PADDING + index * rowHeight;
    const x1 = lanes.get(message.from) ?? 0;
    const x2 = lanes.get(message.to) ?? 0;
    const y1 = top + rowHeight * 0.38;
    const y2 = y1 + rowHeight * 0.3;
    return { message, index, x1, x2, y1, y2 };
  });

  const height = BODY_PADDING * 2 + messages.length * rowHeight;

  const stateMarks = states.map((state, index) => {
    const row = rows.find(
      (candidate) =>
        candidate.message.at === state.at &&
        (candidate.message.from === state.actor || candidate.message.to === state.actor),
    );
    const y = row
      ? row.message.from === state.actor
        ? row.y1
        : row.y2
      : BODY_PADDING + rows.filter((candidate) => candidate.message.at < state.at).length * rowHeight;
    return { ...state, index, y };
  });

  const currentState = (actorId: string) => {
    let latest: SequenceState | undefined;
    for (const state of states) {
      if (state.actor === actorId && state.at <= step && (!latest || state.at >= latest.at)) latest = state;
    }
    return latest;
  };

  const edgeIndex = (actorId: string) => {
    const index = actors.findIndex((actor) => actor.id === actorId);
    return index === 0 ? 'start' : index === actors.length - 1 ? 'end' : 'middle';
  };

  return (
    <div className={cn('w-full select-none', className)}>
      {/* Actor headers, centred on their lanes. */}
      <div className="relative h-[4.5rem]">
        {width > 0 &&
          actors.map((actor) => {
            const state = currentState(actor.id);
            return (
              <div
                key={actor.id}
                data-tone={actor.tone ?? 'neutral'}
                className="absolute top-0 flex w-max max-w-[44%] -translate-x-1/2 flex-col items-center gap-1"
                style={{ left: lanes.get(actor.id) }}
              >
                <div className="rounded-[var(--ui-radius-control)] border border-[var(--tone-border)] bg-[var(--tone-surface)] px-3 py-1.5 text-center text-[var(--tone-ink)]">
                  <p className="m-0 text-sm font-semibold leading-tight">{actor.label}</p>
                  {actor.caption && (
                    <p className="m-0 font-mono text-[0.68rem] leading-tight opacity-70">{actor.caption}</p>
                  )}
                </div>
                <div className="grid h-5">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {state && (
                      <motion.span
                        key={state.label}
                        data-tone={state.tone ?? 'neutral'}
                        initial={{ opacity: 0, y: 6, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.9 }}
                        transition={stageSpring}
                        className="rounded-full bg-[var(--tone-solid)] px-2 font-mono text-[0.65rem] font-semibold leading-5 tracking-wide text-background [grid-area:1/1]"
                      >
                        {state.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
      </div>

      <div ref={body} className="relative" style={{ height }}>
        {width > 0 && (
          <>
            <svg className="absolute inset-0" width={width} height={height} aria-hidden>
              {actors.map((actor) => (
                <line
                  key={actor.id}
                  x1={lanes.get(actor.id)}
                  x2={lanes.get(actor.id)}
                  y1={0}
                  y2={height}
                  stroke="var(--stage-line)"
                  strokeWidth={1.5}
                  strokeDasharray="4 5"
                />
              ))}
              {rows.map((row) =>
                row.message.at > step ? null : (
                  <MessageArrow
                    key={`${row.index}-${row.message.at === step ? 'live' : 'trace'}`}
                    {...row}
                    live={row.message.at === step}
                    travel={travel}
                    maskId={`${scope}-reveal-${row.index}`}
                  />
                ),
              )}
            </svg>

            {rows.map((row) => {
              const visible = row.message.at <= step;
              const live = row.message.at === step;
              const mid = (row.x1 + row.x2) / 2;
              const midY = (row.y1 + row.y2) / 2;
              return (
                <motion.div
                  key={row.index}
                  className="pointer-events-none absolute flex -translate-x-1/2 flex-col items-center text-center"
                  style={{ left: mid, top: midY, width: Math.max(Math.abs(row.x2 - row.x1) - 16, 80) }}
                  initial={false}
                  animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 6 }}
                  transition={{ duration: 0.35, ease: stageEase, delay: live ? travel * 0.35 : 0 }}
                >
                  <span
                    data-tone={row.message.tone ?? 'neutral'}
                    className={cn(
                      'absolute bottom-[calc(100%+0.45rem)] left-1/2 w-max max-w-full -translate-x-1/2 rounded-md px-1.5 py-px font-mono text-[0.68rem] leading-4 font-medium text-balance break-words transition-colors duration-300 @lg/stage:text-xs',
                      live ? 'bg-[var(--tone-surface)] text-[var(--tone-ink)]' : 'text-muted-foreground',
                    )}
                  >
                    {row.message.label}
                  </span>
                  {row.message.detail && (
                    <span className="absolute top-[0.55rem] left-1/2 w-full -translate-x-1/2 text-[0.7rem] leading-4 text-muted-foreground">
                      {row.message.detail}
                    </span>
                  )}
                </motion.div>
              );
            })}

            {stateMarks.map((mark) => {
              if (mark.at > step) return null;
              const x = lanes.get(mark.actor) ?? 0;
              const side = edgeIndex(mark.actor);
              const isCurrent = currentState(mark.actor)?.at === mark.at;
              return (
                <motion.span
                  key={mark.index}
                  data-tone={mark.tone ?? 'neutral'}
                  initial={{ opacity: 0, x: side === 'start' ? 6 : side === 'end' ? -6 : 0 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, ease: stageEase }}
                  className={cn(
                    'absolute -translate-y-1/2 rounded-md border px-1.5 font-mono text-[0.62rem] leading-[1.15rem] font-semibold tracking-wide whitespace-nowrap transition-colors duration-300 @lg/stage:text-[0.68rem]',
                    isCurrent
                      ? 'border-[var(--tone-border)] bg-[var(--tone-surface)] text-[var(--tone-ink)]'
                      : 'border-transparent bg-transparent text-muted-foreground',
                    side === 'middle' && '-translate-x-1/2 bg-background',
                  )}
                  style={
                    side === 'start'
                      ? { right: width - x + 8, top: mark.y }
                      : side === 'end'
                        ? { left: x + 8, top: mark.y }
                        : { left: x, top: mark.y }
                  }
                >
                  {mark.label}
                </motion.span>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function MessageArrow({
  message,
  x1,
  x2,
  y1,
  y2,
  live,
  travel,
  maskId,
}: {
  maskId: string;
  message: SequenceMessage;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  live: boolean;
  travel: number;
}) {
  const reach = message.lost ? 0.56 : 1;
  const ex = x1 + (x2 - x1) * reach;
  const ey = y1 + (y2 - y1) * reach;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = 7.5;
  const headPoints = [
    [ex, ey],
    [ex - head * Math.cos(angle - 0.42), ey - head * Math.sin(angle - 0.42)],
    [ex - head * Math.cos(angle + 0.42), ey - head * Math.sin(angle + 0.42)],
  ]
    .map((point) => point.join(','))
    .join(' ');
  const stroke = live ? 'var(--tone-solid)' : 'var(--stage-line-strong)';

  const d = `M ${x1} ${y1} L ${ex} ${ey}`;
  const dashed = message.dashed || message.lost;
  const draw = { duration: travel * reach, ease: 'easeInOut' } as const;

  return (
    <g data-tone={message.tone ?? 'neutral'}>
      {dashed ? (
        // pathLength drives stroke-dasharray, so a dashed line is revealed
        // through an animated mask instead of being drawn directly.
        <>
          {live && (
            <defs>
              <mask id={maskId} maskUnits="userSpaceOnUse">
                <motion.path
                  d={d}
                  fill="none"
                  stroke="white"
                  strokeWidth={8}
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={draw}
                />
              </mask>
            </defs>
          )}
          <path
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth={live ? 2 : 1.5}
            strokeLinecap="round"
            strokeDasharray="6 5"
            mask={live ? `url(#${maskId})` : undefined}
          />
        </>
      ) : (
        <motion.path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={live ? 2 : 1.5}
          strokeLinecap="round"
          initial={live ? { pathLength: 0 } : false}
          animate={{ pathLength: 1 }}
          transition={draw}
        />
      )}
      {message.lost ? (
        <motion.g
          initial={live ? { opacity: 0, scale: 0.4 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: live ? travel * reach : 0, ...stageSpring }}
          style={{ originX: `${ex}px`, originY: `${ey}px` }}
        >
          <path
            d={`M ${ex - 6} ${ey - 6} L ${ex + 6} ${ey + 6} M ${ex + 6} ${ey - 6} L ${ex - 6} ${ey + 6}`}
            stroke="var(--destructive)"
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </motion.g>
      ) : (
        <motion.polygon
          points={headPoints}
          fill={stroke}
          initial={live ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ delay: live ? travel * 0.92 : 0, duration: 0.15 }}
        />
      )}
      {live && (
        <motion.circle
          r={5}
          fill="var(--tone-solid)"
          stroke="var(--background)"
          strokeWidth={2}
          initial={{ cx: x1, cy: y1, opacity: 1 }}
          animate={{ cx: ex, cy: ey, opacity: [1, 1, 0] }}
          transition={{
            cx: { duration: travel * reach, ease: 'easeInOut' },
            cy: { duration: travel * reach, ease: 'easeInOut' },
            opacity: { duration: travel * reach + 0.25, times: [0, 0.8, 1] },
          }}
        />
      )}
    </g>
  );
}
