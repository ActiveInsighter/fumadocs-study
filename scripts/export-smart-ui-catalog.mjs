import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { z } from 'zod';
import { studyCatalog, studyGenerationRules } from '../lib/smart-ui/catalog.ts';

const components = Object.fromEntries(Object.entries(studyCatalog.data.components).map(([name, definition]) => [name, {
  description: definition.description,
  children: 'slots' in definition,
  events: 'events' in definition ? definition.events : [],
  props: z.toJSONSchema(definition.props, { unrepresentable: 'any' }),
}]));
const contract = { version: 2, runtime: '@json-render/react@0.21.1', componentLibrary: '@json-render/shadcn@0.21.1', components, rules: studyGenerationRules };
const document = await readFile(new URL('../content/docs/408/knowledge/smart-ui-demo.mdx', import.meta.url), 'utf8');
const example = /```json-render\n([\s\S]*?)\n```/u.exec(document)?.[1];
if (!example) throw new Error('Missing authoring example.');
const prompt = `# Fumadocs 文档写作约定（官方组件版）\n\n这份文件是站点 Markdown 接入说明；组件及属性直接来自官方 @json-render/shadcn。官方原始 JSONL 提示词另见 /smart-ui/upstream-prompt.md。\n\n${studyGenerationRules.map((rule, i) => `${i + 1}. ${rule}`).join('\n\n')}\n\n## 官方组件目录\n\n${JSON.stringify(components, null, 2)}\n\n## 可运行例子\n\n\`\`\`json-render\n${example}\n\`\`\`\n\n随后根据用户主题和材料输出完整文档。\n`;
await mkdir(new URL('../public/smart-ui/', import.meta.url), { recursive: true });
await Promise.all([
  writeFile(new URL('../public/smart-ui/catalog.json', import.meta.url), `${JSON.stringify(contract, null, 2)}\n`),
  writeFile(new URL('../public/smart-ui/authoring-prompt.md', import.meta.url), prompt),
  writeFile(new URL('../public/smart-ui/upstream-prompt.md', import.meta.url), studyCatalog.prompt()),
]);
console.log(`Exported ${Object.keys(components).length} official components, document guide and upstream prompt.`);
