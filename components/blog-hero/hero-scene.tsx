'use client';

import { lazy, Suspense, useRef, type ComponentType } from 'react';

import type { HeroPreset } from './schema';
import type { SceneProps } from './scenes/types';
import { useActiveWhileVisible, useHeroMotion } from './use-hero-motion';

import styles from './scenes/scenes.module.css';

/**
 * Scenes are split per preset: a post only downloads the scene it uses,
 * after hydration, while the CSS poster underneath is already painted.
 */
const scenes: Record<Exclude<HeroPreset, 'minimal'>, ComponentType<SceneProps>> = {
  aurora: lazy(() => import('./scenes/aurora-scene')),
  dataflow: lazy(() => import('./scenes/dataflow-scene')),
  paper: lazy(() => import('./scenes/paper-scene')),
};

export type HeroSceneProps = {
  preset: HeroPreset;
  seed: number;
  intensity?: 'calm' | 'lively';
  series?: readonly number[];
  className?: string;
};

export function HeroScene({ preset, seed, intensity = 'calm', series, className }: HeroSceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const level = useHeroMotion();
  const active = useActiveWhileVisible(ref);
  if (preset === 'minimal') return null;
  const Scene = scenes[preset];

  return (
    <div className={className ?? styles.layer} data-motion={level ?? 'pending'} ref={ref}>
      {level ? (
        <Suspense fallback={null}>
          <Scene active={active} intensity={intensity} level={level} seed={seed} series={series} />
        </Suspense>
      ) : null}
    </div>
  );
}
