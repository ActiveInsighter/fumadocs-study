'use client';

import { DocsLayout, type DocsLayoutProps } from 'fumadocs-ui/layouts/docs';
import { CollapsedSidebarFolder } from './collapsed-sidebar-folder';

// Standard Fumadocs docs layout: left sidebar, right table of contents, and
// `root: true` folders as the sidebar tab dropdown. Keep component overrides
// on the client side of the layout boundary.
export function StudyDocsLayout(props: DocsLayoutProps) {
  return (
    <DocsLayout
      {...props}
      sidebar={{ defaultOpenLevel: 0, components: { Folder: CollapsedSidebarFolder } }}
    />
  );
}
