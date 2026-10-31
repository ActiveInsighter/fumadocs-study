import Link from 'fumadocs-core/link';
import type { HTMLAttributes, ReactNode } from 'react';

import { renderIcon } from '@/components/mdx/icon';
import { cn } from '@/lib/utils';

/*
 * The parts every card is built from (styles/doc-card.css). Card, CardStep
 * and any future card variant compose these, so a card looks and behaves the
 * same wherever it is used and a change to the anatomy lands in one place.
 *
 *   <CardRoot href? tone?>           div, or a link when it has an href
 *     <CardIcon icon />              Lucide name, emoji or a node
 *     <CardTitle />
 *     <CardDescription />
 *     <CardBody />                   MDX children, prose styles kept
 *
 * Stable hooks: data-slot on every part, data-tone on the root. The root keeps
 * Fumadocs' `data-card` so prose link styles leave linked cards alone.
 * Server components.
 */

/**
 * Accent for the icon tile, from the theme's semantic colours. Any other
 * value is still written to `data-tone`, so a new tone only needs a line in
 * styles/doc-card.css.
 */
export type CardTone = 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error' | 'idea' | (string & {});

export type CardRootProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  href?: string;
  /** Open as an external link; detected from the href by default. */
  external?: boolean;
  tone?: CardTone;
};

export function CardRoot({ href, external, tone, className, children, ...props }: CardRootProps) {
  const shared = {
    'data-card': true,
    'data-slot': 'card',
    'data-tone': tone && tone !== 'default' ? tone : undefined,
    className,
  };
  if (href) {
    return (
      <Link href={href} external={external} {...shared} {...props}>
        {children}
      </Link>
    );
  }
  return (
    <div {...shared} {...props}>
      {children}
    </div>
  );
}

/**
 * The icon tile. Shows `fallback` when there is no icon (or the name is
 * unknown), and renders nothing when there is neither.
 */
export function CardIcon({
  icon,
  fallback,
  className,
  ...props
}: Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & { icon?: ReactNode; fallback?: ReactNode }) {
  const glyph = renderIcon(icon) ?? fallback;
  if (glyph === null || glyph === undefined || glyph === false) return null;
  return (
    <span data-slot="card-icon" className={cn('not-prose', className)} {...props}>
      {glyph}
    </span>
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 data-slot="card-title" className={cn('not-prose', className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p data-slot="card-description" className={className} {...props} />;
}

/** MDX children; prose styles stay on, with no outer margins. */
export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-body" className={cn('prose-no-margin', className)} {...props} />;
}

/** Whether MDX children hold anything to show. */
export function hasContent(children: ReactNode): boolean {
  if (children === null || children === undefined || typeof children === 'boolean') return false;
  if (typeof children === 'string') return children.trim().length > 0;
  if (Array.isArray(children)) return children.some(hasContent);
  return true;
}
