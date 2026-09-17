'use client';

import { cn } from '@/lib/utils';
import { useMindMap } from '@/components/mdx/mind-map-hook';
import { MindMapToolbar } from '@/components/mdx/mind-map-toolbar';
import { useTheme } from 'next-themes';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

export interface MindMapProps {
  /** Markdown headings and list items used to build the tree. */
  markdown: string;
  /** Visible label used by the toolbar and assistive technologies. */
  title?: string;
  /** CSS height, or a number interpreted as pixels. */
  height?: number | string;
  /** Heading depth shown on first render. `-1` expands every level. */
  initialExpandLevel?: number;
  /** Maximum width of a node label before it wraps. */
  maxWidth?: number;
  className?: string;
}

export function MindMap({
  markdown,
  title = '思维导图',
  height = 'clamp(20rem, 58vw, 30rem)',
  initialExpandLevel = 2,
  maxWidth = 280,
  className,
}: MindMapProps) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLElement>(null);
  const rawId = useId();
  const id = rawId.replaceAll(':', '');
  const descriptionId = `mind-map-description-${id}`;
  const { errorMessage, fitMap, status, svgRef: mindMapSvgRef } = useMindMap({
    markdown,
    initialExpandLevel,
    maxWidth,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);

  useEffect(() => {
    setFullscreenSupported(
      typeof document.documentElement.requestFullscreen === 'function',
    );

    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container || !fullscreenSupported) return;

    try {
      if (document.fullscreenElement === container) {
        await document.exitFullscreen();
      } else {
        await container.requestFullscreen();
      }
    } catch {
      // Fullscreen can be denied by the browser or an embedded host.
    }
  }, [fullscreenSupported]);

  const heightValue = typeof height === 'number' ? `${height}px` : height;

  return (
    <figure
      ref={containerRef}
      className={cn(
        'mind-map not-prose',
        resolvedTheme === 'dark' && 'markmap-dark',
        className,
      )}
      data-mind-map="true"
      data-status={status}
      style={{ '--mind-map-height': heightValue } as CSSProperties}
    >
      <MindMapToolbar
        title={title}
        status={status}
        isFullscreen={isFullscreen}
        fullscreenSupported={fullscreenSupported}
        onFit={fitMap}
        onToggleFullscreen={toggleFullscreen}
      />

      <div
        className="mind-map-stage"
        role="region"
        aria-label={title}
        aria-describedby={descriptionId}
        aria-busy={status === 'loading'}
      >
        <svg
          ref={mindMapSvgRef}
          id={`mind-map-svg-${id}`}
          className="mind-map-svg"
          role="img"
          aria-label={title}
        />
        {status === 'loading' && (
          <div className="mind-map-status" role="status">
            正在生成思维导图…
          </div>
        )}
        {status === 'error' && (
          <div className="mind-map-status mind-map-status-error" role="alert">
            {errorMessage}
          </div>
        )}
      </div>

      <p id={descriptionId} className="mind-map-hint">
        滚轮缩放 · 拖动平移 · 点击节点圆点展开或收起
      </p>
    </figure>
  );
}
