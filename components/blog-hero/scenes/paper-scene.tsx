'use client';

import { motion, useTransform } from 'motion/react';
import { useMemo } from 'react';

import { useHeroScrollProgress } from '../hero-scroll';
import { seededRandom } from '../use-hero-motion';
import type { SceneProps } from './types';

import styles from './scenes.module.css';

const WIDTH = 1440;
const HEIGHT = 720;

function hill(random: () => number, baseY: number, amplitude: number): string {
  const steps = 6;
  let d = `M-20,${HEIGHT + 20} L-20,${baseY}`;
  for (let index = 1; index <= steps; index += 1) {
    const x = (WIDTH + 40) * (index / steps) - 20;
    const y = baseY - amplitude * (0.4 + random() * 0.6) * Math.sin((index / steps) * Math.PI * (1 + random() * 0.4));
    const cx = x - (WIDTH / steps) * 0.5;
    d += ` Q${cx.toFixed(1)},${(y - amplitude * 0.25).toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return `${d} L${WIDTH + 20},${HEIGHT + 20} Z`;
}

/**
 * Light visual: layered cut-paper hills, a horizon arc and a soft disc,
 * with a static paper grain. Layers drift at different rates as the hero
 * scrolls away (parallax); an idle sway runs only on capable devices.
 */
export default function PaperScene({ level, active, seed }: SceneProps) {
  const progress = useHeroScrollProgress();
  const scrollable = level !== 'static';
  const far = useTransform(progress, [0, 1], [0, scrollable ? 40 : 0]);
  const mid = useTransform(progress, [0, 1], [0, scrollable ? 90 : 0]);
  const near = useTransform(progress, [0, 1], [0, scrollable ? 150 : 0]);
  const disc = useTransform(progress, [0, 1], [0, scrollable ? -60 : 0]);

  const shapes = useMemo(() => {
    const random = seededRandom(seed);
    return {
      far: hill(random, HEIGHT * 0.62, 90),
      mid: hill(random, HEIGHT * 0.74, 70),
      near: hill(random, HEIGHT * 0.86, 50),
      discX: WIDTH * (0.7 + random() * 0.14),
      discY: HEIGHT * (0.34 + random() * 0.08),
    };
  }, [seed]);

  return (
    <div className={styles.paper} data-active={active && level === 'full' ? 'true' : 'false'}>
      <svg className={styles.paperSvg} preserveAspectRatio="xMidYMax slice" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <motion.circle className={styles.paperDisc} cx={shapes.discX} cy={shapes.discY} r={72} style={{ y: disc }} />
        <motion.path
          className={styles.horizon}
          d={`M-40,${HEIGHT * 0.62} Q${WIDTH / 2},${HEIGHT * 0.3} ${WIDTH + 40},${HEIGHT * 0.62}`}
          initial={scrollable ? { pathLength: 0 } : false}
          animate={scrollable ? { pathLength: 1 } : undefined}
          transition={{ duration: 1.8, ease: [0.25, 1, 0.5, 1] }}
        />
        <motion.g className={styles.sway} style={{ y: far }}>
          <path className={styles.paperFar} d={shapes.far} />
        </motion.g>
        <motion.g className={styles.swaySlow} style={{ y: mid }}>
          <path className={styles.paperMid} d={shapes.mid} />
        </motion.g>
        <motion.g style={{ y: near }}>
          <path className={styles.paperNear} d={shapes.near} />
        </motion.g>
      </svg>
      <div className={styles.grain} />
    </div>
  );
}
