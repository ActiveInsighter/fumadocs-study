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
  /** Visible label used by assistive technologies. */
  title?: string;
  /** CSS height, or a number interpreted as pixels. */
  height?: number | string;
  /** Heading depth shown on first render. Omit to use level 3; `-1` expands every level. */
  initialExpandLevel?: number;
  /** Maximum width of a node label before it wraps. */
  maxWidth?: number;
  className?: string;
}

export function MindMap({
  markdown,
  title = '思维导图',
  height = 'clamp(22rem, 62vh, 38rem)',
  initialExpandLevel,
  maxWidth = 280,
  className,
}: MindMapProps) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLElement>(null);
  const rawId = useId();
  const id = rawId.replaceAll(':', '');
  const descriptionId = `mind-map-description-${id}`;
  const {
    collapseAll,
    errorMessage,
    expandAll,
    fitMap,
    status,
    svgRef: mindMapSvgRef,
    zoomIn,
    zoomOut,
  } = useMindMap({
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

        <MindMapToolbar
          status={status}
          isFullscreen={isFullscreen}
          fullscreenSupported={fullscreenSupported}
          onFit={fitMap}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onToggleFullscreen={toggleFullscreen}
        />
      </div>

      <p id={descriptionId} className="mind-map-sr-only">
        滚轮缩放，拖动平移，点击节点圆点展开或收起；右下角工具栏可放大、缩小、适应窗口、全部展开、全部折叠和全屏查看。
      </p>
    </figure>
  );
}
