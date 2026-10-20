'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';

export type ElementSize = { width: number; height: number };

/**
 * Tracks an element's content box. Scenes that draw SVG in pixel space use it
 * so strokes and arrowheads keep their proportions at every container width.
 * Returns 0×0 during server rendering; scenes render their frame only then.
 */
export function useElementSize<T extends HTMLElement>(ref: RefObject<T | null>): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const update = () => {
      const width = node.clientWidth;
      const height = node.clientHeight;
      setSize((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height },
      );
    };

    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
