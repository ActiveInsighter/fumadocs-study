'use client';

import type { MindMapStatus } from '@/components/mdx/mind-map-hook';
import { Maximize2, Minimize2, Scan } from 'lucide-react';

interface MindMapToolbarProps {
  title: string;
  status: MindMapStatus;
  isFullscreen: boolean;
  fullscreenSupported: boolean;
  onFit: () => void;
  onToggleFullscreen: () => void;
}

export function MindMapToolbar({
  title,
  status,
  isFullscreen,
  fullscreenSupported,
  onFit,
  onToggleFullscreen,
}: MindMapToolbarProps) {
  return (
    <figcaption className="mind-map-toolbar">
      <span className="mind-map-title">{title}</span>
      <div className="mind-map-actions" aria-label="思维导图工具">
        <button
          type="button"
          className="mind-map-button"
          onClick={onFit}
          disabled={status !== 'ready'}
          title="适应窗口"
          aria-label="适应窗口"
        >
          <Scan aria-hidden="true" />
          <span className="mind-map-button-label">适应窗口</span>
        </button>
        <button
          type="button"
          className="mind-map-button"
          onClick={onToggleFullscreen}
          disabled={!fullscreenSupported}
          title={isFullscreen ? '退出全屏' : '全屏查看'}
          aria-label={isFullscreen ? '退出全屏' : '全屏查看'}
          aria-pressed={isFullscreen}
        >
          {isFullscreen ? (
            <Minimize2 aria-hidden="true" />
          ) : (
            <Maximize2 aria-hidden="true" />
          )}
          <span className="mind-map-button-label">
            {isFullscreen ? '退出全屏' : '全屏查看'}
          </span>
        </button>
      </div>
    </figcaption>
  );
}
