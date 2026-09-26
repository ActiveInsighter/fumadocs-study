import { describe, expect, it } from 'vitest';
import { normalizeStrongBoundariesInLine } from '../scripts/normalize-strong-boundaries.mjs';

describe('normalizeStrongBoundariesInLine', () => {
  it('adds an invisible parser boundary after punctuation-ended strong text', () => {
    expect(normalizeStrongBoundariesInLine('**缓冲区（Buffer）**是在主存中开辟的一块临时区域。'))
      .toBe('**缓冲区（Buffer）**&#x2060;是在主存中开辟的一块临时区域。');
  });

  it('repairs consecutive strong segments without adding visible spaces', () => {
    expect(normalizeStrongBoundariesInLine('**SPOOLing（Simultaneous Peripheral Operations On-Line）**称为**假脱机技术**或联机并发外设操作技术。'))
      .toBe('**SPOOLing（Simultaneous Peripheral Operations On-Line）**&#x2060;称为**假脱机技术**或联机并发外设操作技术。');
  });

  it('moves accidental whitespace outside the strong markers', () => {
    expect(normalizeStrongBoundariesInLine('前文 **术语（Term） **后文'))
      .toBe('前文 **术语（Term）** 后文');
  });

  it('leaves unambiguous strong syntax unchanged', () => {
    expect(normalizeStrongBoundariesInLine('这是 **普通加粗** 文本。'))
      .toBe('这是 **普通加粗** 文本。');
  });

  it('is idempotent', () => {
    const normalized = '**缓冲区（Buffer）**&#x2060;是在主存中开辟的一块临时区域。';
    expect(normalizeStrongBoundariesInLine(normalized)).toBe(normalized);
  });
});
