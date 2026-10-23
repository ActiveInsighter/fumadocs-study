import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('vocabulary responsive layout', () => {
  it('uses Fumadocs full mode only for vocabulary pages unless frontmatter already requests it', () => {
    const page = readFileSync(new URL('../app/docs/[[...slug]]/page.tsx', import.meta.url), 'utf8');
    expect(page).toContain("page.path.startsWith('english/vocabulary/')");
    expect(page).toContain('Boolean(page.data.full) || isVocabularyPage');
    expect(page).toMatch(/<DocsPage\s+toc=\{data\.toc\}\s+full=\{useFullPage\}\s*>/u);
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

  it('loads the detail modal layout with the card styles and the general modal globally', () => {
    const layout = readFileSync(new URL('../app/docs/layout.tsx', import.meta.url), 'utf8');
    const global = readFileSync(new URL('../app/global.css', import.meta.url), 'utf8');
    expect(layout.indexOf('@/styles/word-card-detail.css')).toBeGreaterThan(layout.indexOf('@/styles/word-cards.css'));
    expect(global).toMatch(/@import '\.\.\/styles\/tokens\/index\.css';[\s\S]*@import '\.\.\/styles\/modal\.css';/u);
  });
});
