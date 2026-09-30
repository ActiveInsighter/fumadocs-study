'use client';

import type { MindMapStatus } from '@/components/mdx/mind-map-hook';
import {
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Scan,
} from 'lucide-react';

interface MindMapToolbarProps {
  status: MindMapStatus;
  isFullscreen: boolean;
  fullscreenSupported: boolean;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleFullscreen: () => void;
}

export function MindMapToolbar({
  status,
  isFullscreen,
  fullscreenSupported,
  onFit,
  onZoomIn,
  onZoomOut,
  onToggleFullscreen,
}: MindMapToolbarProps) {
  const disabled = status !== 'ready';

  return (
    <div className="mind-map-toolbar" role="toolbar" aria-label="思维导图工具">
      <button
        type="button"
        className="mind-map-button"
        onClick={onZoomIn}
        disabled={disabled}
        title="放大"
        aria-label="放大"
      >
        <Plus aria-hidden="true" />
      </button>
      <button
        type="button"
        className="mind-map-button"
        onClick={onZoomOut}
        disabled={disabled}
        title="缩小"
        aria-label="缩小"
      >
        <Minus aria-hidden="true" />
      </button>
      <button
        type="button"
        className="mind-map-button"
        onClick={onFit}
        disabled={disabled}
        title="适应窗口"
        aria-label="适应窗口"
      >
        <Scan aria-hidden="true" />
      </button>
      <span className="mind-map-toolbar-separator" aria-hidden="true" />
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
      </button>
    </div>
  );
}
