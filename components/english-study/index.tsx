import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { StudyQuestion } from './study-question';

type ContentProps = { children?: ReactNode };
type OptionProps = ContentProps & { correct?: boolean };
type QuestionProps = ContentProps & {
  id: string;
  type: 'single' | 'essay';
  tags?: string;
  evidence?: boolean;
};

// Authoring markers are read on the server; only the answer controls hydrate.
export function Option({ children }: OptionProps) { return <>{children}</>; }
export function Solution({ children }: ContentProps) { return <>{children}</>; }

export function Question({ children, id, type, tags, evidence = false }: QuestionProps) {
  const stem: ReactNode[] = [];
  const options: ReactElement<OptionProps>[] = [];
  let solution: ReactNode;
  for (const node of Children.toArray(children)) {
    if (isValidElement<ContentProps>(node) && node.type === Solution) {
      solution = node.props.children;
    } else if (isValidElement<OptionProps>(node) && node.type === Option) {
      options.push(node);
    } else if (isValidElement<ContentProps>(node) && typeof node.type === 'string') {
      // MDX can wrap consecutive inline Option markers in a paragraph.
      const parts = Children.toArray(node.props.children).filter((part) => typeof part !== 'string' || part.trim());
      if (parts.length && parts.every((part) => isValidElement(part) && part.type === Option)) {
        options.push(...parts as ReactElement<OptionProps>[]);
      } else stem.push(node);
    } else stem.push(node);
  }
  if (!solution || (type === 'single' && (options.length < 2 || options.filter((o) => o.props.correct).length !== 1))) {
    throw new Error(`Invalid study question: ${id}`);
  }
  return <StudyQuestion id={id} type={type} tags={tags} stem={stem}
    options={options.map((option) => ({ content: option.props.children, correct: Boolean(option.props.correct) }))}
    solution={solution} evidence={evidence} />;
}

export function Translation({ children }: ContentProps) {
  return <details className="my-3 rounded-lg border border-fd-border px-4 py-2" lang="zh-CN">
    <summary className="cursor-pointer text-sm text-fd-muted-foreground">查看本段译文</summary>
    <div className="pt-2">{children}</div>
  </details>;
}

export function Paragraph({ children }: ContentProps) {
  return <div className="my-5">{children}</div>;
}

export function Evidence({ for: questionId, children }: ContentProps & { for: string }) {
  return <span id={`evidence-${questionId}`} className="scroll-mt-24 target:bg-fd-accent target:text-fd-accent-foreground">{children}</span>;
}

export function ExamArticle({ title, titleTranslation, source, children }: ContentProps & {
  title: string; titleTranslation?: string; source?: string;
}) {
  return <article aria-label={title} className="min-w-0">
    <header>
      {source ? <p className="text-sm text-fd-muted-foreground">{source}</p> : null}
      <h3 lang="en">{title}</h3>
      {titleTranslation ? <p lang="zh-CN">{titleTranslation}</p> : null}
    </header>
    <div lang="en">{children}</div>
  </article>;
}

function collectEvidence(node: ReactNode, ids: Set<string>) {
  Children.forEach(node, (child) => {
    if (!isValidElement<ContentProps & { for?: string }>(child)) return;
    if (child.type === Evidence && child.props.for) ids.add(child.props.for);
    collectEvidence(child.props.children, ids);
  });
}

export function EnglishReading({ children }: ContentProps) {
  const nodes = Children.toArray(children);
  const articles = nodes.filter((node) => isValidElement(node) && node.type === ExamArticle);
  if (articles.length !== 1) throw new Error('EnglishReading requires one ExamArticle');
  const evidenceIds = new Set<string>();
  collectEvidence(articles, evidenceIds);
  return <section aria-label="英语精读与巩固练习" className="my-6 min-w-0 rounded-xl border border-fd-border p-4 sm:p-6">
    {nodes.map((node) => isValidElement<QuestionProps>(node) && node.type === Question
      ? cloneElement(node, { evidence: evidenceIds.has(node.props.id) }) : node)}
  </section>;
}
