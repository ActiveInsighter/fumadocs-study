import './docs-typography.css';
import '@/styles/word-cards.css';
import '@/styles/word-card-interactions.css';
import '@/styles/vocabulary-responsive-layout.css';
import '@/styles/mind-map.css';
import '@/styles/motion-stage.css';

import { source } from '@/lib/source';
import { baseOptions } from '@/lib/layout.shared';
import { StudyDocsLayout } from '@/components/study-docs-layout';
import type { ReactNode } from 'react';

export default function DocsRootLayout({ children }: { children: ReactNode }) {
  return (
    <StudyDocsLayout
      tree={source.getPageTree()}
      {...baseOptions()}
    >
      {children}
    </StudyDocsLayout>
  );
}
