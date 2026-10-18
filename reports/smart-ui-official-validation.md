# 官方组件版验证

- 项目：`/home/dev/Documents/Project/fumadocs-study`
- 分支：`feat/smart-ui-official`，基于原预览分支的 `f40dcbb`。
- 官方组件：`@json-render/shadcn@0.21.1`，core / react 同为 `0.21.1`。
- Catalog 与 Registry 分别直接引用官方的 `shadcnComponentDefinitions` 和 `shadcnComponents`；全部 36 个组件均开放，并被六个真实文档示例覆盖。
- 删除原自定义组件实现和 Cache 地址计算；统一主题、保留预览 / JSON、复制和重置。

## 验证结果

- 聚焦与部署相关测试：15 个文件、81 项通过，见 `smart-ui-official-tests.log`。
- 真实文档路由生产静态构建：通过，见 `smart-ui-official-build.log`。仅导出示例页，本机构建未重建全站搜索。
- 浏览器：六个例子全部通过，无页面 JavaScript 异常，见 `smart-ui-official-browser.log`。
- 覆盖答题反馈、输入/下拉/复选/开关、滑块与进度联动、Tabs/Accordion、Dialog/Drawer、Popover/DropdownMenu、Collapsible、Toggle/ToggleGroup/ButtonGroup、Pagination、Carousel、图片、JSON 切换、块间状态隔离、重置和刷新。
- 检查明暗主题、375px 宽度、各块无内容裁切、手机弹窗不溢出；截图见 `smart-ui-official-light.png`、`smart-ui-official-dark.png`、`smart-ui-official-mobile.png`。
- 静态构建的依赖扫描兼容隔离目录；浏览器同时检查官方按钮背景，防止控件逻辑正常但 Tailwind 样式缺失。
- 全仓 `npm run typecheck` 仍有 15 项既有错误，与 `smart-ui-baseline-typecheck.log` 的错误文本完全相同；新代码无新增错误，生产构建中的类型检查通过。
- 原有依赖版本均未变更；新增官方包及其依赖。

本地仅单页导出，其他页面的预取与原有 favicon 可能 404；这些网络记录不是页面 JavaScript 异常。远端预览由既有 Cloudflare Actions 全站构建完成，运行链接在会话最终答复中提供。

## 上游行为说明

官方 Progress 的 max 字段目前不参与计算，示例按百分比使用；其内置原语只更新 indicator 的视觉值，未给根节点传递 aria-valuenow。这里保留官方实现，滑块同时显示文字数值。官方分页和轮播按钮中的 Previous/Next 文案保留默认英文。
