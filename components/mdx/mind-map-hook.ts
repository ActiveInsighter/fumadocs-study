'use client';

import type { Markmap } from 'markmap-view';
import katex from 'katex';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

const EMPTY_MESSAGE = '思维导图内容为空。请补充至少一个标题。';
const RENDER_ERROR_MESSAGE = '思维导图暂时无法生成，请检查 Markdown 的层级结构。';

export type MindMapStatus = 'loading' | 'ready' | 'error';

interface UseMindMapOptions {
  markdown: string;
  initialExpandLevel?: number;
  maxWidth: number;
}

function enhanceInteractiveNodes(svg: SVGSVGElement) {
  svg
    .querySelectorAll<SVGCircleElement>('g.markmap-node > circle')
    .forEach((circle) => {
      const label = circle.parentElement
        ?.querySelector<SVGForeignObjectElement>('foreignObject')
        ?.textContent?.trim();

      circle.setAttribute('tabindex', '0');
      circle.setAttribute('role', 'button');
      circle.setAttribute(
        'aria-expanded',
        String(!circle.parentElement?.classList.contains('markmap-fold')),
      );
      circle.setAttribute(
        'aria-label',
        label ? `${label}，展开或收起分支` : '展开或收起分支',
      );
    });
}

export function useMindMap({
  markdown,
  initialExpandLevel,
  maxWidth,
}: UseMindMapOptions) {
  const svgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null);
  const hasMarkdown = markdown.trim().length > 0;
  const [status, setStatus] = useState<MindMapStatus>(
    hasMarkdown ? 'loading' : 'error',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(
    hasMarkdown ? null : EMPTY_MESSAGE,
  );

  useEffect(() => {
    let cancelled = false;
    const svg = svgRef.current;
    const previousMarkmap = markmapRef.current;
    let nodeObserver: MutationObserver | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let resizeFrame: number | undefined;

    const handleNodeKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        !(target instanceof Element) ||
        !target.matches('circle[role="button"]')
      ) {
        return;
      }
      if (event.key !== 'Enter' && event.key !== ' ') return;

      event.preventDefault();
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    };

    previousMarkmap?.destroy();
    markmapRef.current = null;
    svg?.replaceChildren();

    if (!markdown.trim()) {
      setStatus('error');
      setErrorMessage(EMPTY_MESSAGE);
      return () => {
        cancelled = true;
      };
    }

    setStatus('loading');
    setErrorMessage(null);

    async function renderMindMap() {
      try {
        const [{ Transformer }, { Markmap }] = await Promise.all([
          import('markmap-lib'),
          import('markmap-view'),
        ]);

        if (cancelled || !svg) return;

        Object.assign(window, { katex });

        const transformer = new Transformer();
        const { root } = transformer.transform(markdown.trim());
        const prefersReducedMotion =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const resolvedExpandLevel = initialExpandLevel ?? 3;
        const instance = new Markmap(svg, {
          autoFit: false,
          duration: prefersReducedMotion ? 0 : 250,
          fitRatio: 0.92,
          initialExpandLevel: resolvedExpandLevel,
          maxInitialScale: 1.2,
          maxWidth,
          nodeMinHeight: 18,
          pan: true,
          spacingHorizontal: 72,
          spacingVertical: 8,
          zoom: true,
        });

        markmapRef.current = instance;
        await instance.setData(root);

        if (cancelled) {
          instance.destroy();
          return;
        }

        enhanceInteractiveNodes(svg);
        nodeObserver = new MutationObserver(() => enhanceInteractiveNodes(svg));
        nodeObserver.observe(svg, {
          attributes: true,
          attributeFilter: ['class'],
          childList: true,
          subtree: true,
        });
        svg.addEventListener('keydown', handleNodeKeyDown);

        await instance.fit(1.2);

        const resizeTarget = svg.parentElement ?? svg;
        let previousWidth = resizeTarget.clientWidth;
        let previousHeight = resizeTarget.clientHeight;

        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(([entry]) => {
            if (!entry || cancelled || markmapRef.current !== instance) return;

            const { width, height } = entry.contentRect;
            const sizeChanged =
              Math.abs(width - previousWidth) > 8 ||
              Math.abs(height - previousHeight) > 8;

            previousWidth = width;
            previousHeight = height;

            if (!sizeChanged) return;
            if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);

            resizeFrame = requestAnimationFrame(() => {
              if (!cancelled && markmapRef.current === instance) {
                void instance.fit(1.2);
              }
            });
          });
          resizeObserver.observe(resizeTarget);
        }

        if (!cancelled) setStatus('ready');
      } catch {
        if (cancelled) return;

        markmapRef.current?.destroy();
        markmapRef.current = null;
        svg?.replaceChildren();
        setStatus('error');
        setErrorMessage(RENDER_ERROR_MESSAGE);
      }
    }

    void renderMindMap();

    return () => {
      cancelled = true;
      nodeObserver?.disconnect();
      resizeObserver?.disconnect();
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
      svg?.removeEventListener('keydown', handleNodeKeyDown);
      markmapRef.current?.destroy();
      markmapRef.current = null;
      svg?.replaceChildren();
    };
  }, [initialExpandLevel, markdown, maxWidth]);

  const fitMap = useCallback(() => {
    const instance = markmapRef.current;
    if (instance) void instance.fit(1.2);
  }, []);

  const zoomIn = useCallback(() => {
    const instance = markmapRef.current;
    if (instance) void instance.rescale(1.25);
  }, []);

  const zoomOut = useCallback(() => {
    const instance = markmapRef.current;
    if (instance) void instance.rescale(0.8);
  }, []);

  const expandAll = useCallback(async () => {
    const instance = markmapRef.current;
    const root = instance?.state.data;
    if (!instance || !root) return;

    root.payload = { ...root.payload, fold: 1 };
    await instance.toggleNode(root, true);
    await instance.fit(1.2);
  }, []);

  const collapseAll = useCallback(async () => {
    const instance = markmapRef.current;
    const root = instance?.state.data;
    if (!instance || !root) return;

    root.payload = { ...root.payload, fold: 0 };
    await instance.toggleNode(root, true);
    await instance.fit(1.2);
  }, []);

  return {
    collapseAll,
    errorMessage,
    expandAll,
    fitMap,
    status,
    svgRef,
    zoomIn,
    zoomOut,
  };
}
