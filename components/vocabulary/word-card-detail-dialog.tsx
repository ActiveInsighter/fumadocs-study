'use client';

import { useCallback, useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent, type SyntheticEvent } from 'react';
import {
  CloseIcon,
  NextIcon,
  PrevIcon,
  WordCardContent,
  getTone,
  hasPhraseMeaning,
  prefersReducedMotion,
  type WordCardData,
} from './word-card-content';

/** Slightly longer than the 160ms `wc-detail-exit` animation. */
const DIALOG_EXIT_FALLBACK_MS = 220;

type WordCardDetailDialogProps = {
  words: readonly WordCardData[];
  index: number;
  onNavigate: (index: number) => void;
  onClosed: () => void;
};

/**
 * Native modal showing one full card. Page scrolling is locked in CSS through
 * `html:has(.wc-detail-dialog[open])`, so there is no inline style to restore.
 */
export function WordCardDetailDialog({ words, index, onNavigate, onClosed }: WordCardDetailDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const word = words[index];
  const hasPrev = index > 0;
  const hasNext = index < words.length - 1;

  // No cleanup: removing the element already takes it out of the top layer,
  // and a cleanup close() would race a StrictMode re-run with a stale event.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    closeButtonRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (dialogRef.current) dialogRef.current.scrollTop = 0;
  }, [index]);

  const requestClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open || dialog.hasAttribute('data-closing')) return;
    if (prefersReducedMotion()) {
      dialog.close();
      return;
    }
    // Play the exit animation first; getAnimations() only covers the dialog
    // itself, so nested bar animations cannot end the wait early. The timeout
    // guarantees the close even when the browser skips frames (hidden tab).
    dialog.setAttribute('data-closing', 'true');
    const finish = () => dialog.close();
    window.setTimeout(finish, DIALOG_EXIT_FALLBACK_MS);
    Promise.allSettled(dialog.getAnimations().map((animation) => animation.finished)).then(finish);
  }, []);

  const handleClose = (event: SyntheticEvent<HTMLDialogElement>) => {
    // `close` is dispatched asynchronously; ignore it if the dialog reopened since.
    if (!event.currentTarget.open) onClosed();
  };

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    requestClose();
  };

  // Clicks on the ::backdrop are reported on the dialog itself, outside its box.
  const handleClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const insideBox =
      event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!insideBox) requestClose();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'ArrowLeft' && hasPrev) onNavigate(index - 1);
    else if (event.key === 'ArrowRight' && hasNext) onNavigate(index + 1);
    else return;
    event.preventDefault();
  };

  return (
    <dialog
      ref={dialogRef}
      className={`word-card wc-detail-dialog${hasPhraseMeaning(word) ? ' has-phrase' : ''}`}
      data-word={word.word}
      data-tone={getTone(index)}
      aria-label={`${word.word} 完整词汇卡片`}
      onCancel={handleCancel}
      onClose={handleClose}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <WordCardContent
        word={word}
        showSenses
        headerAction={
          <>
            {words.length > 1 ? (
              <span className="wc-detail-nav">
                <button
                  type="button"
                  className="wc-detail-step"
                  aria-label="上一个单词"
                  title="上一个（←）"
                  disabled={!hasPrev}
                  onClick={() => onNavigate(index - 1)}
                >
                  <PrevIcon />
                </button>
                <button
                  type="button"
                  className="wc-detail-step"
                  aria-label="下一个单词"
                  title="下一个（→）"
                  disabled={!hasNext}
                  onClick={() => onNavigate(index + 1)}
                >
                  <NextIcon />
                </button>
              </span>
            ) : null}
            <button
              ref={closeButtonRef}
              type="button"
              className="wc-detail-close"
              aria-label="关闭完整词汇卡片"
              title="关闭（Esc）"
              onClick={requestClose}
            >
              <CloseIcon />
            </button>
          </>
        }
      />
    </dialog>
  );
}
