import katex from 'katex';

/**
 * Server-side TeX → HTML for plot labels, legends and readouts. The client
 * plots receive this map, so KaTeX never ships in the browser bundle (its CSS
 * is already loaded globally by app/layout.tsx).
 */
export type TexMap = Record<string, string>;

export function renderTexMap(sources: Iterable<string>): TexMap {
  const out: TexMap = {};
  for (const source of sources) {
    if (!source || source in out) continue;
    out[source] = katex.renderToString(source, {
      displayMode: false,
      throwOnError: false,
      strict: 'ignore',
      output: 'html',
    });
  }
  return out;
}
