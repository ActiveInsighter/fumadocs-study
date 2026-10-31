import { Fragment, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

import { topLevelElements, topLevelItems } from './children';
import { CARDS_GRID, cardsMinWidth, measureCard } from './layout';
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

/**
 * Up to `columns` cards a row. A row drops a column once a card would get
 * narrower than its content allows (layout.ts, `cardsMinWidth`): short cards
 * stay two a row on a phone, cards with a paragraph each take the full width.
 * One-line `<Card>…</Card>`s that MDX wrapped in a paragraph become grid
 * cells again.
 */
export function Cards({ columns, style, children, ...props }: CardsProps) {
  const items = topLevelItems(children, (item) => item.type === Card);
  const unwrapped = items.length !== topLevelElements(children).length;
  const count = columns === undefined ? undefined : Math.min(Math.max(Math.round(columns), 1), 4);
  const minWidth = cardsMinWidth(items.map((item) => measureCard(item.type === Card ? (item.props as CardProps) : { children: item })));
  const vars = {
    ...(count === undefined ? null : { '--cards-columns': count }),
    ...(minWidth < CARDS_GRID.maxWidth ? { '--cards-min': `${minWidth}rem` } : null),
  };
  const gridStyle = Object.keys(vars).length > 0 ? ({ ...vars, ...style } as CSSProperties) : style;

  return (
    <div data-slot="cards" style={gridStyle} {...props}>
      {unwrapped ? items.map((item, index) => <Fragment key={item.key ?? index}>{item}</Fragment>) : children}
    </div>
  );
}
