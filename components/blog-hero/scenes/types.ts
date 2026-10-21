import type { HeroMotionLevel } from '../use-hero-motion';

export type SceneProps = {
  /** Motion budget for this device. */
  level: HeroMotionLevel;
  /** On screen and tab visible; loops pause when false. */
  active: boolean;
  seed: number;
  intensity: 'calm' | 'lively';
  series?: readonly number[];
};
