import './docs-typography.css';
import '@/styles/word-cards.css';
import '@/styles/word-card-interactions.css';
import '@/styles/vocabulary-responsive-layout.css';
import '@/styles/mind-map.css';

import { source } from '@/lib/source';
import { baseOptions } from '@/lib/layout.shared';
import { CollapsedSidebarFolder } from '@/components/collapsed-sidebar-folder';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';

export default function DocsRootLayout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...baseOptions()}
      sidebar={{
        defaultOpenLevel: 0,
        components: { Folder: CollapsedSidebarFolder },
      }}
    >
      {children}
    </DocsLayout>
  );
}
