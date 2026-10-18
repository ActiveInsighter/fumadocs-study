# 智能 UI 手机布局与学习示例重构

分支：`feat/smart-ui-official`，基于 `2e1ba4e`。保留全部 36 个官方组件定义及原始 React 实现。

## 已解决的审查发现

- `components/smart-ui/smart-ui.css:37`：标签栏原来的 overflow-x:auto 隐式产生 overflow-y:auto，内容仅溢出 1px 就显示竖向滚动条。改为内容决定高度、允许换行、非滚动容器。
- `app/claude-benchmarks.css:46`：全局 Markdown 表格规则通过 !important 强制单行和 max-content，影响交互表格。将智能 UI 排除于该规则，同时在 `app/global.css` 隔离普通 Markdown 的表格装饰。
- `components/smart-ui/smart-ui.css:68`：交互表格允许字段、表头与 caption 换行，保留真实表格语义，检查单元格与内部容器的宽度。
- `components/smart-ui/renderer.tsx:21`：外框与根 Card 叠加浪费手机宽度。示例默认以 Stack 为根，已有根 Card 也自动去掉重复边框；内容留白缩小，触控区扩大。
- `scripts/generate-smart-ui-examples.mjs`：重写为 Cache 判断、TCP 报文对照、一轮复习三个主场景。其他组件收进可展开区域，加载状态可手动显示并结束。进度按真实任务计数，时长不再冒充完成度。

## 验证结果

- 15 个文件、83 项相关测试通过，见 `smart-ui-refactor-tests.log`。
- 示例页生产静态构建通过，见 `smart-ui-refactor-build.log`。
- 浏览器检查通过，无页面 JavaScript 异常，见 `smart-ui-refactor-browser.log`。
- 布局检查：320、360、393、430、768、1440px；另在 320/393px 将根字号从 16px 放大到 20px，检查主页面与展开的组件区。共 10 组布局检查，均通过。
- 每组布局同时检查握手和挥手：标签栏没有纵向滚动，表格不比内部容器宽，单元格不使用 nowrap 且无内部裁切。
- 回归检查普通 Markdown 表格：仍是单行单元格和横向滚动容器。
- 功能覆盖：选错/选对/改选清除反馈、弹窗、真实剪贴板复制 JSON、切换 JSON 保持状态、复习任务与百分比同步、时长独立、块间重置隔离、刷新恢复、可选组件交互与抽屉。
- 明暗主题人工检查截图：`smart-ui-refactor-mobile-light.png` / `smart-ui-refactor-mobile-dark.png`、`smart-ui-refactor-light.png` / `smart-ui-refactor-dark.png`。旧预览的对照截图：`smart-ui-refactor-before.png`。
- 全仓类型检查仍为与最初基线完全相同的 15 项既有错误，无新增错误；见 `smart-ui-refactor-typecheck.log`。

浏览器验证为 Chromium 的手机宽度与字号检查，未声称经过物理 Android 设备测试。本地单页导出中的其他页面预取和旧 favicon 404 与页面 JavaScript 异常分开记录。

## 组件自定义

详见 `docs/smart-ui.md` 的“如何自定义组件”：主题/样式与现有 props、保留接口替换 registry 实现、扩展 catalog + registry 新增类型。官方默认组件不等于样式不可修改；JSON 仍只能使用站点已注册的类型和属性。
