/** Direct-mapped cache, byte addressing, 16-bit unsigned addresses. */
export function decomposeAddress(address: number, blockBytes: number, lines: number) {
  const offsetWidth = Math.log2(blockBytes);
  const lineWidth = Math.log2(lines);
  const tagWidth = 16 - offsetWidth - lineWidth;
  const block = Math.floor(address / blockBytes);
  const line = block % lines;
  const offset = address % blockBytes;
  const tag = Math.floor(block / lines);
  const bits = (value: number, width: number) => width ? value.toString(2).padStart(width, '0') : '';
  return {
    block, line, offset, tag,
    fields: [
      { label: '标记', width: tagWidth, value: tag, bits: bits(tag, tagWidth) },
      { label: '行号', width: lineWidth, value: line, bits: bits(line, lineWidth) },
      { label: '块内偏移', width: offsetWidth, value: offset, bits: bits(offset, offsetWidth) },
    ],
  };
}
