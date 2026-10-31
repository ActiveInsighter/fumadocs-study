import { isValidElement, type ReactElement, type ReactNode } from 'react';

import { propsOf, topLevelElements } from './children';

/*
 * How Cards and CardSteps lay themselves out, decided on the server from
 * their content. Pure functions over React nodes: no rendering, no DOM.
 *
 * CardSteps picks a layout:
 *
 *   row     steps side by side, wrapping into balanced rows (up to 4 a row)
 *   column  steps stacked, one full-width card each
 *
 * `auto` picks a row when every step is short enough to read comfortably in
 * a card of that width, and a column otherwise. Below the width a row needs,
 * the stylesheet (styles/doc-card-steps.css) folds it into a column anyway,
 * unless the steps are compact enough to stay two a row on a phone.
 *
 * Cards picks the narrowest a card may get before the grid drops a column:
 * short cards sit two a row on a phone, long ones keep the full width.
 */

export type CardStepsLayout = 'row' | 'column';
export type CardStepsLayoutOption = CardStepsLayout | 'auto';

export interface CardMetrics {
  /** Title width in full-width characters. */
  title: number;
  /** Description and body width in full-width characters. */
  body: number;
  /** Top-level blocks in the body (paragraphs, lists, code…). */
  blocks: number;
  /** Holds something that cannot shrink to a narrow card: a code block, a table, display math. */
  wide: boolean;
}

export interface ResolvedCardStepsLayout {
  layout: CardStepsLayout;
  /** Cards per row; 1 for a column. */
  columns: number;
  /** A row whose cards read comfortably at COMPACT_CARD wide: two a row even on a phone. */
  compact: boolean;
}

/** Line limits a card is judged by. */
export interface CardMeasure {
  /** A card's horizontal padding, both sides (rem). */
  padding: number;
  /** Body text size (rem); a full-width character is about this wide. */
  fontSize: number;
  maxTitleLines: number;
  maxBodyLines: number;
  /** Most top-level blocks in a card's body. */
  maxBlocks: number;
}

/**
 * The reading measure a row is judged by. Change these to retune `auto`;
 * the stylesheet's breakpoints are derived from the same card width.
 */
export const CARD_STEPS_ROW = {
  /** Most cards in one row. */
  maxColumns: 4,
  /** Width of the article column (rem). */
  width: 44,
  /** Gap between cards in a row (rem), wide enough for the connector. */
  gap: 1.75,
  /** A card's horizontal padding, both sides (rem). */
  padding: 2.25,
  /** Body text size (rem); a full-width character is about this wide. */
  fontSize: 0.875,
  /** Most body lines a row card should hold. */
  maxBodyLines: 4,
  /** Most title lines a row card should hold. */
  maxTitleLines: 2,
  /** Most top-level blocks in a row card's body. */
  maxBlocks: 2,
} as const;

/**
 * The narrowest card worth laying out side by side (rem): two of them and a
 * gap fit a 360px phone. styles/doc-card-steps.css and styles/doc-card.css
 * hold the matching widths.
 */
export const COMPACT_CARD = 9;

/** How Cards judges its cards. */
export const CARDS_GRID = {
  padding: 2.25,
  fontSize: 0.875,
  maxTitleLines: 2,
  maxBodyLines: 3,
  maxBlocks: 1,
  /** Narrowest and widest a card may shrink to before the grid drops a column (rem). */
  minWidth: COMPACT_CARD,
  maxWidth: 15,
} as const satisfies CardMeasure & { minWidth: number; maxWidth: number };

/** Full-width characters per line in a row card, with `columns` cards a row. */
export function charactersPerLine(columns: number, row = CARD_STEPS_ROW): number {
  const card = (row.width - (columns - 1) * row.gap) / columns - row.padding;
  return Math.max(card / row.fontSize, 1);
}

/** Cards per row for `count` steps: all in one row up to the maximum, else balanced rows (5 → 3 + 2, 7 → 4 + 3). */
export function rowColumns(count: number, max: number = CARD_STEPS_ROW.maxColumns): number {
  if (count <= max) return Math.max(count, 1);
  const rows = Math.ceil(count / max);
  return Math.ceil(count / rows);
}

/** Cards a row can hold, as given by an author: 2 to the maximum. */
export function clampColumns(columns: number, max: number = CARD_STEPS_ROW.maxColumns): number {
  return Math.min(Math.max(Math.round(columns), 2), max);
}

/* ------------------------------------------------------------------------ */
/* Measuring content                                                         */
/* ------------------------------------------------------------------------ */

/**
 * Width of text in full-width characters: CJK, kana, Hangul and full-width
 * forms count 1, other letters and digits about half, spaces less.
 */
export function textWidth(text: string): number {
  let width = 0;
  for (const character of text) {
    if (/\s/u.test(character)) width += 0.3;
    else if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}　-〿＀-￯]/u.test(character)) width += 1;
    else width += 0.55;
  }
  return width;
}

/** Pre-rendered HTML (formulas from lib/mdx/rehype-katex-html.ts) read as its text. */
function innerHtmlText(props: Record<string, unknown>): string {
  const html = (props.dangerouslySetInnerHTML as { __html?: unknown } | undefined)?.__html;
  return typeof html === 'string' ? html.replace(/<[^>]*>/gu, '').replace(/&[#\w]+;/gu, ' ') : '';
}

const WIDE_TAGS = new Set(['pre', 'table', 'figure', 'iframe', 'video']);
const WIDE_CLASSES = /\b(shiki|katex-display|math-display)\b/u;

/** Content that keeps its own width: code blocks, tables, media, display math. */
function isWide(node: ReactElement): boolean {
  if (typeof node.type === 'string' && WIDE_TAGS.has(node.type)) return true;
  const className = propsOf(node).className;
  return typeof className === 'string' && WIDE_CLASSES.test(className);
}

/** Visible text width and wide content anywhere inside a node tree. */
export function measureNode(node: ReactNode): { width: number; wide: boolean } {
  if (node === null || node === undefined || typeof node === 'boolean') return { width: 0, wide: false };
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') {
    return { width: textWidth(String(node)), wide: false };
  }
  if (Array.isArray(node)) return sum(node.map(measureNode));
  if (isValidElement(node)) {
    const props = propsOf(node);
    const inner = props.dangerouslySetInnerHTML
      ? { width: textWidth(innerHtmlText(props)), wide: false }
      : measureNode(props.children as ReactNode);
    return { width: inner.width, wide: inner.wide || isWide(node) };
  }
  return { width: 0, wide: false };
}

function sum(parts: { width: number; wide: boolean }[]) {
  return parts.reduce((total, part) => ({ width: total.width + part.width, wide: total.wide || part.wide }), {
    width: 0,
    wide: false,
  });
}

/** Metrics for one card or step from its props (`title`, `description`, `children`). */
export function measureCard(props: { title?: ReactNode; description?: ReactNode; children?: ReactNode }): CardMetrics {
  const title = measureNode(props.title);
  const description = measureNode(props.description);
  const body = measureNode(props.children);
  return {
    title: title.width,
    body: description.width + body.width,
    blocks: topLevelElements(props.children).length,
    wide: title.wide || description.wide || body.wide,
  };
}

/* ------------------------------------------------------------------------ */
/* Choosing the layout                                                       */
/* ------------------------------------------------------------------------ */

/**
 * Width (rem) of the narrowest card that holds every item within the line
 * limits; Infinity when an item keeps its own width or has too many blocks.
 */
export function cardWidth(items: CardMetrics[], limits: CardMeasure = CARD_STEPS_ROW): number {
  let line = 0;
  for (const item of items) {
    if (item.wide || item.blocks > limits.maxBlocks) return Infinity;
    line = Math.max(line, item.title / limits.maxTitleLines, item.body / limits.maxBodyLines);
  }
  return line * limits.fontSize + limits.padding;
}

/** Narrowest a card in Cards may get (rem, in quarter steps): as narrow as its content allows, 9–15rem. */
export function cardsMinWidth(items: CardMetrics[], grid = CARDS_GRID): number {
  if (items.length === 0) return grid.maxWidth;
  const width = Math.min(Math.max(cardWidth(items, grid), grid.minWidth), grid.maxWidth);
  return Math.ceil(width * 4) / 4;
}

/** Whether a step reads comfortably in a row card, with `columns` cards a row. */
export function fitsRow(step: CardMetrics, columns: number, row = CARD_STEPS_ROW): boolean {
  const line = charactersPerLine(columns, row);
  return (
    !step.wide &&
    step.blocks <= row.maxBlocks &&
    step.title <= line * row.maxTitleLines &&
    step.body <= line * row.maxBodyLines
  );
}

export interface CardStepsLayoutOptions {
  layout?: CardStepsLayoutOption;
  /** Cards per row for a row layout (2–4); chosen from the step count by default. */
  columns?: number;
}

/**
 * Row or column for a list of steps. An explicit layout wins; `auto` tries a
 * full row first, then (for an even count above two) two a row, and stacks
 * the steps when neither reads comfortably.
 */
export function resolveCardStepsLayout(
  steps: CardMetrics[],
  { layout = 'auto', columns }: CardStepsLayoutOptions = {},
): ResolvedCardStepsLayout {
  const count = steps.length;
  const stacked = { layout: 'column', columns: 1, compact: false } as const;
  const row = (cards: number): ResolvedCardStepsLayout => ({
    layout: 'row',
    columns: cards,
    compact: cardWidth(steps) <= COMPACT_CARD,
  });
  if (layout === 'column') return stacked;
  if (layout === 'row') return row(clampColumns(columns ?? rowColumns(count)));
  if (count < 2) return stacked;

  const candidates = columns !== undefined
    ? [clampColumns(columns)]
    : [rowColumns(count), ...(count > 2 && count % 2 === 0 ? [2] : [])];
  for (const candidate of new Set(candidates)) {
    if (steps.every((step) => fitsRow(step, candidate))) return row(candidate);
  }
  return stacked;
}
