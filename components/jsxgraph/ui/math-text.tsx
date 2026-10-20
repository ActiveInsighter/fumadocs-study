'use client';

import { useEffect, useState } from 'react';
import styles from './jsxgraph.module.css';

type Render = (tex: string, options: { throwOnError: boolean; displayMode: boolean; output: 'html' }) => string;
let katexLoader: Promise<Render> | null = null;

/** KaTeX is loaded on demand, like JSXGraph; its CSS is global on the site. */
export function MathText({ tex, display = false, label }: { tex: string; display?: boolean; label?: string }) {
  const [render, setRender] = useState<Render | null>(null);
  useEffect(() => {
    let live = true;
    katexLoader ??= import('katex').then((module) => module.default.renderToString as Render);
    katexLoader.then((next) => { if (live) setRender(() => next); }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  const html = render?.(tex, { throwOnError: false, displayMode: display, output: 'html' });
  return <div className={styles.math} role="math" aria-label={label ?? tex}>
    {html ? <span dangerouslySetInnerHTML={{ __html: html }} /> : <code className={styles.mono}>{tex}</code>}
  </div>;
}
