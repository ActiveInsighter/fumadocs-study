import './global.css';
import 'katex/dist/katex.css';
import './flat-ui.css';
import './claude-benchmarks.css';
import { SearchProvider } from '@/components/search-provider';
import { getRootMetadata, siteConfig } from '@/lib/site-config';
import type { Metadata } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import type { ReactNode } from 'react';

/*
 * NOTE: scripts/static-root-layout.tsx is copied over this file in the static
 * build stage, so it is a second implementation of this root layout. Keep the
 * `--font-inter` / `--font-source-serif` variable names and the stylesheet
 * imports in sync with it, and make sure both expose the same CSS variables
 * that app/global.css depends on. Metadata is shared via lib/site-config.ts.
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

export const metadata: Metadata = getRootMetadata();

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang={siteConfig.lang}
      className={`${inter.variable} ${sourceSerif4.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col font-sans" suppressHydrationWarning>
        <SearchProvider>{children}</SearchProvider>
      </body>
    </html>
  );
}
