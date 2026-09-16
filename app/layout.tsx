import './global.css';
import 'katex/dist/katex.css';
import './surface-overrides.css';
import './claude-benchmarks.css';
import { SearchProvider } from '@/components/search-provider';
import type { Metadata } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import type { ReactNode } from 'react';

/*
 * NOTE: scripts/static-root-layout.tsx is copied over this file in the static
 * build stage, so it is a second implementation of this root layout. Keep the
 * `--font-inter` / `--font-source-serif` variable names and the `metadata`
 * below in sync with it, and make sure both expose the same CSS variables that
 * app/global.css depends on.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const sourceSerif4 = Source_Serif_4({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-source-serif',
});

export const metadata: Metadata = {
  title: {
    default: '考研学习',
    template: '%s | 考研学习',
  },
  description: '按政治、英语、数学与专业课组织的考研学习知识库。',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="zh-CN"
      className={`${inter.variable} ${sourceSerif4.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col font-sans" suppressHydrationWarning>
        <SearchProvider>{children}</SearchProvider>
      </body>
    </html>
  );
}
