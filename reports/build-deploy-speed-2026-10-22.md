# 构建与部署提速（2026-10-22）

分支 `ccr-25cff76e-9ib8hv`，全部在 GitHub Actions 中构建并部署到隔离预览 Worker `fumadocs-preview-ccr-25cff76e-9ib8hv`，未改动 main 与生产 Worker。

## 瓶颈定位

以 main 最近一次生产部署 [39694786983](https://github.com/ActiveInsighter/fumadocs-study/actions/runs/39694786983) 为样本（约 8 分钟）：

- 8 个分片的页面构建本身只需约 1.5 分钟。
- `wrangler deploy` 占 218 秒：应用代码一改动，所有页面的 HTML/RSC 都会变化（chunk 哈希与 build id 嵌在每一页里），需要重新上传 3335 个文件。wrangler 批量上传的并发写死为 3，且以 base64 上传。
- 合并步骤有一个隐藏 bug：`rm -rf /tmp/shard-extract/*` 不会删除隐藏目录 `.static-docs`，导致每合并一个分片都要重新哈希之前所有分片的文件。

## 改动

1. **分片并行预上传**（`scripts/upload-cloudflare-assets.mjs`）：每个分片构建完成后，直接把自己产出的文件上传到目标 Worker 的资产存储（Cloudflare 官方 direct-upload 协议）。哈希算法与 Content-Type 与 wrangler 完全一致，因此最终仍由官方 `wrangler deploy` 发布，它只需上传剩余文件。该步骤 `continue-on-error`，失败时 wrangler 会照常上传。
2. **KaTeX 预渲染为 HTML 字符串**（`lib/mdx/rehype-katex-html.ts`）：每个公式不再展开成几十个 React 元素，而是一个带 `dangerouslySetInnerHTML` 的 span，DOM 不变。RSC 体积和行数减少，静态生成更快，水合时也跳过公式内部节点。
3. **修复合并循环**：每次合并都重建解压目录。
4. **全局安装 Wrangler**：`wrangler-action` 找不到匹配版本时，会在项目内执行 `npm i wrangler`，从而安装整个依赖树（约 500 个包、约 25 秒）。先全局安装同版本即可跳过。
5. Worker 名称改由 `scripts/cloudflare-worker-name.sh` 统一计算，部署与预上传不会不一致。

## 实测（同一预览 Worker，8 分片）

| Run | 场景 | 总耗时 | 部署 job | wrangler 上传 |
| --- | --- | ---: | ---: | --- |
| [39699816293](https://github.com/ActiveInsighter/fumadocs-study/actions/runs/39699816293) | 基线（= main） | 409 秒 | 319 秒 | 5174 个文件，146 秒 |
| [39702277477](https://github.com/ActiveInsighter/fumadocs-study/actions/runs/39702277477) | 优化后，页面全部变化 | 250 秒 | 132 秒 | 0 个文件（分片已并行上传约 1.7 GB，每片约 20 秒） |
| [39703099988](https://github.com/ActiveInsighter/fumadocs-study/actions/runs/39703099988) | 加入全局 Wrangler，内容未变 | 199 秒 | 115 秒 | 0 个文件；各分片仅补传 0–9 个文件 |

- 合并步骤：14 秒 → 约 4 秒。
- 部署 job 剩余时间主要是部署后的 Headless Chrome 导航验证（约 70 秒）。这是有意保留的质量门禁。
- 公式密集页 `/docs/math/knowledge/linear-algebra/06-quadratic-forms/`：HTML 2.44 MB → 2.26 MB，`index.txt` 1.46 MB → 1.13 MB。整篇文章截图与生产环境逐像素一致（0 个差异像素）。水合后由 React 管理的 DOM 节点从 15,868 个降到 1,484 个；4 倍 CPU 节流下，主线程长任务时间在误差范围内（中位数 6.6 秒对 6.6 秒）。这一页的成本主要来自布局，不在公式水合。

## 说明

- [39701087235](https://github.com/ActiveInsighter/fumadocs-study/actions/runs/39701087235) 的 Headless Chrome 检查在知识点导航处超时 30 秒。部署本身成功。在本地用同一脚本对同一部署复测通过；之后两次 CI 运行也均通过。原因未查明，作为一次偶发失败记录在此，未视为通过。
- 首次 KaTeX 实现只遍历 hast 元素，漏掉了位于 MDX 组件内部的公式。现已修复，并补充了针对嵌套组件的测试。

## 第二轮：浏览器验证

- 内联在 workflow 中的 Headless Chrome 检查移到 `scripts/verify-deployment-browser.cjs`，断言不变，拆成 15 个独立场景并发执行（4 路）。某个场景失败时其余场景照常运行，并打印该场景的失败请求。
- 每个场景使用独立的浏览器上下文。同一窗口里的后台标签页不执行 `requestAnimationFrame`，会让 Puppeteer 的 locator 点击卡住约 35 秒。导航后固定等待 1.2 秒，改为等待网络空闲。
- 搜索场景原先从知识点总览页出发，只等待弹窗关闭，可能在未发生跳转时就通过。现改为从必然不是结果的页面出发，等待 URL 变化后再检查结果页。
- 实测：本机对预览部署由 53 秒降到约 20 秒，连续 3 次通过；CI 中 18.5 秒（[39707366229](https://github.com/ActiveInsighter/fumadocs-study/actions/runs/39707366229)）。搜索场景修正后再次部署为 19.9 秒，部署 job 84 秒，总耗时 177 秒（[39707801293](https://github.com/ActiveInsighter/fumadocs-study/actions/runs/39707801293)）。原先该检查约 68 秒，部署 job 319 秒，总耗时 409 秒。
- 测试：清理了全量 `npm test` 中的 13 个旧失败。
  - 删除 7 个只针对已退役功能的测试：EdgeOne SSR 产物裁剪、EdgeOne 压缩与缓存检查，以及 5 个 EdgeOne Blob 下载网关测试（对应的 `app/download`、`edgeone/` 与 `deploy-edgeone-functions.yml` 均已不存在）。
  - 更新 6 个仍在守护现有行为的测试：静态路由参数、Dynamic Mode 按需编译正文、根目录与数学/政治模块结构（已加入算法模块和新增章节）、词汇页 full 模式（仅 JSX 换行不同）。
  - 现在全量 35 个文件、221 个测试全部通过，耗时约 9 秒。CI 改为直接运行 `npm test`，不再维护手写的测试文件清单。
