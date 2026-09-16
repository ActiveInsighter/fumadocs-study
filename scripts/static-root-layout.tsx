import './global.css';
import 'katex/dist/katex.css';
import './surface-overrides.css';
import './claude-benchmarks.css';
import { SearchProvider } from '@/components/search-provider';
import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';

export const metadata: Metadata = {
  title: {
    default: '考研学习',
    template: '%s | 考研学习',
  },
  description: '按政治、英语、数学与专业课组织的考研学习知识库。',
};

/*
 * This file is copied over app/layout.tsx in the isolated static build stage
 * (see scripts/build-static-docs.mjs), so it is a second implementation of the
 * same root layout. next/font is unavailable there, which is why the families
 * are declared by hand instead of via next/font/google.
 *
 * Keep the CSS variable names and `metadata` below in sync with app/layout.tsx:
 * any drift ships a different look on the static deployment than in dev.
 */
const fontVariables = {
  '--font-inter': "'Inter', 'Arial'",
  '--font-source-serif': "'Source Serif 4', Georgia",
} as CSSProperties;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" style={fontVariables} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col font-sans" suppressHydrationWarning>
        <SearchProvider>{children}</SearchProvider>
      </body>
    </html>
  );
}
