import * as lucide from 'lucide-react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

/*
 * Lucide icons by name, for MDX.
 *
 *   <Card icon="rocket" />            any component that takes an `icon`
 *   <Icon name="git-branch" />        an inline icon in running text
 *
 * A name is matched however it is written: `GitBranch`, `git-branch`,
 * `gitBranch`, `git_branch`, `GitBranchIcon`, `LucideGitBranch`, and Lucide's
 * own aliases (`curly-braces` for `Braces`). Browse names at
 * https://lucide.dev/icons.
 *
 * A server component. The name table holds every Lucide export, so it must
 * stay on the server: never import this file from a 'use client' module. Each
 * rendered icon only sends its own path data to the browser.
 */

/** Canonical Lucide icon names, for typed (non-MDX) callers. */
export type IconName = keyof typeof lucide.icons;

let registry: Map<string, LucideIcon> | undefined;

/** Case, separators and the `Icon` / `Lucide` affixes do not matter. */
function normalizeIconName(name: string): string {
  return name.replace(/[^a-z0-9]/giu, '').toLowerCase();
}

/** Every icon export (canonical names, aliases, `…Icon` and `Lucide…` forms), keyed by normalized name. */
function getRegistry(): Map<string, LucideIcon> {
  if (registry) return registry;
  const isIcon = new Set<unknown>(Object.values(lucide.icons));
  registry = new Map();
  for (const [exportName, value] of Object.entries(lucide)) {
    if (isIcon.has(value)) registry.set(normalizeIconName(exportName), value as LucideIcon);
  }
  return registry;
}

/** The Lucide component for a name, or undefined when there is none. */
export function resolveLucideIcon(name: string): LucideIcon | undefined {
  const key = normalizeIconName(name);
  return key ? getRegistry().get(key) : undefined;
}

const warned = new Set<string>();

/** Unknown names render nothing; say so once per name in the dev / build log. */
function warnUnknownIcon(name: string) {
  if (warned.has(name)) return;
  warned.add(name);
  console.warn(`[icon] Unknown Lucide icon "${name}". Browse names at https://lucide.dev/icons.`);
}

/** Looks like an icon name: ASCII letters first, then letters, digits, spaces, `-` or `_`. */
const ICON_NAME = /^[A-Za-z][\w -]*$/u;

/**
 * An `icon` prop as authored: a Lucide name becomes that icon; any other
 * string (an emoji, a single CJK character) is shown as a text glyph; a React
 * node is passed through, so `icon={<svg />}` keeps working.
 */
export function renderIcon(icon: ReactNode, props?: LucideProps): ReactNode {
  if (typeof icon !== 'string') return icon ?? null;
  const name = icon.trim();
  if (!name) return null;
  if (!ICON_NAME.test(name)) {
    return (
      <span data-slot="icon-glyph" aria-hidden="true">
        {name}
      </span>
    );
  }
  const Component = resolveLucideIcon(name);
  if (!Component) {
    warnUnknownIcon(name);
    return null;
  }
  return <Component aria-hidden="true" focusable="false" {...props} />;
}

export interface IconProps extends Omit<LucideProps, 'ref'> {
  /** Lucide icon name, in any case or separator style. */
  name: string;
  /** Accessible name; without it the icon is decorative and hidden from screen readers. */
  label?: string;
}

/** Preflight makes every svg a block; an inline icon stays in the line, on the text's centre. */
const INLINE_STYLE: CSSProperties = { display: 'inline-block', verticalAlign: '-0.125em' };

/** An inline Lucide icon sized to the surrounding text. */
export function Icon({ name, label, size = '1em', style, ...props }: IconProps) {
  const Component = resolveLucideIcon(name);
  if (!Component) {
    warnUnknownIcon(name);
    return null;
  }
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const };
  return (
    <Component data-slot="icon" size={size} focusable="false" style={{ ...INLINE_STYLE, ...style }} {...a11y} {...props} />
  );
}
