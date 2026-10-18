import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { studyCatalog, studyGenerationRules } from '../lib/smart-ui/catalog.ts';

// Export the document subset, not the upstream streaming/JSONL prompt.
const components = Object.fromEntries(Object.entries(studyCatalog.data.components).map(([name, definition]) => [name, {
  description: definition.description,
  children: 'slots' in definition,
  props: z.toJSONSchema(definition.props, { unrepresentable: 'any' }),
}]));
const contract = { version: 1, runtime: '@json-render/react@0.21.1', components, rules: studyGenerationRules };
const prompt = `# Fumadocs 智能 UI 文档生成约定\n\n你是一名中文学习文档作者。请根据随后提供的主题和资料，生成带有可操作 UI 的 Markdown 文档。\n\n${studyGenerationRules.map((rule, i) => `${i + 1}. ${rule}`).join('\n\n')}\n\n## 组件目录（props JSON Schema）\n\n${JSON.stringify(components, null, 2)}\n\n## 最小可运行例子\n\n\`\`\`json-render\n{"root":"card","state":{"done":false},"elements":{"card":{"type":"Card","props":{"title":"复习目标"},"children":["task","progress"]},"task":{"type":"Toggle","props":{"label":"能用自己的话解释本节概念","checked":{"$bindState":"/done"}},"children":[]},"progress":{"type":"Progress","props":{"label":"完成度","values":[{"$state":"/done"}]},"children":[]}}}\n\`\`\`\n\n请在交互块前后保留完整、可单独阅读的正文。现在等待用户提供主题和材料，再输出整篇文档。\n`;
await mkdir(new URL('../public/smart-ui/', import.meta.url), { recursive: true });
await Promise.all([
  writeFile(new URL('../public/smart-ui/catalog.json', import.meta.url), `${JSON.stringify(contract, null, 2)}\n`),
  writeFile(new URL('../public/smart-ui/authoring-prompt.md', import.meta.url), prompt),
]);
console.log(`Exported ${Object.keys(components).length} components and document authoring prompt.`);
