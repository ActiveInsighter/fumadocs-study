# json-render 文档接入验证

- 项目：`/home/dev/Documents/Project/fumadocs-study`
- 分支：`feat/smart-ui-documents`，起点 `519f715`。
- 依赖：`@json-render/core@0.21.1`、`@json-render/react@0.21.1`、`zod@4.4.3`。
- 验证日期：2026-10-18；本机 Node 24.22.0 / npm 11.19.1（项目声明 Node 22.x）。

## 结果

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 锁定依赖安装 | 通过，`npm ci`，随后安装两个 json-render 包并显式声明 Zod | `package-lock.json` |
| 功能与相关管线测试 | 4 文件、42 项全部通过，其中智能 UI 测试 19 项 | `smart-ui-focused-tests.log` |
| 测试页生产构建 | 通过，约 64.21 秒；生产编译、TypeScript、单文档 SSG 均完成 | `smart-ui-demo-build.log` |
| 导出范围 | 仅 1 个文档 HTML、1 个 Markdown，保留 3 个 JSON 围栏及纸面答案 | `smart-ui-static-output.json` |
| 浏览器实测（开发预览） | 通过，无页面 JavaScript 异常 | `smart-ui-browser.log` |
| 浏览器实测（静态产物） | 通过，无页面 JavaScript 异常 | `smart-ui-static-browser.log` |
| 静态 JS/CSS 引用 | 24 个唯一引用全部存在 | `smart-ui-assets.log` |
| 仓库全量测试 | 之前 13 项失败，接入后仍为相同 13 项失败，没有新增失败 | `smart-ui-baseline-tests.log`、`smart-ui-final-tests.log` |
| 仓库类型检查 | 之前与之后均为相同 15 个 TypeScript 错误，没有新增错误 | `smart-ui-baseline-typecheck.log`、`smart-ui-typecheck.log` |

最初启动的全站构建已按用户要求中止，未将其计为通过。随后只运行 `npm run build:smart-ui-demo`：构建日志列出唯一文档路由 `/docs/408/knowledge/smart-ui-demo`，其他生成项是 Next.js 必需的错误页。没有重新生成全站搜索索引。预览包包含项目现有 public 静态资源，其中已有搜索文件会被复制，但不会重建。

全量测试最后一次记录在额外增加「非法块局部降级」测试之前；该测试以及最终代码都已被后续 42 项聚焦检查覆盖。原有失败涉及过时的导航期望、已迁移的 EdgeOne 文件/流程、文档发布测试及全站公式扫描超时；原有类型错误来自测试脚本的缺失类型声明、过期路径和隐式 any。此次没有扩大范围修复这些既有问题。

## 浏览器覆盖

- 单选题：空答案提醒、选错解析、选对反馈、修改答案后反馈变化、重置。
- Cache：初始地址 52、预设 180 / 64、键盘调整滑块；块号、行号、偏移随状态联动。
- 清单：勾选三项后 3/3 与完成提示，重置为 0/3。
- 三个交互块之间状态隔离；刷新恢复初始值。
- 375px 手机布局无页面横向溢出，暗色模式正常。
- 提示词文件可下载。
- 页面水合前禁用操作，交互脚本就绪后启用，避免过早点击丢失。

截图：`smart-ui-desktop.png`、`smart-ui-cache-mobile.png`、`smart-ui-cache-dark-mobile.png`，最终截图取自静态产物。

单页静态预览保留全站导航。未导出的其他页面及其 RSC 预取会产生 404，网站原有 favicon 也不存在；这些网络记录与交互运行异常分别记录。本次交互页面 JavaScript 异常为 0。该预览包只供验证这张页面，不是完整站点部署包。

## 查看与复现

```bash
npm run build:smart-ui-demo
python3 -m http.server 3020 --bind 0.0.0.0 --directory .static-docs-preview
```

打开 `http://localhost:3020/docs/408/knowledge/smart-ui-demo/`。

```bash
playwright-cli -s=fumadocs-smart-ui open http://localhost:3020/docs/408/knowledge/smart-ui-demo/
playwright-cli -s=fumadocs-smart-ui run-code --filename=scripts/verify-smart-ui-browser.js
npx vitest run tests/smart-ui.test.tsx tests/mind-map.test.tsx tests/static-docs-build.test.ts tests/static-doc-shards.test.ts
```

生成提示词：`public/smart-ui/authoring-prompt.md`。本次由 AI 在写作阶段生成示例，网站负责验证 JSON 并运行组件；未配置或测试在线自然语言生成 API，也未推送、合并或部署。
