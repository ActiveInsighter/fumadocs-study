import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const files = ['高数思维导图.mdx', '线代思维导图.mdx', '概率思维导图.mdx'];
const codeFence = String.fromCharCode(96).repeat(3);
const mindmapPattern = new RegExp(codeFence + 'mindmap\\n([\\s\\S]*?)\\n' + codeFence, 'g');

function readMap(file: string) {
  return readFileSync(join(process.cwd(), 'content/docs/math/mind-maps', file), 'utf8');
}

describe('math mind map source integrity', () => {
  for (const file of files) {
    it(file + ' must not render placeholder or empty nodes', () => {
      const code = readMap(file);
      const maps = [...code.matchAll(mindmapPattern)].map((match) => match[1]);
      expect(maps.length).toBeGreaterThan(0);
      for (const markdown of maps) {
        expect(markdown).toMatch(/^# \S/m);
        expect(markdown).not.toMatch(/^\s*-\s*$/m);
        expect(markdown).not.toMatch(/^\s*-\s*[^:\n]+[:：]\s*$/m);
        expect(markdown).not.toMatch(/(?:待补充|TODO|：略|→\s*\?)/);
        for (const line of markdown.split('\n')) {
          // Inline TeX nodes must contain paired $ delimiters.
          expect((line.match(/(?<!\\)\$/g) ?? []).length % 2).toBe(0);
        }
      }
    });
  }

  it('has the correct criteria for vector representation and orthogonal matrices', () => {
    const code = readMap('线代思维导图.mdx');
    expect(code).toContain('添上 $\\beta$ 不增秩');
    expect(code).toContain('$|A|=\\pm1$');
    expect(code).toContain('$x=Cy$');
  });

  it('contains the probability density and signed test statistics', () => {
    const code = readMap('概率思维导图.mdx');
    expect(code).toContain('P\\{X=x_i\\}=p_i');
    expect(code).toContain('2\\pi\\sigma_1\\sigma_2');
    expect(code).toContain('正态总体参数的双侧');
    expect(code).not.toContain('|\\overline{X}-\\mu_0|');
  });

  it('uses one-line math inside calculus mind maps, avoiding ghost list nodes', () => {
    const code = readMap('高数思维导图.mdx');
    for (const match of code.matchAll(mindmapPattern)) {
      expect(match[1]).not.toContain('$$');
    }
  });
});
