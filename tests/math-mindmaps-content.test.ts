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


describe('complete explanations across all three subject mind maps', () => {
  const vagueMethodLabel =
    /^(?:用定义|用性质|用相似|用秩|用公式|计算公式|必要条件|充分条件|充要条件|几何意义|经济学意义|定限方法|基本形式|具体公式|估值定理|定积分中值定理|第一类曲线积分中值定理|第一类曲面积分中值定理|初始条件|基本内容|计算)$/;

  for (const file of files) {
    it(file + ' does not end branches on bare method labels', () => {
      const maps = [...readMap(file).matchAll(mindmapPattern)].map((match) => match[1]);
      for (const [blockIndex, map] of maps.entries()) {
        const lines = map.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const current = /^(\s*)-\s+(.+)$/.exec(lines[i]);
          if (!current || !vagueMethodLabel.test(current[2].trim())) continue;
          const next = lines.slice(i + 1).find((line) => line.trim()) ?? '';
          const nextItem = /^(\s*)-\s+/.exec(next);
          expect(
            Boolean(nextItem && nextItem[1].length > current[1].length),
            file + ', map ' + blockIndex + ', line ' + (i + 1) + ': ' + current[2],
          ).toBe(true);
        }
      }
    });
  }

  it('keeps the full collection of 31 mind maps', () => {
    expect([...readMap('高数思维导图.mdx').matchAll(mindmapPattern)]).toHaveLength(15);
    expect([...readMap('线代思维导图.mdx').matchAll(mindmapPattern)]).toHaveLength(8);
    expect([...readMap('概率思维导图.mdx').matchAll(mindmapPattern)]).toHaveLength(8);
  });

  it('preserves corrected calculus and statistics equations', () => {
    const calculus = readMap('高数思维导图.mdx');
    const statistics = readMap('概率思维导图.mdx');
    expect(calculus).toContain('令 $u=y^{1-n}$');
    expect(calculus).toContain('\\dfrac12\\int_{-a}^{a}[f(x)+f(-x)]');
    expect(calculus).toContain('a_n^{k+p}');
    expect(calculus).not.toContain('y^{n-1}y\'+P(x)y^n=Q(x)');
    expect(statistics).toContain('F_{\\max}(z)=\\prod');
    expect(statistics).toContain('P(A)>0');
  });
});
