'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * How much motion a scene may use on this device:
 *
 *   full     everything (ambient loops, particles, pointer response)
 *   reduced  fewer particles, no pointer response, slower loops
 *   static   a single still frame — reduced motion, data saver, or a scene
 *            that measured sustained frame drops
 */
export type HeroMotionLevel = 'full' | 'reduced' | 'static';

type NavigatorHints = Navigator & {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
};

export function detectMotionLevel(input: {
  reducedMotion: boolean;
  saveData?: boolean;
  cores?: number;
  memory?: number;
}): HeroMotionLevel {
  if (input.reducedMotion || input.saveData) return 'static';
  if ((input.cores !== undefined && input.cores <= 4) || (input.memory !== undefined && input.memory <= 4)) {
    return 'reduced';
  }
  return 'full';
}

/**
 * `null` during the server render and the hydration pass (so both agree),
 * then the measured level. Scenes mount only once it is known, so their
 * entrance animation starts from the right state.
 */
export function useHeroMotion(): HeroMotionLevel | null {
  const [level, setLevel] = useState<HeroMotionLevel | null>(null);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hints = navigator as NavigatorHints;
    const update = () =>
      setLevel(
        detectMotionLevel({
          reducedMotion: query.matches,
          saveData: hints.connection?.saveData,
          cores: hints.hardwareConcurrency,
          memory: hints.deviceMemory,
        }),
      );
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return level;
}

/** True while the element is on screen and the tab is visible: loops pause otherwise. */
export function useActiveWhileVisible<T extends Element>(ref: RefObject<T | null>): boolean {
  const [onScreen, setOnScreen] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setOnScreen(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setOnScreen(Boolean(entry?.isIntersecting)), {
      rootMargin: '64px',
    });
    observer.observe(node);
    const onVisibility = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ref]);

  return onScreen && pageVisible;
}

/**
 * Frame-time watchdog for canvas scenes: if the average frame over a window
 * exceeds the budget, the scene should drop to a still frame.
 */
export function createFrameBudget(budgetMs = 34, windowSize = 45) {
  let samples: number[] = [];
  let last: number | null = null;
  return {
    tick(now: number): boolean {
      if (last !== null) samples.push(now - last);
      last = now;
      if (samples.length < windowSize) return true;
      const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
      samples = [];
      return average <= budgetMs;
    },
    reset() {
      samples = [];
      last = null;
    },
  };
}

/** Deterministic PRNG so scene layouts match between renders. */
export function seededRandom(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
