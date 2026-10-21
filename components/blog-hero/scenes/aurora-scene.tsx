'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { createFrameBudget, seededRandom, useLatest } from '../use-hero-motion';
import type { SceneProps } from './types';

import styles from './scenes.module.css';

type Particle = { x: number; y: number; r: number; speed: number; drift: number; phase: number; tone: number };

/**
 * Gradient + particles. The gradient blobs are CSS (compositor-animated
 * transforms, paused off screen); the particle field is a 2D canvas because
 * a hundred moving points is cheaper there than as DOM/SVG nodes. No WebGL.
 */
export default function AuroraScene({ level, active, seed, intensity }: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [degraded, setDegraded] = useState(false);
  const effective = degraded ? 'static' : level;
  const state = useLatest({ effective });
  const density = (intensity === 'lively' ? 1 : 0.6) * (effective === 'full' ? 1 : 0.5);

  const particles = useMemo<Particle[]>(() => {
    const random = seededRandom(seed);
    return Array.from({ length: Math.round(140 * density) }, () => ({
      x: random(),
      y: random(),
      r: 0.6 + random() * 1.6,
      speed: 0.004 + random() * 0.012,
      drift: (random() - 0.5) * 0.004,
      phase: random() * Math.PI * 2,
      tone: random(),
    }));
  }, [seed, density]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    const budget = createFrameBudget();
    const styles = getComputedStyle(canvas);
    const colors = [styles.getPropertyValue('--hero-particle-1').trim() || '#fff', styles.getPropertyValue('--hero-particle-2').trim() || '#cbd5ff'];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      const t = time / 1000;
      for (const particle of particles) {
        const y = (((particle.y - t * particle.speed) % 1) + 1) % 1;
        const x = (((particle.x + Math.sin(t * 0.3 + particle.phase) * 0.01 + t * particle.drift) % 1) + 1) % 1;
        const twinkle = 0.45 + 0.55 * Math.sin(t * 1.4 + particle.phase) ** 2;
        const px = x * width + pointerX * (particle.r * 6);
        const py = y * height + pointerY * (particle.r * 6);
        context.globalAlpha = twinkle * (0.35 + particle.r / 3);
        context.fillStyle = colors[particle.tone > 0.7 ? 1 : 0]!;
        context.beginPath();
        context.arc(px, py, particle.r, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    // The loop only runs while the scene is visible; the effect restarts it.
    const loop = (time: number) => {
      if (!budget.tick(time)) {
        setDegraded(true);
        return;
      }
      draw(time);
      frame = requestAnimationFrame(loop);
    };

    const onPointer = (event: PointerEvent) => {
      if (state.current.effective !== 'full') return;
      pointerX = event.clientX / window.innerWidth - 0.5;
      pointerY = event.clientY / window.innerHeight - 0.5;
    };

    resize();
    draw(performance.now());
    const observer = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    observer.observe(canvas);
    window.addEventListener('pointermove', onPointer, { passive: true });
    if (active && effective !== 'static') frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('pointermove', onPointer);
    };
  }, [particles, state, effective, active]);

  return (
    <div className={styles.aurora} data-active={active && effective !== 'static' ? 'true' : 'false'}>
      <div className={styles.blob} data-blob="1" />
      <div className={styles.blob} data-blob="2" />
      <div className={styles.blob} data-blob="3" />
      <canvas className={styles.canvas} ref={canvasRef} />
    </div>
  );
}
