'use client';

import { DocsLayout, type DocsLayoutProps } from 'fumadocs-ui/layouts/notebook';
import { CollapsedSidebarFolder } from './collapsed-sidebar-folder';

// Keep component overrides on the client side of the layout boundary.
export function StudyDocsLayout({ nav, ...props }: DocsLayoutProps) {
  return (
    <DocsLayout
      {...props}
      nav={{ ...nav, mode: 'top' }}
      tabMode="navbar"
      sidebar={{ defaultOpenLevel: 0, components: { Folder: CollapsedSidebarFolder } }}
    />
  );
}
