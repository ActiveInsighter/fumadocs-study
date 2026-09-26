import { describe, expect, it } from 'vitest';
import { repairStrongBoundaryText } from '../lib/mdx/remark-strong-boundary';

describe('repairStrongBoundaryText', () => {
  it('repairs a strong term ending in CJK punctuation next to CJK text', () => {
    expect(
      repairStrongBoundaryText('**缓冲区（Buffer）**是在主存中开辟的一块临时区域。'),
    ).toEqual([
      {
        type: 'strong',
        children: [{ type: 'text', value: '缓冲区（Buffer）' }],
      },
      { type: 'text', value: '是在主存中开辟的一块临时区域。' },
    ]);
  });

  it('moves accidental whitespace inside strong markers outside the strong node', () => {
    expect(repairStrongBoundaryText('前文 **术语（Term） **后文')).toEqual([
      { type: 'text', value: '前文 ' },
      {
        type: 'strong',
        children: [{ type: 'text', value: '术语（Term）' }],
      },
      { type: 'text', value: ' 后文' },
    ]);
  });

  it('does not touch ordinary literal double-asterisk text without the edge case', () => {
    expect(repairStrongBoundaryText('literal **asterisks** here')).toBeNull();
  });

  it('repairs multiple affected terms in one text node', () => {
    expect(
      repairStrongBoundaryText('**A（Alpha）**是第一项，**B（Beta）**是第二项。'),
    ).toEqual([
      { type: 'strong', children: [{ type: 'text', value: 'A（Alpha）' }] },
      { type: 'text', value: '是第一项，' },
      { type: 'strong', children: [{ type: 'text', value: 'B（Beta）' }] },
      { type: 'text', value: '是第二项。' },
    ]);
  });
});
