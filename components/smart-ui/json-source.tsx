'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatSpecJson, tokenizeJson, type JsonTokenType } from '@/lib/smart-ui/format-json';

// Monochrome ramp: structure recedes, keys and values carry the contrast.
const TOKEN_CLASS: Record<JsonTokenType, string> = {
  key: 'text-foreground',
  string: 'text-foreground/70',
  number: 'text-foreground underline decoration-foreground/25 underline-offset-4',
  literal: 'font-medium text-foreground',
  punctuation: 'text-muted-foreground',
  space: '',
};

/** Read-only JSON viewer that shares the docs code surface (`--docs-code-block-background`). */
export function JsonSource({ code }: { code: string }) {
  const text = useMemo(() => formatSpecJson(code), [code]);
  const tokens = useMemo(() => tokenizeJson(text), [text]);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be denied; the code stays selectable.
    }
  }

  return (
    <div data-slot="smart-ui-source" className="relative bg-(--docs-code-block-background)">
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? '已复制 JSON' : '复制 JSON'}
        className="absolute top-2.5 right-3 z-10 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
      </button>
      <pre
        tabIndex={0}
        aria-label="json-render 源码"
        className="m-0 max-h-[26rem] overflow-auto px-5 py-4 pr-12 font-mono text-[0.8125rem] leading-[1.7] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
      >
        <code className="block w-max min-w-full whitespace-pre">
          {tokens.map((token, index) => (
            <span key={index} className={cn(TOKEN_CLASS[token.type])}>{token.text}</span>
          ))}
        </code>
      </pre>
    </div>
  );
}
