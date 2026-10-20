import { describe, expect, it } from 'vitest';

import { dedent } from '@/components/motion-stage/stage-panels';
import { frameAt, matchesStep } from '@/components/motion-stage/step-match';

describe('matchesStep', () => {
  it('treats a missing match as every step', () => {
    expect(matchesStep(0, undefined)).toBe(true);
    expect(matchesStep(9, undefined)).toBe(true);
  });

  it('supports numbers, lists, open and closed ranges', () => {
    expect(matchesStep(2, 2)).toBe(true);
    expect(matchesStep(3, 2)).toBe(false);
    expect(matchesStep(3, [1, 3])).toBe(true);
    expect(matchesStep(2, '2+')).toBe(true);
    expect(matchesStep(1, '2+')).toBe(false);
    expect(matchesStep(2, '1-3')).toBe(true);
    expect(matchesStep(4, '1-3')).toBe(false);
    expect(matchesStep(0, '-2')).toBe(true);
    expect(matchesStep(3, '-2')).toBe(false);
  });

  it('accepts comma separated mixes and whitespace', () => {
    expect(matchesStep(5, '0, 2-3, 5+')).toBe(true);
    expect(matchesStep(4, '0, 2-3, 5+')).toBe(false);
    expect(matchesStep(0, '3')).toBe(false);
  });
});

describe('frameAt', () => {
  it('holds the last frame and clamps negative steps', () => {
    expect(frameAt(['a', 'b'], 0)).toBe('a');
    expect(frameAt(['a', 'b'], 5)).toBe('b');
    expect(frameAt(['a', 'b'], -1)).toBe('a');
    expect(frameAt([], 0)).toBeUndefined();
  });
});

describe('dedent', () => {
  it('strips shared indentation and blank edges', () => {
    expect(dedent('\n    a\n      b\n')).toEqual(['a', '  b']);
  });

  it('keeps per-line indentation of a line array', () => {
    expect(dedent(['for (;;)', '  body'])).toEqual(['for (;;)', '  body']);
  });
});
