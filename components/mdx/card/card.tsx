import { Fragment, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

import { topLevelElements, topLevelItems } from './children';
import { CardBody, CardDescription, CardIcon, CardRoot, CardTitle, hasContent, type CardRootProps } from './parts';

/*
 * The MDX `Card` and `Cards` (styles/doc-card.css).
 *
 * Same props as the official Fumadocs components, so existing pages render
 * unchanged, plus:
 *
 *   <Cards columns={3}>                      up to 3 a row, fewer when narrow
 *     <Card icon="rocket" title="…">         Lucide icon by name (or emoji)
 *     <Card icon="git-branch" tone="info" href="/docs/…" title="…" />
 *
 * Server components: they ship no JavaScript of their own.
 */

export type CardProps = CardRootProps & {
  /** A Lucide icon name (`rocket`, `GitBranch`…), an emoji, or any React node. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
};

export function Card({ icon, title, description, children, ...props }: CardProps) {
  return (
    <CardRoot {...props}>
      <CardIcon icon={icon} />
      <CardTitle>{title}</CardTitle>
      {description ? <CardDescription>{description}</CardDescription> : null}
      {hasContent(children) ? <CardBody>{children}</CardBody> : null}
    </CardRoot>
  );
}

export type CardsProps = HTMLAttributes<HTMLDivElement> & {
  /** Most cards a row (1–4); 2 by default. Narrow columns hold fewer. */
  columns?: number;
};

/** One-line `<Card>…</Card>`s that MDX wrapped in a paragraph become grid cells again. */
function cardItems(children: ReactNode): ReactNode {
  const items = topLevelItems(children, (item) => item.type === Card);
  const unwrapped = items.length !== topLevelElements(children).length;
  return unwrapped ? items.map((item, index) => <Fragment key={item.key ?? index}>{item}</Fragment>) : children;
}

export function Cards({ columns, style, children, ...props }: CardsProps) {
  const count = columns === undefined ? undefined : Math.min(Math.max(Math.round(columns), 1), 4);
  const columnStyle = count === undefined ? style : ({ '--cards-columns': count, ...style } as CSSProperties);
  return (
    <div data-slot="cards" style={columnStyle} {...props}>
      {cardItems(children)}
    </div>
  );
}
