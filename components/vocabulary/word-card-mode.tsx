'use client';

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { prefersReducedMotion } from './reduced-motion';

export type WordCardMode = 'compact' | 'dictation' | 'translation' | 'full';

const MODE_OPTIONS = [
  ['compact', '精简'],
  ['dictation', '默写'],
  ['translation', '翻译'],
  ['full', '完整'],
] as const satisfies readonly (readonly [WordCardMode, string])[];

/** One site-wide preference: the last chosen display mode survives reloads. */
export const WORD_CARD_MODE_STORAGE_KEY = 'fumadocs-study:word-card-mode';

function isWordCardMode(value: unknown): value is WordCardMode {
  return MODE_OPTIONS.some(([mode]) => mode === value);
}

// Storage can throw (privacy mode, disabled cookies); the preference is optional.
export function readStoredMode() {
  try {
    const value = window.localStorage.getItem(WORD_CARD_MODE_STORAGE_KEY);
    return isWordCardMode(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeMode(mode: WordCardMode) {
  try {
    window.localStorage.setItem(WORD_CARD_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore: the mode still applies for this page view.
  }
}

type WordCardsContextValue = {
  mode: WordCardMode;
  setMode: (mode: WordCardMode) => void;
};

const WordCardsContext = createContext<WordCardsContextValue | null>(null);

export function useWordCardMode() {
  return useContext(WordCardsContext)?.mode ?? 'full';
}

export function WordCardsProvider({ children, defaultMode = 'full' }: { children: ReactNode; defaultMode?: WordCardMode }) {
  const [mode, setModeState] = useState<WordCardMode>(defaultMode);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // The server always renders the default; restore the saved mode before the
  // first client paint after hydration.
  useLayoutEffect(() => {
    const storedMode = readStoredMode();
    if (storedMode) setModeState(storedMode);
  }, []);

  const setMode = useCallback((nextMode: WordCardMode) => {
    if (nextMode === modeRef.current) return;
    storeMode(nextMode);
    if (typeof document.startViewTransition !== 'function' || prefersReducedMotion()) {
      setModeState(nextMode);
      return;
    }
    // Cross-fade the layout change; the attribute scopes the custom
    // view-transition timing to word-card mode switches only.
    const root = document.documentElement;
    root.setAttribute('data-wc-mode-transition', '');
    const transition = document.startViewTransition(() => {
      flushSync(() => setModeState(nextMode));
    });
    transition.finished.finally(() => root.removeAttribute('data-wc-mode-transition'));
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <WordCardsContext.Provider value={value}>{children}</WordCardsContext.Provider>;
}

export function WordCardModeToggle() {
  const context = useContext(WordCardsContext);
  if (!context) return null;
  const activeIndex = MODE_OPTIONS.findIndex(([mode]) => mode === context.mode);
  return (
    <div className="wc-mode-toggle" aria-label="词汇卡片显示模式">
      <span className="wc-mode-label">显示模式</span>
      <div
        className="wc-mode-segments"
        role="group"
        aria-label="切换词汇卡片显示模式"
        style={{ '--wc-active-index': activeIndex } as CSSProperties}
      >
        <span className="wc-mode-indicator" aria-hidden="true" />
        {MODE_OPTIONS.map(([mode, label]) => {
          const active = context.mode === mode;
          return (
            <button
              key={mode}
              type="button"
              className="wc-mode-button"
              data-active={active}
              aria-pressed={active}
              onClick={() => context.setMode(mode)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
