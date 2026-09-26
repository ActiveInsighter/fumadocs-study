/**
 * Repair a narrow CommonMark strong-emphasis edge case without changing the
 * visible text.
 *
 * CommonMark can leave markup such as `**缓冲区（Buffer）**是` as literal text:
 * the closing `**` is preceded by punctuation (the full-width right
 * parenthesis) and immediately followed by a letter/CJK character. Fumadocs
 * then faithfully renders the asterisks instead of a <strong> element.
 *
 * The repair runs after parsing and only touches double-asterisk pairs that
 * survived as text nodes because of that punctuation boundary, or because
 * whitespace was accidentally placed just inside the markers. Valid Markdown
 * strong nodes have already been parsed and never reach this function.
 */

type AstNode = {
  type: string;
  value?: string;
  children?: AstNode[];
};

type TextNode = {
  type: 'text';
  value: string;
};

type StrongNode = {
  type: 'strong';
  children: TextNode[];
};

export type StrongBoundaryNode = TextNode | StrongNode;

const candidatePattern = /\*\*([ \t]*)([^*\n]*?\S)([ \t]*)\*\*/gu;
const letterOrNumber = /[\p{L}\p{N}\p{M}]/u;
const punctuationOrSymbol = /[\p{P}\p{S}]/u;

function firstCharacter(value: string): string {
  return Array.from(value)[0] ?? '';
}

function lastCharacter(value: string): string {
  return Array.from(value).at(-1) ?? '';
}

function isRepairable(
  before: string,
  content: string,
  after: string,
  leadingWhitespace: string,
  trailingWhitespace: string,
): boolean {
  if (leadingWhitespace || trailingWhitespace) return true;

  const contentFirst = firstCharacter(content);
  const contentLast = lastCharacter(content);
  const beforeLast = lastCharacter(before);
  const afterFirst = firstCharacter(after);

  const closingPunctuationTouchesWord =
    punctuationOrSymbol.test(contentLast) && letterOrNumber.test(afterFirst);
  const openingPunctuationTouchesWord =
    punctuationOrSymbol.test(contentFirst) && letterOrNumber.test(beforeLast);

  return closingPunctuationTouchesWord || openingPunctuationTouchesWord;
}

function pushText(nodes: StrongBoundaryNode[], value: string) {
  if (!value) return;

  const previous = nodes.at(-1);
  if (previous?.type === 'text') {
    previous.value += value;
  } else {
    nodes.push({ type: 'text', value });
  }
}

export function repairStrongBoundaryText(value: string): StrongBoundaryNode[] | null {
  const nodes: StrongBoundaryNode[] = [];
  let cursor = 0;
  let changed = false;

  for (const match of value.matchAll(candidatePattern)) {
    const index = match.index;
    const [raw, leadingWhitespace, content, trailingWhitespace] = match;
    const before = value.slice(0, index);
    const after = value.slice(index + raw.length);

    if (
      !isRepairable(
        before,
        content,
        after,
        leadingWhitespace,
        trailingWhitespace,
      )
    ) {
      continue;
    }

    pushText(nodes, value.slice(cursor, index));
    pushText(nodes, leadingWhitespace);
    nodes.push({
      type: 'strong',
      children: [{ type: 'text', value: content }],
    });
    pushText(nodes, trailingWhitespace);
    cursor = index + raw.length;
    changed = true;
  }

  if (!changed) return null;

  pushText(nodes, value.slice(cursor));
  return nodes;
}

function repairTree(node: AstNode) {
  if (!node.children) return;

  const nextChildren: AstNode[] = [];

  for (const child of node.children) {
    if (child.type === 'text' && typeof child.value === 'string') {
      const replacement = repairStrongBoundaryText(child.value);
      if (replacement) {
        nextChildren.push(...replacement);
        continue;
      }
    }

    repairTree(child);
    nextChildren.push(child);
  }

  node.children = nextChildren;
}

export function remarkStrongBoundaryRepair() {
  return (tree: AstNode) => {
    repairTree(tree);
  };
}
