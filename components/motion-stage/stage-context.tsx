'use client';

import * as React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { matchesStep } from './step-match';
import type { StageStep, StepMatch } from './types';

export const STAGE_SPEEDS = [0.5, 1, 1.5, 2] as const;
export type StageSpeed = (typeof STAGE_SPEEDS)[number];

/** Default dwell time of a step while auto-playing, at 1× speed. */
export const DEFAULT_STEP_DURATION = 2600;

export type StageState = {
  /** Unique per stage instance; scopes layoutIds so stages never share motion. */
  id: string;
  steps: readonly StageStep[];
  /** Current step, 0-based. */
  step: number;
  total: number;
  current: StageStep;
  /** +1 after moving forward, -1 after moving back. Drives directional motion. */
  direction: 1 | -1;
  playing: boolean;
  speed: StageSpeed;
  /** Milliseconds the current step is held while playing (speed applied). */
  dwell: number;
  /** Bumped on every navigation, so in-step animations can replay on demand. */
  epoch: number;
  isFirst: boolean;
  isLast: boolean;
  goTo: (step: number) => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  cycleSpeed: () => void;
};

const StageContext = createContext<StageState | null>(null);

/**
 * Reads the nearest stage. Scene components call this to react to the
 * current step; outside a stage it throws so mistakes surface immediately.
 */
export function useStage(): StageState {
  const stage = useContext(StageContext);
  if (!stage) throw new Error('useStage() must be used inside <MotionStage>.');
  return stage;
}

/** True when the current step is selected by `match` (see StepMatch). */
export function useStepMatch(match: StepMatch | undefined): boolean {
  return matchesStep(useStage().step, match);
}

type Playback = {
  step: number;
  direction: 1 | -1;
  playing: boolean;
  epoch: number;
};

type PlaybackAction =
  | { type: 'go'; step: number }
  | { type: 'next'; total: number; loop: boolean }
  | { type: 'prev' }
  | { type: 'reset' }
  | { type: 'play'; total: number }
  | { type: 'pause' };

function playbackReducer(state: Playback, action: PlaybackAction): Playback {
  const epoch = state.epoch + 1;
  switch (action.type) {
    case 'go':
      return { ...state, step: action.step, direction: action.step >= state.step ? 1 : -1, epoch };
    case 'next': {
      if (state.step < action.total - 1) return { ...state, step: state.step + 1, direction: 1, epoch };
      if (action.loop) return { ...state, step: 0, direction: 1, epoch };
      return { ...state, playing: false };
    }
    case 'prev':
      return { ...state, step: Math.max(state.step - 1, 0), direction: -1, playing: false, epoch };
    case 'reset':
      return { step: 0, direction: -1, playing: false, epoch };
    case 'play':
      // Playing from the last step starts over instead of doing nothing.
      if (state.step >= action.total - 1 && action.total > 1) {
        return { step: 0, direction: 1, playing: true, epoch };
      }
      return { ...state, playing: true };
    case 'pause':
      return { ...state, playing: false };
  }
}

type StageProviderProps = {
  steps: readonly StageStep[];
  initialStep?: number;
  loop?: boolean;
  /** Whether playback may advance right now (e.g. the stage is on screen). */
  active: boolean;
  /** Start playing as soon as the stage becomes active. */
  autoPlay?: boolean;
  children: React.ReactNode;
};

export function StageProvider({
  steps,
  initialStep = 0,
  loop = false,
  active,
  autoPlay = false,
  children,
}: StageProviderProps) {
  const id = React.useId().replace(/:/g, '');
  const total = Math.max(steps.length, 1);
  const clamp = useCallback(
    (value: number) => Math.min(Math.max(Math.round(value), 0), total - 1),
    [total],
  );

  const [state, dispatch] = useReducer(
    playbackReducer,
    { step: clamp(initialStep), direction: 1, playing: false, epoch: 0 } satisfies Playback,
  );
  const [speed, setSpeed] = useState<StageSpeed>(1);
  const autoPlayed = useRef(false);
  const { step, direction, playing, epoch } = state;

  const goTo = useCallback((target: number) => dispatch({ type: 'go', step: clamp(target) }), [clamp]);
  const next = useCallback(() => dispatch({ type: 'next', total, loop }), [loop, total]);
  const prev = useCallback(() => dispatch({ type: 'prev' }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);
  const play = useCallback(() => dispatch({ type: 'play', total }), [total]);
  const pause = useCallback(() => dispatch({ type: 'pause' }), []);
  const toggle = useCallback(() => (playing ? pause() : play()), [pause, play, playing]);
  const cycleSpeed = useCallback(() => {
    setSpeed((value) => STAGE_SPEEDS[(STAGE_SPEEDS.indexOf(value) + 1) % STAGE_SPEEDS.length]);
  }, []);

  useEffect(() => {
    if (autoPlay && active && !autoPlayed.current) {
      autoPlayed.current = true;
      play();
    }
  }, [active, autoPlay, play]);

  const current = steps[step] ?? { title: '' };
  const dwell = (current.duration ?? DEFAULT_STEP_DURATION) / speed;

  useEffect(() => {
    if (!playing || !active) return;
    const timer = window.setTimeout(next, dwell);
    return () => window.clearTimeout(timer);
  }, [active, dwell, epoch, next, playing]);

  const value = useMemo<StageState>(
    () => ({
      id,
      steps,
      step,
      total,
      current,
      direction,
      playing,
      speed,
      dwell,
      epoch,
      isFirst: step === 0,
      isLast: step === total - 1,
      goTo,
      next,
      prev,
      reset,
      play,
      pause,
      toggle,
      cycleSpeed,
    }),
    [id, steps, step, total, current, direction, playing, speed, dwell, epoch, goTo, next, prev, reset, play, pause, toggle, cycleSpeed],
  );

  return <StageContext.Provider value={value}>{children}</StageContext.Provider>;
}
