'use client';

import { motion } from 'motion/react';
import { useEffect, useMemo, useRef } from 'react';

import { seededRandom } from '../use-hero-motion';
import type { SceneProps } from './types';

import styles from './scenes.module.css';

const WIDTH = 1440;
const HEIGHT = 720;
const DEFAULT_SERIES = [18, 27, 33, 41, 46, 51, 54];

type Point = { x: number; y: number };

/** Catmull-Rom through the points, emitted as cubic Béziers. */
export function smoothPath(points: readonly Point[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  let d = `M${first!.x.toFixed(1)},${first!.y.toFixed(1)}`;
  for (let index = 0; index < rest.length; index += 1) {
    const p0 = points[Math.max(0, index - 1)]!;
    const p1 = points[index]!;
    const p2 = points[index + 1]!;
    const p3 = points[Math.min(points.length - 1, index + 2)]!;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += `C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Maps a rising series onto the scene: log-like x spacing, value → height. */
export function layoutSeries(series: readonly number[], offset = 0): Point[] {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  return series.map((value, index) => {
    const t = series.length === 1 ? 1 : index / (series.length - 1);
    // Keep the curve in the right-hand, lower part of the frame, clear of the centred title.
    const x = WIDTH * (0.52 + 0.46 * Math.sqrt(t));
    const y = HEIGHT * (0.95 - 0.5 * ((value - min) / span)) + offset;
    return { x, y };
  });
}

/**
 * SVG data flow: streams of packets converge on a rising performance curve,
 * echoing the site's tradeoff charts. Draw-in uses Motion's pathLength;
 * packets use SMIL animateMotion (paused off screen, absent when static).
 */
export default function DataflowScene({ level, active, seed, intensity, series }: SceneProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const values = series && series.length >= 2 ? series : DEFAULT_SERIES;
  const animated = level !== 'static';
  const lively = intensity === 'lively';

  const { primary, secondary, streams } = useMemo(() => {
    const random = seededRandom(seed);
    const primaryPoints = layoutSeries(values);
    const secondaryPoints = layoutSeries(values.map((value, index) => value * (0.72 + index * 0.02)), 36);
    const count = level === 'full' ? (lively ? 9 : 7) : 4;
    const streamPaths = Array.from({ length: count }, (_, index) => {
      const target = primaryPoints[Math.floor(random() * primaryPoints.length)]!;
      const startY = HEIGHT * (0.12 + 0.76 * ((index + random() * 0.6) / count));
      const midX = WIDTH * (0.12 + random() * 0.18);
      return {
        id: `stream-${index}`,
        d: `M-40,${startY.toFixed(1)} C${midX.toFixed(1)},${startY.toFixed(1)} ${(target.x - 220).toFixed(1)},${target.y.toFixed(1)} ${target.x.toFixed(1)},${target.y.toFixed(1)}`,
        duration: 5 + random() * 5,
        delay: random() * 4,
      };
    });
    return { primary: primaryPoints, secondary: secondaryPoints, streams: streamPaths };
  }, [seed, values, level, lively]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !animated) return;
    if (active) svg.unpauseAnimations();
    else svg.pauseAnimations();
  }, [active, animated]);

  const prefix = `df-${seed}`;
  const draw = animated
    ? { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 } }
    : { initial: false as const };

  return (
    <svg
      className={styles.dataflow}
      data-active={active && animated ? 'true' : 'false'}
      preserveAspectRatio="xMidYMid slice"
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    >
      <defs>
        <pattern height="32" id={`${prefix}-grid`} patternUnits="userSpaceOnUse" width="32">
          <circle className={styles.gridDot} cx="1" cy="1" r="1" />
        </pattern>
        <linearGradient id={`${prefix}-fade`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="0.55" stopColor="currentColor" stopOpacity="0.5" />
          <stop offset="1" stopColor="currentColor" stopOpacity="1" />
        </linearGradient>
      </defs>
      <rect fill={`url(#${prefix}-grid)`} height={HEIGHT} width={WIDTH} />

      <g className={styles.streams}>
        {streams.map((stream) => (
          <path className={styles.stream} d={stream.d} id={`${prefix}-${stream.id}`} key={stream.id} stroke={`url(#${prefix}-fade)`} />
        ))}
      </g>

      {animated ? (
        <g className={styles.packets}>
          {streams.map((stream) => (
            <circle className={styles.packet} key={stream.id} r={lively ? 3.2 : 2.6}>
              <animateMotion begin={`${stream.delay.toFixed(2)}s`} dur={`${stream.duration.toFixed(2)}s`} repeatCount="indefinite" rotate="auto">
                <mpath href={`#${prefix}-${stream.id}`} />
              </animateMotion>
            </circle>
          ))}
        </g>
      ) : null}

      <motion.path
        className={styles.curveSecondary}
        d={smoothPath(secondary)}
        transition={{ duration: 1.8, ease: [0.25, 1, 0.5, 1], delay: 0.35 }}
        {...draw}
      />
      <motion.path
        className={styles.curve}
        d={smoothPath(primary)}
        transition={{ duration: 1.6, ease: [0.25, 1, 0.5, 1], delay: 0.15 }}
        {...draw}
      />
      {primary.map((point, index) => (
        <motion.circle
          animate={animated ? { opacity: 1, scale: 1 } : undefined}
          className={styles.node}
          cx={point.x}
          cy={point.y}
          initial={animated ? { opacity: 0, scale: 0.4 } : false}
          key={index}
          r={7}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          transition={{ delay: 0.5 + index * 0.12, duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
        />
      ))}
    </svg>
  );
}
