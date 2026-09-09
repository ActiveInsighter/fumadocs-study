function getImportance(card) {
  const value = String(card?.label ?? '').match(/[0-9]+/u)?.[0];
  return value ? Number(value) : null;
}

function formatImportance(value) {
  return value === null ? '重要性未标注' : `重要性 ${value}`;
}

export function createCardModules(cards, ranges) {
  return ranges.map((range) => {
    const first = cards[range.start];
    const last = cards[range.end - 1];

    if (!first || !last) {
      throw new Error(`Card module range is outside the source data: ${range.slug}`);
    }

    const firstImportance = getImportance(first);
    const lastImportance = getImportance(last);
    const importance =
      firstImportance === lastImportance
        ? formatImportance(firstImportance)
        : `${formatImportance(firstImportance)}–${lastImportance ?? '未标注'}`;

    return {
      ...range,
      count: range.end - range.start,
      firstWord: first.word,
      lastWord: last.word,
      importanceRange: importance,
      description: `第 ${range.start + 1}–${range.end} 张 · ${importance}`,
    };
  });
}
