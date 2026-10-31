'use client';

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { WordExample } from './model';

/** Minimum distance kept between a tooltip and the edge of its clipping box. */
const TOOLTIP_EDGE_GAP = 8;

type ClipBox = { top: number; left: number; right: number; bottom: number };

/** The visible box a tooltip must stay in: below an enclosing modal's floating header, or the viewport. */
function clipBox(root: HTMLElement): ClipBox {
  const page = root.closest<HTMLElement>('[data-slot="modal-page"]');
  if (!page) return { top: 0, left: 0, right: document.documentElement.clientWidth, bottom: window.innerHeight };
  const rect = page.getBoundingClientRect();
  const header = page.querySelector<HTMLElement>('[data-slot="modal-header"]');
  return { top: rect.top + (header?.offsetHeight ?? 0), left: rect.left, right: rect.right, bottom: rect.bottom };
}

/**
 * Flips the tooltip below its sentence when there is no room above, and
 * shifts it sideways so it stays inside the clip box.
 */
function placeTooltip(root: HTMLElement, tooltip: HTMLElement) {
  const clip = clipBox(root);
  const anchor = root.getBoundingClientRect();
  // Layout size: the tooltip is still scaled down by its entry transform here.
  const { offsetWidth: width, offsetHeight: height } = tooltip;
  const spaceAbove = anchor.top - clip.top;
  const spaceBelow = clip.bottom - anchor.bottom;
  const placement = spaceAbove < height + TOOLTIP_EDGE_GAP && spaceBelow > spaceAbove ? 'bottom' : 'top';
  const maxLeft = clip.right - TOOLTIP_EDGE_GAP - width;
  const left = Math.max(clip.left + TOOLTIP_EDGE_GAP, Math.min(anchor.left, maxLeft));
  root.dataset.placement = placement;
  root.style.setProperty('--wc-tooltip-shift', `${Math.round(left - anchor.left)}px`);
}

/**
 * An example sentence whose translation shows in a tooltip: on hover for
 * mice, on keyboard focus, and toggled by taps on touch screens.
 */
export function SenseExample({ example }: { example: WordExample }) {
  const tooltipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const pointerTypeRef = useRef('mouse');
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    if (open && rootRef.current && tooltipRef.current) placeTooltip(rootRef.current, tooltipRef.current);
  }, [open]);

  const handleHover = (event: PointerEvent<HTMLSpanElement>, nextOpen: boolean) => {
    if (event.pointerType === 'mouse') setOpen(nextOpen);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Escape' || !open) return;
    // Close only the tooltip; keep an enclosing modal open.
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
  };

  return (
    <span
      ref={rootRef}
      className="wc-example"
      data-open={open}
      onPointerEnter={(event) => handleHover(event, true)}
      onPointerLeave={(event) => handleHover(event, false)}
    >
      <button
        type="button"
        className="wc-example-trigger"
        lang="en"
        aria-describedby={tooltipId}
        aria-expanded={open}
        onPointerDown={(event) => {
          pointerTypeRef.current = event.pointerType;
        }}
        // Mouse users already see the hover tooltip; touch users toggle it.
        onClick={() => setOpen((value) => (pointerTypeRef.current === 'mouse' ? true : !value))}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
      >
        {example.text}
      </button>
      <span ref={tooltipRef} className="wc-example-tooltip" id={tooltipId} role="tooltip" lang="zh-CN">
        {example.translation}
      </span>
    </span>
  );
}
