'use client';

import { useLayoutEffect, useRef } from 'react';

const DEFAULT_GAP = 14;

function getColumnCount(list: HTMLElement) {
  const columns = getComputedStyle(list).gridTemplateColumns.trim();
  if (!columns || columns === 'none') return 1;
  return columns.split(/\s+/u).length;
}

/**
 * Packs compact cards into a masonry layout on a 1px row grid. Each card spans
 * `height + gap` rows, so vertical gaps stay exact instead of drifting by a
 * whole row track.
 *
 * Every change (list width, card height, fonts loading) goes through the same
 * measure pass: read all heights first, then write all spans, at most once per
 * frame. The first pass runs in a layout effect so mode switches, including
 * view-transition snapshots, never paint an unpacked grid.
 */
export function useCompactMasonry(enabled: boolean, itemCount: number) {
  const listRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const cards = Array.from(list.querySelectorAll<HTMLElement>(':scope > .word-card'));

    const reset = () => {
      list.removeAttribute('data-masonry-ready');
      for (const card of cards) card.style.removeProperty('grid-row-end');
    };
    if (!enabled || cards.length === 0) {
      reset();
      return;
    }

    const measure = () => {
      if (getColumnCount(list) <= 1) {
        reset();
        return;
      }
      const rowGap = Number.parseFloat(getComputedStyle(list).getPropertyValue('--wc-masonry-gap')) || DEFAULT_GAP;
      const heights = cards.map((card) => card.getBoundingClientRect().height);
      cards.forEach((card, index) => {
        const nextValue = `span ${Math.max(1, Math.ceil(heights[index] + rowGap))}`;
        if (card.style.gridRowEnd !== nextValue) card.style.gridRowEnd = nextValue;
      });
      list.setAttribute('data-masonry-ready', 'true');
    };

    let frame = 0;
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(list);
    for (const card of cards) observer.observe(card);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      reset();
    };
  }, [enabled, itemCount]);

  return listRef;
}
