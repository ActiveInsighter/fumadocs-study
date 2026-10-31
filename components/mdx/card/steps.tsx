import { ChevronRight } from 'lucide-react';
import { Fragment, type CSSProperties, type HTMLAttributes, type ReactElement, type ReactNode } from 'react';

import { renderIcon } from '@/components/mdx/icon';

import { topLevelItems } from './children';
import { measureStep, resolveCardStepsLayout, type CardStepsLayoutOption } from './layout';
import { CardBody, CardDescription, CardIcon, CardRoot, CardTitle, hasContent, type CardRootProps } from './parts';

/*
 * Steps told as cards (styles/doc-card-steps.css): one short card a step,
 * linked by arrows, for an overview of a process. The official `Steps` stays
 * the choice for a detailed walk-through with prose and code under each step.
 *
 *   <CardSteps layout="auto | row | column" columns={2-4} start={1}>
 *     <CardStep title="…" icon="search">一两句话概括这一步。</CardStep>
 *     <CardStep title="…" description="…" step="A" tone="success" href="…" />
 *   </CardSteps>
 *
 * Layout. `auto` (the default) measures each step's text on the server
 * (components/mdx/card/layout.ts) and puts short steps side by side, up to
 * four a row in balanced rows, and stacks longer ones. A row too wide for
 * its column folds into a stack, four a row passing through two a row.
 *
 * Steps may be written one per line (`<CardStep title="…">一句话</CardStep>`)
 * or with their content on lines of their own; MDX wraps one-liners in a
 * paragraph, which the list takes apart again (components/mdx/card/children.ts).
 *
 * Numbers come from a CSS counter on the list, so a CardStep needs nothing
 * from its parent; the list itself gives screen readers the order. The tile
 * shows the icon, or the number when there is none (then the number sits in
 * the corner). `step` replaces the number with any label.
 *
 * Server components. The connector arrow is the only icon they always send.
 */

export type CardStepProps = CardRootProps & {
  /** A Lucide icon name, an emoji, or any React node; the step number when left out. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Label shown instead of the step number (a letter, ✓…). */
  step?: ReactNode;
};

/** The number from the list's counter; `padded` reads 01, 02…. */
function StepCount({ padded = false }: { padded?: boolean }) {
  return <span data-slot="card-step-count" data-format={padded ? 'padded' : undefined} />;
}

export function CardStep({ icon, title, description, step, children, ...props }: CardStepProps) {
  const glyph = renderIcon(icon);
  const hasIcon = glyph !== null && glyph !== undefined;
  const label = step ?? <StepCount padded={hasIcon} />;

  return (
    <li data-slot="card-step">
      <CardRoot {...props}>
        <CardIcon icon={glyph} fallback={label} aria-hidden="true" />
        {hasIcon ? (
          <span data-slot="card-step-index" aria-hidden="true">
            {label}
          </span>
        ) : null}
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {hasContent(children) ? <CardBody>{children}</CardBody> : null}
      </CardRoot>
      <span data-slot="card-step-connector" aria-hidden="true">
        <ChevronRight focusable="false" />
      </span>
    </li>
  );
}

export type CardStepsProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** `auto` chooses from the content; `row` and `column` force one. */
  layout?: CardStepsLayoutOption;
  /** Cards a row (2–4) for a row layout; chosen from the step count by default. */
  columns?: number;
  /** Number of the first step. */
  start?: number;
  children: ReactNode;
};

/** Props a child is measured by: a step's own props, or anything else as its body. */
function measuredProps(item: ReactElement) {
  return item.type === CardStep ? (item.props as CardStepProps) : { children: item };
}

export function CardSteps({ layout = 'auto', columns, start, children, ...props }: CardStepsProps) {
  const items = topLevelItems(children, (item) => item.type === CardStep);
  const resolved = resolveCardStepsLayout(items.map((item) => measureStep(measuredProps(item))), { layout, columns });
  const first = start === undefined ? 1 : Math.round(start);
  const listStyle: CSSProperties | undefined = first === 1 ? undefined : { counterReset: `card-step ${first - 1}` };

  return (
    <div data-slot="card-steps" data-layout={resolved.layout} data-columns={resolved.columns} {...props}>
      <ol data-slot="card-steps-list" start={first === 1 ? undefined : first} style={listStyle}>
        {items.map((item, index) => (
          <Fragment key={item.key ?? index}>
            {item.type === CardStep ? item : <li data-slot="card-step">{item}</li>}
          </Fragment>
        ))}
      </ol>
    </div>
  );
}
