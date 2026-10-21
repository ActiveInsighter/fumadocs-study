/*
 * Blog hero system.
 *
 *   schema.ts          `hero:` frontmatter (zod) — the authoring contract
 *   blog-hero.tsx      server-rendered hero shell (real h1, index, facts)
 *   hero-scroll.tsx    scroll progress → --hero-p (CSS transforms)
 *   hero-scene.tsx     lazy, capability-gated scene loader
 *   scenes/*           aurora (CSS + 2D canvas), dataflow (SVG), paper (SVG)
 *   motion-scene.tsx   the same scenes as an inline MDX block
 */
export { BlogHero, formatEyebrowDate, hashSeed } from './blog-hero';
export type { BlogHeroProps } from './blog-hero';
export { MotionScene } from './motion-scene';
export type { MotionSceneProps } from './motion-scene';
export { heroAccents, heroPresets, heroSchema } from './schema';
export type { HeroAccent, HeroConfig, HeroFrontmatter, HeroPreset } from './schema';
export { detectMotionLevel } from './use-hero-motion';
export type { HeroMotionLevel } from './use-hero-motion';
