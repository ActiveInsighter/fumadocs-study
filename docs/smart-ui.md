# 官方 json-render 组件接入

本分支使用 `@json-render/core`、`@json-render/react`、`@json-render/shadcn` 的 `0.21.1` 版本。全部 36 个组件的属性定义直接使用 `shadcnComponentDefinitions`，React 实现直接使用 `shadcnComponents`。没有复制组件实现或改写官方属性；旧版自定义 `Choice`、`MemoryAddress` 等已移除。

## 查看示例

打开 `/docs/408/knowledge/smart-ui-demo/`，主页面有三个学习场景：

1. Cache 映射判断：选择答案、检查推理、打开推导过程；改选后清除旧反馈。
2. TCP 报文对照：握手与挥手切换，报文字段逐行展示，手机无需横向拖动。
3. 一轮复习：设置科目与具体问题，独立设置专注时长，按三个任务计算进度。

其他官方组件放在“展开组件体验区”中，按需打开。主场景和可选区域合计覆盖全部 36 个组件；加载状态只在手动预览时出现，并可主动结束。

示例源文件为 `scripts/generate-smart-ui-examples.mjs`，运行 `node scripts/generate-smart-ui-examples.mjs` 更新 MDX，再运行 `npm run smart-ui:catalog` 更新导出说明。

保留统一的预览 / JSON 外框、复制和重置功能。状态由官方 `JSONUIProvider` 管理，块之间独立，刷新和重置后复原。弹窗、抽屉、选项菜单沿用官方 Radix 行为及焦点管理。

## 样式

官方组件保留原始 DOM、属性和交互实现。`app/global.css` 扫描官方包的 Tailwind 类；`smart-ui.css` 统一展示层，修正移动端布局：

- 外框只承担预览 / JSON / 重置；示例默认使用 Stack，避免重复标题和多层卡片。已有文档的根 Card 也会自动去掉重复边框，真正的内部内容卡片保留边框。
- 标签栏高度由内容决定，可换行。移除 overflow-x:auto 隐式产生的 overflow-y:auto，避免 1px 溢出出现手机竖向滚动条。
- 表格保留真实 table 语义，单元格和说明允许换行；检查内部容器宽度，不以“页面不溢出”代替可读性检查。
- 控件保留站点黑白灰语义令牌；主要触控区域至少 44px。轮播箭头放在内容下方，避免挤压手机轮播宽度。

## 如何自定义组件

可以分三个层次调整：

1. **选项与样式**：JSON 使用官方已有 props / variant；Card、Stack、Grid 支持 className 布局类。全站颜色、字体、圆角由主题令牌控制，局部适配写在 `smart-ui.css`。
2. **替换某个实现**：在 `components/smart-ui/registry.tsx` 中展开 `shadcnComponents`，覆盖指定名字的 React 实现。保持原属性约定就能继续读取已有文档。官方包的实现自带 UI 原语，不会因为修改本地 `components/ui/` 就自动变化；不直接编辑 node_modules。
3. **增加新类型**：在 `lib/smart-ui/catalog.ts` 扩展属性定义，并在 registry 注册对应实现，随后更新验证、测试和 `smart-ui:catalog` 导出文件。函数图、时序图都可以作为这种扩展，但当前分支尚未新增绘图类型。

目前仍是直接注册官方 36 个实现，只调整展示样式与示例；没有用自定义组件替代官方 Table 或 Tabs。JSON 文档不能凭空声明一个 React 组件，也不能执行任意 JavaScript。

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

浏览器脚本：`scripts/verify-smart-ui-browser.js`，通过 Playwright CLI 的 `run-code --filename` 执行。覆盖三个主场景与可选组件区、真实剪贴板复制、状态隔离、弹窗/抽屉、明暗主题，以及 320/360/393/430/768/1440px 布局。另在 320/393px 放大根字号到 20px，检查标签栏的纵向滚动和每个表格单元格是否被裁切。

官方参考：[组件 API](https://json-render.dev/docs/api/shadcn)、[Catalog](https://json-render.dev/docs/catalog)、[状态绑定](https://json-render.dev/docs/data-binding)。
