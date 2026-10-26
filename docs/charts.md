# Study 图表设计系统

`components/charts` 是一套基于 shadcn/ui `ChartContainer` 与 Recharts 3 的图表族。作者在 MDX 中只写数据和语义参数，视觉、交互与无障碍行为由组件统一提供。可运行的示例、代码与支持矩阵见站内页面 `/blog/chart-gallery`。

## 版本基线

| 项目 | 版本 | 结论 |
| --- | --- | --- |
| recharts | 3.10.1 | 与 shadcn 当前 chart 文档一致（文档写明 “now uses Recharts v3”），**不需要升级** |
| shadcn `ui/chart.tsx` | 仓库内的 v3 适配版（`initialDimension` + 首次测量后再挂载） | 保留；新组件全部通过它渲染 |
| shadcn v3 迁移注意点 | 使用 `var(--chart-1)` 而不是 `hsl(var(--chart-1))`；`ChartContainer` 必须有确定高度；`<BarChart>` 已设置 `layout` 时，`<Bar>` 上不要重复设置 | 均已遵守 |

## 目录

```
components/charts/
  core/         纯函数（有单元测试）：format、scales（对数刻度、断轴、nice 刻度）、
                series（固定槽位配色、隐藏切换）、labels（像素空间标签避让）、
                tradeoff（性能-成本模型、帕累托前沿）、export（SVG/PNG/CSV）
  primitives/   ChartFigure（标题、工具栏、图例、表格视图、空/错状态、动效上下文）、
                ChartLegend、ChartTooltipPanel、ChartDataTable、纹理图案、useChartSeries
  types/        每个文件一种图表，对外的 MDX API
  chart-tabs*   响应式视图切换（被 StudyChartSwitcher 与 claude-benchmarks 共用）
styles/tokens/charts.css   全部图表 token（明/暗，study/editorial 两个主题）
lib/mdx/remark-mdx-preview.ts   ```mdx preview 代码块 → 实时预览 + 源码
```

## 审计发现（改造前）

1. 图表配色 `--chart-frame-study-1..5` 没有通过 dataviz 校验：4 个颜色的色度低于下限，相邻色对正常视觉 ΔE 为 10.9（下限 15）。
2. 没有系列隐藏、下载、数据表视图和空数据状态；`StudyScatterChart` 不能用键盘访问。
3. 不支持对数轴、气泡、混合、雷达、径向、树图、漏斗、指标切换。
4. 数值轴使用 Recharts 默认刻度，会出现 0/7/14/21 这样的刻度。
5. `figcaption` 不是 `figure` 的直接子元素（HTML 结构不合法）。
6. 600 行的单文件实现，存在两套重复的 frame 与动效上下文（Study 一套、claude-benchmarks 一套）。

`Study*` 系列的原有 props 全部保持兼容（`description` 作为 `subtitle` 的别名保留）。图表组件画廊在 `/blog/chart-gallery/` 维护。

## 设计决策

- **颜色最后决定，并且要计算验证。** 分类色板固定顺序，不循环取色；第 9 个系列使用 `--chart-other`。浅色与深色两套色阶都通过了 `validate_palette.js` 的检查；前 3 个颜色还通过了“所有色对”检查，因此散点图建议不超过 3 组。
- **只用一根数值轴。** 不提供双 Y 轴，`StudyComposedChart` 中的柱、线、面积共用同一根轴。
- **标记规格**：线宽 2px（tradeoff 图 3px）；柱宽上限 24px，数据端 4px 圆角、基线端直角；堆叠段之间用 2px 面板色间隙分隔；点外圈有 2px 表面色描边（editorial 主题改为 1px 墨色描边）。
- **文字不使用系列色**，身份由文字旁边的色块承担。
- **对数轴刻度**使用 1-2-5、1-1.5-2-3-4-5-7 这类易读的尾数；定义域会向外吸附到最近的刻度（例如 10 和 50）。
- **断轴**：数据离零较远时，Y 轴压缩 0 到数据下限之间的空白区间，保留 0 刻度并画出断轴标记，不悄悄从 48 开始画。

## 参考页面研究记录

研究方式：在本仓库的 Playwright Chromium 中实际打开页面，逐屏截图；读取 DOM、计算样式与 CSS 规则；模拟悬停、点击、触摸，以及 390px 宽度、深色偏好和减少动态效果偏好。下文中，**已确认**表示有 DOM、CSS 或网络请求证据，**推测**表示只能从现象推断。

### anthropic.com/claude-fable-and-mythos-5-1 的四组性能-成本图

| 观察 | 结论 |
| --- | --- |
| 图形由手写 SVG 实现，不是 Recharts 或 canvas（类名为 `chart-module…__line / __mark / __grid / __axisLine`） | 已确认 |
| 视图切换：`role=tablist`，四个纯文字 tab，15px/600；未选中为 `#87867f`，选中为 `#141413`；窄屏收起为 “+” 溢出菜单 | 已确认 |
| 面板：1px 墨色边框、直角、纸色底 `#faf9f5`；标题 17px/600 左对齐，副标题 “Accuracy vs Cost” 15px 灰色右对齐；图例在右上方 | 已确认 |
| 线条：`stroke-width:3px`，颜色为系列色与墨色的 `color-mix`；`pathLength=1`，通过 `stroke-dashoffset` 过渡实现绘制动画，`[data-armed]` 作为预备态；圆点与标签在绘制到 70% 时淡入 | 已确认（CSS 规则） |
| 点：`r=7`，系列色填充，1px 墨色描边；另有 r=7 的透明命中圆；“含工具 / Mythos” 系列使用斜线或点阵 pattern | 已确认 |
| 档位标签：12px，墨色，`paint-order: stroke` 加 4px 纸色描边作为光晕；位置在上方或下方之间切换以避开碰撞 | 前半已确认；避让算法为推测 |
| 网格只有水平线，颜色 `#d1cfc5`；左轴和下轴为墨色实线；刻度 14px，颜色 `#5e5d59` | 已确认 |
| Y 轴不从零开始时使用 zigzag 断轴标记，并保留 “0” 刻度 | 已确认（截图 + `.axisBreak` 规则） |
| 提示框是 SVG 内的 `<g>`：墨色圆角矩形（rx 6），上行为 “系列 · 档位”，下行为 “值 · 成本” | 已确认 |
| 可访问性：每个点是 `g[role=img][tabindex=0]`，带 `aria-label` | 已确认 |
| 图例为按钮，可切换系列（非激活项 opacity 0.4）；存在下载按钮（`.download`、`data-chart-exporting`） | 已确认存在；导出格式为推测 |
| 页面在 `prefers-color-scheme: dark` 下仍渲染浅色；CSS 中有 lightningcss 生成的深色变量分支 | 已确认 |

Study 复用了其中的**交互与动效思路**（绘制动画、档位标签光晕、SVG 内的墨色提示框、断轴、文字 tab 加溢出菜单），没有使用其字体、Logo、文案或数据。示例数据均为虚构，并在图注中标为“示例数据”。

### 发布页首屏

| 页面 | 观察 | 证据 |
| --- | --- | --- |
| Claude Fable 5.1 / Mythos 5.1 | 全屏 `<canvas data-engine="three.js r182">`，场景为天空、云层和月亮；会加载 `/fx/hero/tit.glb`；标题使用 anthropicSerif 67px/400，第二行右移错位；带点状引导线的章节目录 `[1]……`；左下角有三个色点（推测为场景配色切换）；滚动时首屏内缩 | 已确认：canvas、GLB 请求、字体、目录；推测：色点用途 |
| Claude Opus 5.5 | 深色 canvas 舞台加两侧拼贴纸纹理；`<h1>` 为视觉隐藏，可见标题是 SVG；日出式渐变；窄屏只显示 “Introducing” 加 “Scroll down” 按钮 | 已确认：h1 视觉隐藏、可见标题为 SVG、径向渐变 |
| Claude Haiku 5.5 | 开场有一段拼贴图片序列，带 “Skip intro” 按钮；随后标题沿弧线绘制（`canvas` 位于 `.bent` 中），下方有一条 `.line` canvas 绘制的弧线；真实 `<h1>` 为 88px serif，字距 -1.3px；页面有 30 条 reduced-motion 媒体规则 | 已确认：DOM 结构、字体、reduced-motion 规则数量 |
| GPT-6.1 Sol | 黑底，canvas 绘制星点和太阳（移动端截图中可见，桌面端 headless 下未渲染）；“GPT-6.1” 与 “Sol” 分列左右，OpenAI Sans 64px/500，字距 -1.92px | 已确认：字体、canvas、径向渐变；推测：太阳随滚动出现 |
| GPT-6 Sol and Luna | 纯黑底，居中无衬线标题 64px/500，`text-wrap: balance`，下方有一行导语和 “Share” 按钮 | 已确认 |
| GPT-6 for everyone | headless Chromium 中样式表未生效，第二次加载显示 “This page couldn't load”；SSR 标记显示首屏是居中的元信息、标题（`text-balance`）加 16:9 媒体区域 | **未能完整核验**，仅从 SSR 标记得出 |

共同点（已确认）：标题都是真实文本节点，视觉标题由 SVG 或 canvas 绘制时也保留了 `h1`；动效层与文字层分开；都写有 reduced-motion 规则。Study 的 `BlogHero` 以这几点为底线，不复制任何素材、字体或品牌元素。
