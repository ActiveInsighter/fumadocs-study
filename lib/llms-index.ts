import { source } from '@/lib/source';

const STUDY_ROOTS = [
  ['408', '408'],
  ['math', '数学'],
  ['english', '英语'],
  ['politics', '政治'],
] as const;

function toMarkdownInline(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/([\\[\]])/g, '\\$1')
    .trim();
}

export function buildLLMIndex() {
  const pages = source.getPages();
  const pagesByRoot = new Map<string, typeof pages>();

  for (const page of pages) {
    const root = page.path.split('/')[0] ?? 'other';
    const group = pagesByRoot.get(root) ?? [];
    group.push(page);
    pagesByRoot.set(root, group);
  }

  const lines = [
    '# Study 文档目录',
    '',
    '> 这是为 AI、搜索工具和纯文本阅读自动生成的文档索引。优先访问每一项的 Markdown 链接读取完整正文。',
    '',
    '每条记录同时提供普通网页与 AI 友好的纯 Markdown 版本。目录直接来自 Fumadocs 页面源，新增、删除或改名文档后会在下一次构建时自动更新。',
    '',
  ];

  const emittedRoots = new Set<string>();

  for (const [root, label] of STUDY_ROOTS) {
    const group = pagesByRoot.get(root);
    if (!group?.length) continue;

    emittedRoots.add(root);
    lines.push(`## ${label}`, '');

    for (const page of [...group].sort((a, b) => a.url.localeCompare(b.url))) {
      const title = toMarkdownInline(String(page.data.title || page.path));
      const description =
        typeof page.data.description === 'string' && page.data.description.trim().length > 0
          ? ` — ${toMarkdownInline(page.data.description)}`
          : '';
      const markdownUrl = `/llms.mdx${page.url}`;

      lines.push(
        `- [${title}](${page.url})${description} · [Markdown](${markdownUrl})`,
      );
    }

    lines.push('');
  }

  for (const [root, group] of pagesByRoot) {
    if (emittedRoots.has(root) || group.length === 0) continue;

    lines.push(`## ${toMarkdownInline(root)}`, '');
    for (const page of [...group].sort((a, b) => a.url.localeCompare(b.url))) {
      const title = toMarkdownInline(String(page.data.title || page.path));
      const markdownUrl = `/llms.mdx${page.url}`;
      lines.push(`- [${title}](${page.url}) · [Markdown](${markdownUrl})`);
    }
    lines.push('');
  }

  lines.push(`共 ${pages.length} 篇文档。`, '');

  return lines.join('\n');
}
