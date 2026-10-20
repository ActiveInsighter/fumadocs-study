'use client';

import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useStage } from './stage-context';

/** Transport buttons, the clickable step timeline and the speed switch. */
export function StageControls({ className }: { className?: string }) {
  const stage = useStage();

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2.5 border-t border-[var(--stage-line)] px-3 py-2.5 @2xl/stage:flex-nowrap @2xl/stage:px-4',
        className,
      )}
    >
      <StageTimeline className="order-first basis-full @2xl/stage:order-none @2xl/stage:basis-auto" />

      <div className="flex items-center gap-1 @2xl/stage:order-first">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="重新开始"
          title="重新开始 (Home)"
          onClick={stage.reset}
          disabled={stage.isFirst && !stage.playing}
        >
          <RotateCcw />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="上一步"
          title="上一步 (←)"
          onClick={stage.prev}
          disabled={stage.isFirst}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="default"
          size="sm"
          className="min-w-[4.75rem] rounded-full"
          aria-label={stage.playing ? '暂停' : '播放'}
          title={stage.playing ? '暂停 (空格)' : '播放 (空格)'}
          onClick={stage.toggle}
        >
          {stage.playing ? <Pause className="fill-current" /> : <Play className="fill-current" />}
          <span>{stage.playing ? '暂停' : stage.isLast && stage.total > 1 ? '重播' : '播放'}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="下一步"
          title="下一步 (→)"
          onClick={() => {
            stage.pause();
            stage.next();
          }}
          disabled={stage.isLast}
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-live="off">
          {stage.step + 1}
          <span className="opacity-50"> / {stage.total}</span>
        </span>
        <Button
          variant="secondary"
          size="xs"
          className="min-w-11 rounded-full font-mono tabular-nums"
          aria-label={`播放速度 ${stage.speed} 倍，点击切换`}
          title="切换播放速度"
          onClick={stage.cycleSpeed}
        >
          {stage.speed}×
        </Button>
      </div>
    </div>
  );
}

/**
 * One segment per step. Past steps are filled, the current one fills over its
 * dwell time while playing, so the timeline doubles as a progress bar.
 */
function StageTimeline({ className }: { className?: string }) {
  const stage = useStage();

  return (
    <div className={cn('flex min-w-0 flex-1 items-center gap-1', className)} role="group" aria-label="步骤进度">
      {stage.steps.map((step, index) => {
        const state = index < stage.step ? 'past' : index === stage.step ? 'current' : 'future';
        return (
          <button
            key={index}
            type="button"
            onClick={() => {
              stage.pause();
              stage.goTo(index);
            }}
            title={`${index + 1}. ${step.title}`}
            aria-label={`跳到第 ${index + 1} 步：${step.title}`}
            aria-current={state === 'current' ? 'step' : undefined}
            className="group/segment relative flex h-6 min-w-0 flex-1 cursor-pointer items-center outline-none"
          >
            <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-[var(--stage-track)] transition-[height] duration-150 group-hover/segment:h-2 group-focus-visible/segment:ring-2 group-focus-visible/segment:ring-ring/60">
              {state === 'past' && <span className="absolute inset-0 rounded-full bg-[var(--stage-progress)]" />}
              {state === 'current' && (
                <motion.span
                  key={`${stage.epoch}-${stage.playing}`}
                  className="absolute inset-y-0 left-0 rounded-full bg-[var(--stage-progress)]"
                  initial={{ width: stage.playing ? '0%' : '100%' }}
                  animate={{ width: '100%' }}
                  transition={
                    stage.playing
                      ? { duration: stage.dwell / 1000, ease: 'linear' }
                      : { duration: 0 }
                  }
                />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
