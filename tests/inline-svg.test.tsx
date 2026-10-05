import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { InlineSvg } from '../components/mdx/inline-svg';

const releaseDocsRoots = [
  'computer-organization',
  'data-structure',
  'operating_system',
  'computer_network',
].map((course) => join(process.cwd(), 'content/docs/408/knowledge2', course));

function getMdxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return getMdxFiles(path);
    return entry.name.endsWith('.mdx') || entry.name.endsWith('.md') ? [path] : [];
  });
}

describe('InlineSvg', () => {
  it('renders the local SVG markup inside a CSS-addressable wrapper', () => {
    const html = renderToStaticMarkup(
      <InlineSvg
        src="/images/computer-network/computer-network-root-001.svg"
        alt="计算机网络知识结构"
        className="diagram"
      />,
    );

    expect(html).toContain('<span class="inline-svg diagram"');
    expect(html).toContain('<svg');
    expect(html).toContain('class="inline-svg__root');
    expect(html).toContain('aria-label="计算机网络知识结构"');
    expect(html).not.toContain('<img');
  });

  it('rejects sources outside the local SVG asset directory', () => {
    expect(() =>
      renderToStaticMarkup(<InlineSvg src="/images/../private.svg" alt="非法资源" />),
    ).toThrow(/local SVG asset/u);
  });

  it('namespaces internal IDs and references when SVGs share a document', () => {
    const html = renderToStaticMarkup(
      <>
        <InlineSvg
          src="/images/computer-organization/computer-organization-cpu-multicore-004.svg"
          alt="多核处理器"
        />
        <InlineSvg
          src="/images/computer-organization/computer-organization-cpu-structure-010.svg"
          alt="CPU 结构"
        />
      </>,
    );

    const ids = [...html.matchAll(/\bid="([^"]+)"/gu)].map(([, id]) => id);
    const references = [...html.matchAll(/url\(#([^)]+)\)/gu)].map(([, id]) => id);

    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
    expect(references.length).toBeGreaterThan(1);
    for (const id of ids) expect(id).toMatch(/^inline-svg-/u);
    for (const reference of references) expect(ids).toContain(reference);
  });

  it('does not activate behavior embedded in source SVG files', () => {
    const html = renderToStaticMarkup(
      <InlineSvg
        src="/images/computer-organization/computer-organization-cpu-structure-005.svg"
        alt="CPU 内部时序逻辑元件"
      />,
    );

    expect(html).not.toMatch(/\son[a-z][\w:-]*\s*=/iu);
    expect(html).not.toContain('sendPrompt');

    const fallbackHtml = renderToStaticMarkup(
      <InlineSvg
        src="/images/computer-network/computer-network-datalink-mac-007.svg"
        alt="介质访问控制"
      />,
    );

    expect(fallbackHtml).not.toContain('https://www.drawio.com/');
  });

  it('converts every SVG image in 知识点总结2 to InlineSvg', () => {
    const files = releaseDocsRoots.flatMap(getMdxFiles);
    const source = files.map((file) => readFileSync(file, 'utf8')).join('\n');

    expect(source).not.toMatch(/!\[[^\r\n]*\]\(\/images\/[^)\s]+\.svg\)/u);

    const references = [...source.matchAll(/<InlineSvg\s+src="([^"]+\.svg)"/gu)].map(
      ([, src]) => src,
    );
    expect(references.length).toBeGreaterThan(0);

    for (const src of references) {
      expect(src, relative(process.cwd(), releaseDocsRoots[0])).toMatch(
        /^\/images\/[\w./-]+\.svg$/u,
      );
      expect(existsSync(join(process.cwd(), 'public', ...src.slice(1).split('/')))).toBe(true);
    }
  });
});
