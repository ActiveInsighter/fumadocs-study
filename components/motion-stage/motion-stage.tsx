'use client';

import { LayoutGroup, MotionConfig, useInView } from 'motion/react';
import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { StageControls } from './stage-controls';
import { StageNarration } from './stage-narration';
import { StageCode, StageWatch } from './stage-panels';
import { StageProvider, useStage } from './stage-context';
import type { StageStep } from './types';

export type MotionStageProps = {
  /** Heading shown above the canvas. */
  title?: string;
  /** One-line summary under the title. */
  description?: string;
  /** The timeline. Each entry is one step; scenes react to its index. */
  steps: StageStep[];
  /**
   * Optional pseudo-code / source shown beside the canvas; see StageStep.lines.
   * Pass an array of lines in MDX: MDX strips the indentation of continuation
   * lines inside JSX attributes, so a multi-line template literal loses it.
   */
  code?: string | string[];
  /** Label of the code panel, e.g. "伪代码" or "C". */
  codeTitle?: string;
  /** Start playing when the stage scrolls into view. */
  autoPlay?: boolean;
  /** Jump back to the first step after the last one while playing. */
  loop?: boolean;
  initialStep?: number;
  /** Minimum canvas height (CSS length or px). */
  minHeight?: number | string;
  /**
   * Where the code / watch panel sits on wide containers. Defaults to "right"
   * when there is code, otherwise "bottom" (a watch-only panel reads better
   * as a row under the scene).
   */
  aside?: 'right' | 'bottom';
  className?: string;
  canvasClassName?: string;
  /** Scene content: any scene components, primitives or plain markup. */
  children: ReactNode;
};

/**
 * The stage: a step timeline with playback, narration, an optional code and
 * watch panel, and a canvas for any scene content. Everything inside reads
 * the current step through useStage(), so new knowledge demos only describe
 * what each step looks like; the stage handles time, input and layout.
 */
export function MotionStage({
  title,
  description,
  steps,
  code,
  codeTitle,
  autoPlay = false,
  loop = false,
  initialStep = 0,
  minHeight,
  aside,
  className,
  canvasClassName,
  children,
}: MotionStageProps) {
  const root = useRef<HTMLElement>(null);
  const inView = useInView(root, { amount: 0.35 });

  return (
    <MotionConfig reducedMotion="user">
      <StageProvider steps={steps} initialStep={initialStep} loop={loop} autoPlay={autoPlay} active={inView}>
        <StageFrame
          rootRef={root}
          title={title}
          description={description}
          code={code}
          codeTitle={codeTitle}
          minHeight={minHeight}
          aside={aside}
          className={className}
          canvasClassName={canvasClassName}
        >
          {children}
        </StageFrame>
      </StageProvider>
    </MotionConfig>
  );
}

type StageFrameProps = Omit<MotionStageProps, 'steps' | 'autoPlay' | 'loop' | 'initialStep'> & {
  rootRef: React.RefObject<HTMLElement | null>;
};

function StageFrame({
  rootRef,
  title,
  description,
  code,
  codeTitle,
  minHeight,
  aside,
  className,
  canvasClassName,
  children,
}: StageFrameProps) {
  const stage = useStage();
  const hasWatch = stage.steps.some((step) => step.vars && Object.keys(step.vars).length > 0);
  const hasAside = Boolean(code) || hasWatch;
  const sideBySide = hasAside && (aside ?? (code ? 'right' : 'bottom')) === 'right';

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const onSelf = event.target === event.currentTarget;
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        stage.pause();
        stage.next();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        stage.prev();
        break;
      case 'Home':
        event.preventDefault();
        stage.reset();
        break;
      case 'End':
        event.preventDefault();
        stage.pause();
        stage.goTo(stage.total - 1);
        break;
      case ' ':
      case 'k':
        // Space on a focused button already clicks it.
        if (!onSelf) return;
        event.preventDefault();
        stage.toggle();
        break;
    }
  };

  const canvasStyle: CSSProperties | undefined =
    minHeight === undefined ? undefined : { minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight };

  return (
    <section
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-roledescription="动画演示"
      aria-label={title ?? '动画演示'}
      className={cn(
        'motion-stage not-prose @container/stage my-7 overflow-hidden rounded-[var(--ui-radius-panel)] border border-[var(--stage-line)] bg-background text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
    >
      {(title || description) && (
        <header className="flex flex-col gap-0.5 px-4 pt-3.5 pb-3 @2xl/stage:px-5">
          {title && <h3 className="m-0 text-base font-semibold leading-snug tracking-tight">{title}</h3>}
          {description && <p className="m-0 text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </header>
      )}

      <div
        className={cn(
          'grid gap-3 px-3 @2xl/stage:px-4',
          !title && !description && 'pt-3 @2xl/stage:pt-4',
          sideBySide && '@2xl/stage:grid-cols-[minmax(0,1fr)_minmax(15rem,20rem)]',
        )}
      >
        <LayoutGroup id={stage.id}>
          <div
            className={cn(
              'motion-stage-canvas relative isolate flex min-h-56 min-w-0 flex-col justify-center overflow-hidden rounded-[var(--ui-radius-surface)] p-4 @2xl/stage:p-6',
              canvasClassName,
            )}
            style={canvasStyle}
          >
            {children}
          </div>
        </LayoutGroup>

        {hasAside && (
          <div className={cn('flex min-w-0 flex-col gap-3', !sideBySide && code && hasWatch && '@2xl/stage:grid @2xl/stage:grid-cols-2')}>
            {code && <StageCode code={code} title={codeTitle} />}
            {hasWatch && <StageWatch />}
          </div>
        )}
      </div>

      <StageNarration />
      <StageControls />
    </section>
  );
}
