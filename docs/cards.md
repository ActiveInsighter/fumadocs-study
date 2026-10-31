# 卡片与卡片步骤

`components/mdx/card` 提供 MDX 的 `Card`、`Cards`、`CardSteps`、`CardStep`，
`components/mdx/icon.tsx` 提供按名字使用 Lucide 图标的 `Icon` 与 `renderIcon`。
实时示例见 `/blog/card-components`。

## 设计

```
components/mdx/icon.tsx      图标名 → Lucide 组件（服务端查表）；emoji 原样显示；Icon 行内图标
components/mdx/card/
 ├─ parts.tsx                CardRoot / CardIcon / CardTitle / CardDescription / CardBody
 ├─ card.tsx                 Card、Cards：parts 的组合，属性与官方 Fumadocs 一致
 ├─ steps.tsx                CardSteps、CardStep：同样由 parts 组合
 ├─ layout.ts                纯函数：估算文字量，决定横排 / 竖排与每行张数
 ├─ children.ts              纯函数：读取 MDX children（展开 Fragment 与 MDX 包的段落）
 └─ index.ts
styles/doc-card.css          卡片与网格（文档和博客通用，不限定 #docs-body）
styles/doc-card-steps.css    步骤列表：计数器、箭头、容器查询下的横排
```

- 全部是服务端组件，不带自己的客户端脚本。图标名表包含 Lucide 的全部导出，只在服务端使用，
  **不要在 `'use client'` 文件里导入 `icon.tsx`**；浏览器只收到实际用到的图标路径。
- 每个部件都有 `data-slot`，根元素有 `data-tone`；样式只读这些钩子和 `styles/tokens` 的变量，
  明暗主题自动适配。根元素保留官方的 `data-card`，正文的链接样式不会套到链接卡片上。
- 新的卡片变体从 `parts.tsx` 组合，外观与行为自然一致。

## 图标

`icon` 接受 [Lucide](https://lucide.dev/icons) 图标名，写法不限：`GitBranch`、`git-branch`、
`gitBranch`、`git_branch`、`GitBranchIcon`、`LucideGitBranch`，以及 Lucide 别名（`curly-braces` 即 `Braces`）。

- 不像图标名的字符串（emoji、汉字）原样显示在图标位；React 节点直接透传，旧写法 `icon={<svg />}` 不受影响。
- 未知图标名不渲染图标，并在开发 / 构建日志中提示一次。
  `tests/doc-cards.test.tsx` 会检查 `content/` 中所有 `Card`、`CardStep`、`Icon` 的图标名。
- 行内图标：`<Icon name="terminal" />`，大小跟随文字；默认对读屏软件隐藏，加 `label="…"` 后作为图片朗读。

## Card / Cards

```mdx
<Cards columns={3}>
  <Card icon="book-open" tone="info" title="图表画廊" href="/blog/chart-gallery" description="一句描述" />
  <Card icon="🎯" title="本章目标">正文可以写任意 MDX。</Card>
</Cards>
```

| 属性 | 说明 |
| --- | --- |
| `icon` | Lucide 图标名、emoji 或 React 节点 |
| `title` / `description` | 标题、一行描述；正文写在标签之间 |
| `href` / `external` | 整卡链接；外链自动识别 |
| `tone` | `primary`、`info`、`success`、`warning`、`error`、`idea`，给图标块着色 |
| `Cards columns` | 每行最多几张（1–4，默认 2）；卡片窄于 15rem 时自动减列，不需要断点 |

一行写完的 `<Card …>文字</Card>` 会被 MDX 包进段落，`Cards` 会把它们取出来，照常排成网格。

## CardSteps / CardStep

官方 `Steps` 适合详细过程；`CardSteps` 用一张卡片概括一步，适合一眼看完全程。

```mdx
<CardSteps>
  <CardStep icon="scan-search" title="读题">圈出已知量和所求量。</CardStep>
  <CardStep icon="route" title="选方法">按题型匹配解题模板。</CardStep>
  <CardStep icon="check-check" tone="success" title="验算">代回原式检查结果。</CardStep>
</CardSteps>
```

| 属性 | 说明 |
| --- | --- |
| `layout` | `auto`（默认）、`row`、`column` |
| `columns` | 横排时每行几张，2–4；默认按步骤数均分（5 → 3 + 2，7 → 4 + 3） |
| `start` | 第一步的序号，默认 1 |
| `CardStep step` | 用任意文字代替序号 |
| `CardStep` 其余属性 | 与 `Card` 相同 |

- 有图标时图标块显示图标，右上角显示 `01`；没有图标时图标块显示序号。序号来自列表上的 CSS 计数器，
  `CardStep` 不依赖父组件传值；`<ol>` 本身向读屏软件提供顺序。
- 步骤可以一行写完，也可以把正文写在单独的行里。

### 自动布局

`layout.ts` 在服务端估算每一步的文字量（汉字计 1，字母数字约 0.55，空格 0.3），
按 `CARD_STEPS_ROW` 中的版心宽度（44rem）、间距和字号算出一行 N 张时每行能放几个字：

1. 先试一行放下全部（最多 4 张，超过时均分成几行），偶数步再试一行两张；
2. 每一步的标题不超过 2 行、正文与描述不超过 4 行、顶层块不超过 2 个，且不含代码块、表格、公式块时横排；
3. 否则竖排。

浏览器端只负责“够不够宽”：`styles/doc-card-steps.css` 以列表为容器，宽度足够时才按列排开，
否则退回竖排（一行四张会先变成两张）。所以手机上始终竖排。

外观随排列方式切换：竖排时图标块在左、标题与图标居中对齐、箭头向下；横排时图标块在上、箭头向右，
每行最后一张不画箭头。这些差异都是列表上的一组 CSS 变量，断点处一次替换。

## 扩展

- **新色调**：在 `styles/doc-card.css` 为新的 `data-tone` 写一行 `--card-accent`。
- **调整自动布局**：修改 `CARD_STEPS_ROW`（版心宽度、最多几行、最多几张）。
  改动最多张数时，同步 `doc-card-steps.css` 中对应的容器查询。
- **新的卡片变体**：组合 `CardRoot`、`CardIcon`、`CardTitle`、`CardDescription`、`CardBody`。
- **AI Markdown 导出**：`lib/question-markdown.mjs` 把 `Card` 与 `CardStep` 的标题和描述写成正文。

针对性验证：`npm test -- tests/doc-cards.test.tsx tests/question-markdown.test.ts`。
