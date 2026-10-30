/**
 * Keep the sidebar concise without changing MDX page titles or URLs.
 * Course/folder context already identifies the subject, so a chapter needs
 * only its number and topic in the navigation tree.
 */
export function optimizeStudySidebarTitle(
  title: string,
  kind: 'file' | 'folder',
): string {
  if (kind === 'folder') {
    if (/^408\s*题型总结$/u.test(title)) return '题型总结';
    if (/^408\s*知识点总结\s*2（优化版）$/u.test(title)) return '知识点总结 2';
    return title;
  }

  // Normalize both "数据结构 第1章：绪论" and "第 1 章 绪论".
  const chapter = title.match(
    /^(?:(?:数据结构|计算机组成原理|操作系统|计算机网络|高等数学|线性代数|概率论与数理统计)\s+)?第\s*([0-9一二三四五六七八九十百]+)\s*章(?:\s*[：:]\s*|\s+)(.+)$/u,
  );
  if (chapter) return `第${chapter[1]}章：${chapter[2].trim()}`;

  if (
    /^408\s*题型总结$/u.test(title) ||
    /^408\s*知识点总结\s*2（优化版）$/u.test(title) ||
    /^(?:数据结构|计算机组成原理|操作系统|计算机网络)\s*·\s*408题型总结$/u.test(title)
  ) {
    return '概览';
  }

  if (title === '408 总览') return '总览';
  return title;
}
