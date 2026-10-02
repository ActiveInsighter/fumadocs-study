'use client';

import {
  SidebarFolder,
  SidebarFolderContent,
  SidebarFolderLink,
  SidebarFolderTrigger,
  useFolderDepth,
} from 'fumadocs-ui/components/sidebar/base';
import type { SidebarPageTreeComponents } from 'fumadocs-ui/components/sidebar/page-tree';
import { usePathname } from 'fumadocs-core/framework';

const folderClass =
  'relative flex w-full flex-row items-center gap-2 rounded-lg p-2 text-start text-fd-muted-foreground wrap-anywhere [&_svg]:size-4 [&_svg]:shrink-0 transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80';

export const CollapsedSidebarFolder: SidebarPageTreeComponents['Folder'] = ({
  item,
  children,
}) => {
  const depth = useFolderDepth();
  const pathname = usePathname();
  const active =
    item.index !== undefined &&
    pathname.replace(/\/$/, '') === item.index.url.replace(/\/$/, '');
  const style = { paddingInlineStart: `calc(${2 + 3 * depth} * var(--spacing))` };

  return (
    // Omit the active ancestor flag so routes never open folders automatically.
    <SidebarFolder defaultOpen={false}>
      {item.index ? (
        <SidebarFolderLink
          href={item.index.url}
          external={item.index.external}
          active={active}
          className={`${folderClass} data-[active=true]:bg-fd-primary/10 data-[active=true]:text-fd-primary`}
          style={style}
        >
          {item.icon}
          {item.name}
        </SidebarFolderLink>
      ) : (
        <SidebarFolderTrigger className={folderClass} style={style}>
          {item.icon}
          {item.name}
        </SidebarFolderTrigger>
      )}
      <SidebarFolderContent className="relative flex flex-col gap-0.5 pt-0.5">
        {children}
      </SidebarFolderContent>
    </SidebarFolder>
  );
};
