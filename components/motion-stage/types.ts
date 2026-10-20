/**
 * Shared types for the motion stage.
 *
 * Every value here must stay serialisable: MDX pages are React Server
 * Components and hand these props to client components as plain data.
 */

/** Colour families from styles/tokens/palette.css that a stage element may use. */
export type StageTone =
  | 'neutral'
  | 'blue'
  | 'green'
  | 'amber'
  | 'rose'
  | 'violet'
  | 'teal'
  | 'orange';

/** Primitive values shown in the watch panel. */
export type StageValue = string | number | boolean | null;

export type StageStep = {
  /** Short heading of the step, shown in the narration bar. */
  title: string;
  /** One or two sentences explaining what happens in this step. */
  description?: string;
  /** 1-based line numbers of the stage `code` to highlight. */
  lines?: number[];
  /** Variables shown in the watch panel while this step is active. */
  vars?: Record<string, StageValue>;
  /** Milliseconds to stay on this step while auto-playing (before speed). */
  duration?: number;
  /** Accent colour of the narration marker for this step. */
  tone?: StageTone;
};

/**
 * Which steps (0-based) something applies to.
 *
 * - `2`        exactly step 2
 * - `[1, 3]`   steps 1 and 3
 * - `"2+"`     step 2 and every later step
 * - `"1-3"`    steps 1 to 3 inclusive
 * - `"-2"`     every step up to and including 2
 */
export type StepMatch = number | number[] | string;
