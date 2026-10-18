export type JsonTokenType = 'key' | 'string' | 'number' | 'literal' | 'punctuation' | 'space';
export interface JsonToken {
  type: JsonTokenType;
  text: string;
}

const TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(true|false|null)|([{}[\],])|(\s+)/gu;

/** Pretty-print for display; falls back to the author's text when it is not valid JSON. */
export function formatSpecJson(code: string): string {
  try {
    return JSON.stringify(JSON.parse(code), null, 2);
  } catch {
    return code.trim();
  }
}

/** Minimal JSON lexer for monochrome highlighting. Unknown characters are kept as plain text. */
export function tokenizeJson(text: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let cursor = 0;
  for (const match of text.matchAll(TOKEN)) {
    const start = match.index;
    if (start > cursor) tokens.push({ type: 'punctuation', text: text.slice(cursor, start) });
    const [whole, string, colon, number, literal, punctuation] = match;
    if (string !== undefined && colon !== undefined) {
      tokens.push({ type: 'key', text: string }, { type: 'punctuation', text: colon });
    } else if (string !== undefined) tokens.push({ type: 'string', text: string });
    else if (number !== undefined) tokens.push({ type: 'number', text: number });
    else if (literal !== undefined) tokens.push({ type: 'literal', text: literal });
    else if (punctuation !== undefined) tokens.push({ type: 'punctuation', text: punctuation });
    else tokens.push({ type: 'space', text: whole });
    cursor = start + whole.length;
  }
  if (cursor < text.length) tokens.push({ type: 'punctuation', text: text.slice(cursor) });
  return tokens;
}
