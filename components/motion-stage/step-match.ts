import type { StepMatch } from './types';

/**
 * Returns true when `step` is selected by `match`. A missing match selects
 * every step, so optional gating props default to "always".
 */
export function matchesStep(step: number, match: StepMatch | undefined): boolean {
  if (match === undefined) return true;
  if (typeof match === 'number') return step === match;
  if (Array.isArray(match)) return match.includes(step);

  const text = match.replace(/\s+/g, '');
  if (text === '' || text === '*') return true;

  const from = /^(\d+)\+$/.exec(text);
  if (from) return step >= Number(from[1]);

  const upTo = /^-(\d+)$/.exec(text);
  if (upTo) return step <= Number(upTo[1]);

  const range = /^(\d+)-(\d+)$/.exec(text);
  if (range) return step >= Number(range[1]) && step <= Number(range[2]);

  return text
    .split(',')
    .filter(Boolean)
    .some((part) => matchesStep(step, /^\d+$/.test(part) ? Number(part) : part));
}

/**
 * Resolves a per-step frame list. Frames shorter than the step count hold
 * their last entry, so a scene only needs frames up to its final change.
 */
export function frameAt<T>(frames: readonly T[], step: number): T | undefined {
  if (frames.length === 0) return undefined;
  return frames[Math.min(Math.max(step, 0), frames.length - 1)];
}
