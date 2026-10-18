# 官方 json-render 组件接入

本分支使用 `@json-render/core`、`@json-render/react`、`@json-render/shadcn` 的 `0.21.1` 版本。全部 36 个组件的属性定义直接使用 `shadcnComponentDefinitions`，React 实现直接使用 `shadcnComponents`。没有复制组件实现或改写官方属性；旧版自定义 `Choice`、`MemoryAddress` 等已移除。

## 查看示例

打开 `/docs/408/knowledge/smart-ui-demo/`，六个例子覆盖全部 36 个组件：

1. 即时答题：Radio、Button、Alert、Badge、Card。
2. 复习计划：Input、Textarea、Select、Switch、Checkbox、Slider、Progress、Grid。
3. TCP 知识速查：Tabs、Table、Accordion。
4. 补充资料：Dialog、Drawer、Popover、Tooltip、DropdownMenu、Collapsible、Stack。
5. 复习节奏：Toggle、ToggleGroup、ButtonGroup、Pagination。
6. 内容展示：Heading、Text、Avatar、Image、Separator、Carousel、Skeleton、Spinner、Link。

保留统一的预览 / JSON 外框、复制和重置功能。状态由官方 `JSONUIProvider` 管理，块之间独立，刷新和重置后复原。弹窗、抽屉、选项菜单沿用官方 Radix 行为及焦点管理。

## 样式

官方组件保留原始 DOM、默认布局和 variant。`app/global.css` 显式扫描官方包 `dist` 中的 Tailwind 类，沿用站点语义颜色、字体和圆角。`smart-ui.css` 只处理内容区适配和 Alert 的黑白灰主题；不另外实现表单控件。弹窗等 Portal 使用全局共享主题令牌。

## AI 写作说明与官方提示词

`npm run smart-ui:catalog` 从官方定义导出三个文件：

- `/smart-ui/catalog.json`：全部 36 个官方组件的属性 JSON Schema、事件和文档模式规则。
- `/smart-ui/authoring-prompt.md`：本项目的 Markdown 接入说明，要求完整 JSON spec 放进 `json-render` 围栏。该说明是项目适配文件，不是官方原文。
- `/smart-ui/upstream-prompt.md`：官方 `studyCatalog.prompt()` 的原始输出，要求 JSONL patches；不应直接作为 Markdown 围栏的内容。

所有示例使用官方属性，例如 `Radio.options` 是字符串数组、`Checkbox.checked` 是布尔值、`Toggle.pressed` 是按钮状态、`Progress.value` 为 0–100 的数值。`Progress.max` 虽在官方定义中提供，当前官方实现按百分比绘制；示例使用 100。

## 文档校验与边界

校验器保留官方组件属性和声明事件，并用官方 Zod 定义、表达式解析器和可见性格式检查 JSON。文档中支持 `$state`、`$bindState`、`$template`、`$cond`，以及内置 `setState`、`pushState`、`removeState`、`validateForm` 动作。组件目录不再是原先的 9 项白名单。

文档模式仍限制每块 100 KB、100 个元素、20 层树结构，拒绝危险对象键、循环引用、不存在的组件、非法属性与自定义动作。此模式没有实现 repeat、watch 或自定义计算函数；这是文档传输模式的范围，不是官方组件库的能力限制。站点仍不在线调用模型；AI 在写作时生成文档，浏览器负责本地交互。

## 验证与部署

```bash
npm ci
npm run smart-ui:catalog
npm test -- tests/smart-ui.test.tsx tests/mind-map.test.tsx tests/static-docs-build.test.ts tests/static-doc-shards.test.ts
npm run build:smart-ui-demo
python3 -m http.server 3022 --bind 127.0.0.1 --directory .static-docs-preview
```

`build:smart-ui-demo` 只导出示例页用于本地检查。远端使用现有 `deploy-cloudflare-worker-assets.yml` workflow，通过分支引用运行全站 8 路构建并发布到独立 Cloudflare Worker。

浏览器脚本：`scripts/verify-smart-ui-browser.js`，通过 Playwright CLI 的 `run-code --filename` 执行。覆盖六个示例、控件状态、JSON 切换、状态隔离、弹窗/抽屉、明暗主题和 375px 布局。

官方参考：[组件 API](https://json-render.dev/docs/api/shadcn)、[Catalog](https://json-render.dev/docs/catalog)、[状态绑定](https://json-render.dev/docs/data-binding)。
