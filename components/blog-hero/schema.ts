import { z } from 'zod';

/**
 * `hero:` frontmatter for blog posts. Every field is optional, so a post can
 * opt in with just `hero: { preset: aurora }` and tune the rest later.
 *
 * Kept free of React imports: source.config.ts loads it at build time.
 */
export const heroPresets = ['minimal', 'aurora', 'dataflow', 'paper'] as const;
export const heroAccents = ['indigo', 'clay', 'teal', 'ochre', 'plum', 'moss'] as const;

export const heroSchema = z.object({
  /** Visual scene behind the title. */
  preset: z.enum(heroPresets).default('minimal'),
  /** Small line above the title; defaults to the post date. */
  eyebrow: z.string().optional(),
  /** Display title when it should differ from `title` (use "\n" for a manual line break). */
  headline: z.string().optional(),
  /** Short deck under the title; defaults to the post description. */
  deck: z.string().optional(),
  align: z.enum(['center', 'start']).default('center'),
  /** `auto` follows the site theme; `dark` keeps a dark band in both themes. */
  tone: z.enum(['auto', 'light', 'dark']).default('auto'),
  accent: z.enum(heroAccents).default('indigo'),
  height: z.enum(['compact', 'tall', 'screen']).default('tall'),
  /** Numbered section index from the post's h2 headings. */
  index: z.boolean().default(false),
  /** Key-value facts under the title, e.g. reading time or a model id. */
  facts: z.array(z.object({ label: z.string(), value: z.string() })).max(4).optional(),
  /** Scene data: a rising series drawn by the dataflow preset. */
  series: z.array(z.number()).min(2).max(24).optional(),
  /** Deterministic layout for particles / shapes. */
  seed: z.number().int().optional(),
  /** `calm` halves motion amplitude and density. */
  intensity: z.enum(['calm', 'lively']).default('calm'),
  /** Scroll-linked parallax and fade of the hero. */
  scroll: z.boolean().default(true),
});

export type HeroFrontmatter = z.input<typeof heroSchema>;
export type HeroConfig = z.output<typeof heroSchema>;
export type HeroPreset = (typeof heroPresets)[number];
export type HeroAccent = (typeof heroAccents)[number];
