'use client';

import { motionValue, useMotionValueEvent, useReducedMotion, useScroll, type MotionValue } from 'motion/react';
import { createContext, useContext, useRef, type ComponentProps } from 'react';

const ScrollContext = createContext<MotionValue<number>>(motionValue(0));

/** 0 while the hero is fully on screen → 1 when it has scrolled away. */
export function useHeroScrollProgress(): MotionValue<number> {
  return useContext(ScrollContext);
}

/**
 * Hero shell. Scroll progress drives a single CSS variable (`--hero-p`), so
 * the server-rendered children need no client wrappers and the transforms
 * stay in CSS (transform / opacity only — compositor friendly).
 */
export function HeroScroll({ enabled = true, children, ...props }: ComponentProps<'header'> & { enabled?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    if (!enabled || reduced) return;
    ref.current?.style.setProperty('--hero-p', value.toFixed(4));
  });

  return (
    <ScrollContext.Provider value={scrollYProgress}>
      <header {...props} ref={ref}>
        {children}
      </header>
    </ScrollContext.Provider>
  );
}
