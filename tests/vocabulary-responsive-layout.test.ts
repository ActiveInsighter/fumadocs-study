import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('vocabulary responsive layout', () => {
  it('uses Fumadocs full mode only for vocabulary pages unless frontmatter already requests it', () => {
    const page = readFileSync(new URL('../app/docs/[[...slug]]/page.tsx', import.meta.url), 'utf8');
    expect(page).toContain("page.path.startsWith('english/vocabulary/')");
    expect(page).toContain('Boolean(page.data.full) || isVocabularyPage');
    expect(page).toContain('<DocsPage toc={data.toc} full={useFullPage}>');
    expect(page).toContain("' vocabulary-docs-body'");
  });

  it('loads vocabulary layout overrides after the base card styles', () => {
    const layout = readFileSync(new URL('../app/docs/layout.tsx', import.meta.url), 'utf8');
    const interactionsIndex = layout.indexOf("@/styles/word-card-interactions.css");
    const responsiveIndex = layout.indexOf("@/styles/vocabulary-responsive-layout.css");
    expect(interactionsIndex).toBeGreaterThan(-1);
    expect(responsiveIndex).toBeGreaterThan(interactionsIndex);
  });

  it('lets card width determine the compact column count instead of forcing narrow fixed columns', () => {
    const css = readFileSync(new URL('../styles/vocabulary-responsive-layout.css', import.meta.url), 'utf8');
    expect(css).toMatch(/max-width:\s*1440px/u);
    expect(css).toMatch(/repeat\(auto-fit,\s*minmax\(min\(100%,\s*380px\),\s*1fr\)\)/u);
    expect(css).toMatch(/@media\s+screen\s+and\s*\(max-width:\s*980px\)[\s\S]*?340px/u);
    expect(css).toMatch(/@media\s+screen\s+and\s*\(max-width:\s*760px\)[\s\S]*?grid-template-columns:\s*1fr/u);
    expect(css).toMatch(/\.wc-word\s*\{[^}]*white-space:\s*nowrap/u);
  });

  it('allows detail dialogs to grow naturally before viewport scrolling is needed', () => {
    const css = readFileSync(new URL('../styles/vocabulary-responsive-layout.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.wc-detail-dialog\s*\{[^}]*width:\s*fit-content/u);
    expect(css).toMatch(/min-width:\s*min\(620px,\s*calc\(100vw\s*-\s*32px\)\)/u);
    expect(css).toMatch(/max-width:\s*min\(980px,\s*calc\(100vw\s*-\s*32px\)\)/u);
    expect(css).toMatch(/max-height:\s*calc\(100dvh\s*-\s*20px\)/u);
    expect(css).not.toMatch(/82dvh/u);
  });
});
