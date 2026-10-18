# json-render 学习文档

本分支基于 `519f715`，使用 `@json-render/core@0.21.1`、`@json-render/react@0.21.1` 和显式的 `zod@4.4.3` 依赖。组件样式使用站点共享的语义令牌（`--background` / `--foreground` / `--border` / `--radius`），全部为黑白灰、圆角、细边框，明暗主题自动适配；不使用任何硬编码颜色。每个交互块是一个带「预览 / JSON」标签的圆角面板，标签复用 `components/ui/tabs`，JSON 视图复用文档代码块的背景令牌并带复制按钮；正确/提示反馈用图标和实线/虚线区分，不靠颜色；地址位段用深浅区分。

## 使用

```bash
npm ci
npm run dev -- --port 3018
```

打开 `/docs/408/knowledge/smart-ui-demo`。页面含即时判题、Cache 地址滑块与预设按钮、复习清单和覆盖全部组件的「组件一览」四个例子。

复制 `public/smart-ui/authoring-prompt.md` 给 AI，随后提供主题和资料。将 AI 生成的文档保存至 `content/docs` 对应的现有学习模块，并在该目录 `meta.json` 中添加页面导航。`.md`、`.mdx` 都支持：

````md
普通正文中保留知识说明与纸面答案。

```json-render
{"root":"card","state":{"done":false},"elements":{"card":{"type":"Card","props":{"title":"复习目标"},"children":["task"]},"task":{"type":"Toggle","props":{"label":"掌握本节概念","checked":{"$bindState":"/done"}},"children":[]}}}
```
````

这是写作阶段由 AI 生成文档、阅读阶段本地交互的接入。网站不调用模型；没有流式聊天、用户密钥输入或生成 API。无需改动现有的 n8n 文档发布接口：生成完整的 Markdown 文档后，沿用原有发布流程即可，端到端远程发布未在本次验证中执行。

## 组件与约束

`lib/smart-ui/catalog.ts` 是组件属性与生成规则的来源；`components/smart-ui/registry.tsx` 是对应的 React 实现（Tailwind + cva，仅 range/progress 伪元素放在 `smart-ui.css`），`renderer.tsx` 是预览/JSON 外框，`json-source.tsx` 是 JSON 视图，格式化与高亮词法在 `lib/smart-ui/format-json.ts`。支持 `Stack`、`Card`、`Text`、`Choice`、`Slider`、`Toggle`、`Button`、`Progress`、`MemoryAddress`。新增组件时同步维护 React registry、属性表达式白名单和验证测试。

修改目录后运行：

```bash
npm run smart-ui:catalog
```

这会生成公开的提示词及 `public/smart-ui/catalog.json`。导出脚本使用 Node 的 TypeScript 类型剥离，需要项目约定的 Node 22（建议 22.18+），或 Node 24。本次机器默认使用 Node 24.22.0，安装时会出现项目 Node 22.x 的版本提示。

`remarkJsonRender` 将专用代码围栏映射为 `SmartUI` 服务端组件。服务端校验 JSON、组件属性、状态路径、动作、树结构及大小，再将序列化 spec 交给按需加载的 React renderer。校验失败时只降级该块，不影响正文；原始 Markdown 导出仍保留代码围栏。

此版本有意采用官方格式的文档子集：平铺基础状态、受限 `$state` / `$bindState`、简单条件、仅本地 `setState` 动作。没有 `eval`、生成代码执行、HTML 注入、任意 URL、网络动作、watch、repeat、computed 或自定义脚本。每块有独立状态，刷新页面或重置后复原，不做持久化。

## 验证

```bash
npx vitest run tests/smart-ui.test.tsx tests/mind-map.test.tsx tests/static-docs-build.test.ts
npm run typecheck
npm run build:smart-ui-demo
```

新增测试检查真实示例（4 个）、样式令牌约束（无硬编码颜色、复用共享 Tabs）、JSON 格式化与高亮、MDX 编译、HTML 转义、非法属性/表达式/动作、循环引用、缺失/孤立节点、状态类型和 Cache 算术。浏览器操作另见 `scripts/verify-smart-ui-browser.js`，通过 Playwright CLI `run-code --filename` 执行。

`build:smart-ui-demo` 只对真实文档路由下的测试页执行生产静态导出，跳过全站页面和搜索索引生成，输出 `.static-docs-preview/`。可执行 `python3 -m http.server 3020 --directory .static-docs-preview` 预览。预览目录不是完整站点，其他导航页面不会导出；生产部署仍使用原有 `build:static-docs`。

接入前的全量测试与类型检查日志保存在 `reports/smart-ui-baseline-*.log`，结果见 `reports/smart-ui-validation.md`。全量检查已有失败，因此以相同错误集对比验证本次是否引入回归，并另外执行测试页的真实静态导出。

参考：[官方快速开始](https://json-render.dev/docs/quick-start)、[状态绑定](https://json-render.dev/docs/data-binding)、[Registry](https://json-render.dev/docs/registry)。
