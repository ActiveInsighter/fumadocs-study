import './global.css';
import 'katex/dist/katex.css';
import './flat-ui.css';
import './claude-benchmarks.css';
import { SearchProvider } from '@/components/search-provider';
import { getRootMetadata, siteConfig } from '@/lib/site-config';
import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';

export const metadata: Metadata = getRootMetadata();

/*
 * This file is copied over app/layout.tsx in the isolated static build stage
 * (see scripts/build-static-docs.mjs), so it is a second implementation of the
 * same root layout. next/font is unavailable there, which is why the families
 * are declared by hand instead of via next/font/google.
 *
 * Keep the CSS variable names below in sync with app/layout.tsx (metadata is
 * shared through lib/site-config.ts):
 * any drift ships a different look on the static deployment than in dev.
 */
const fontVariables = {
  '--font-inter': "'Inter', 'Arial'",
  '--font-source-serif': "'Source Serif 4', Georgia",
} as CSSProperties;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={siteConfig.lang} style={fontVariables} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col font-sans" suppressHydrationWarning>
        <SearchProvider>{children}</SearchProvider>
      </body>
    </html>
  );
}
