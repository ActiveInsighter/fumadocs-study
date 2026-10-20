import type { Transition, Variants } from 'motion/react';

/**
 * Motion vocabulary shared by every stage element, so scenes written later
 * feel like one system: a soft spring for layout, a crisp ease for fades.
 */
export const stageSpring: Transition = { type: 'spring', stiffness: 380, damping: 34, mass: 0.9 };
export const stageSoftSpring: Transition = { type: 'spring', stiffness: 220, damping: 28 };
export const stageEase = [0.22, 1, 0.36, 1] as const;
export const stageFade: Transition = { duration: 0.32, ease: stageEase };

/** Seconds a packet / edge needs to travel; scaled by the playback speed. */
export const TRAVEL_SECONDS = 0.75;

export type RevealEffect = 'fade' | 'rise' | 'drop' | 'scale' | 'blur' | 'slide';

export const revealVariants: Record<RevealEffect, Variants> = {
  fade: {
    hidden: { opacity: 0 },
    shown: { opacity: 1 },
  },
  rise: {
    hidden: { opacity: 0, y: 10 },
    shown: { opacity: 1, y: 0 },
  },
  drop: {
    hidden: { opacity: 0, y: -10 },
    shown: { opacity: 1, y: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.92 },
    shown: { opacity: 1, scale: 1 },
  },
  blur: {
    hidden: { opacity: 0, filter: 'blur(6px)' },
    shown: { opacity: 1, filter: 'blur(0px)' },
  },
  slide: {
    hidden: (direction: number = 1) => ({ opacity: 0, x: 16 * direction }),
    shown: { opacity: 1, x: 0 },
  },
};
