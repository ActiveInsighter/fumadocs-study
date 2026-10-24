<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 项目 Skills（Claude 与其他 Agent 共用）

- 通用入口：`.agents/skills/<name>/SKILL.md`。
- Claude Code 入口：`.claude/skills/<name>/SKILL.md`，通过仓库内相对符号链接指向同一份文件。
- 只读取与当前任务相关的 Skill；按需读取它引用的规则和参考文件。
- 官方 Skill 的来源和内容哈希记录在 `skills-lock.json`；完整来源说明见 [.agents/skills/README.md](.agents/skills/README.md)。
- Skill 的通用示例须结合本仓库的版本、配置与已有组件使用；不得为匹配示例擅自初始化项目、升级依赖或覆盖用户修改。
- 项目构建与发布约定优先于通用 Skill 的构建建议。完整构建默认交给 `deploy-cloudflare-worker-assets.yml`，显式设置 `deploy=false`、`shards=8`；仅在用户明确要求时本机运行完整构建。正式发布或合并到 `main` 须有明确授权。

| 任务 | 读取的 Skill |
| --- | --- |
| React / Next.js 组件、渲染、数据请求和包体积优化 | `vercel-react-best-practices` |
| Fumadocs、MDX、导航、内容源、搜索、静态导出 | `fumadocs`（基于官方文档的本地 Skill） |
| Core Web Vitals、加载与交互性能审查 | `web-perf`（Cloudflare 官方） |
| Workers Static Assets、Wrangler、构建与部署 Actions | `cloudflare-workers-assets`（项目适配版） |
| Tailwind CSS 4、主题变量、源码扫描、响应式样式 | `tailwindcss`（基于官方文档的本地 Skill） |
| shadcn/ui 组件、CLI、主题与 Base UI 组合 | `shadcn`（官方；先检查已有组件及配置） |
| 页面视觉方向、排版、布局和界面设计 | `frontend-design`（Anthropic 官方） |
