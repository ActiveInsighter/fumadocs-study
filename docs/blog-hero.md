# BlogHero / MotionScene

博客文章只要在 frontmatter 中写一段 `hero`，就能获得可配置的首屏。没有这段配置的文章保持原样。示例见 `content/blog/designing-study-charts.mdx`。

```yaml
hero:
  preset: dataflow     # minimal | aurora | dataflow | paper
  accent: indigo       # indigo | clay | teal | ochre | plum | moss（取自图表色板）
  tone: dark           # auto（跟随站点主题）| light | dark
  height: tall         # compact | tall | screen
  align: center        # center | start
  headline: "第一行\n第二行"   # 可选，默认使用 title
  deck: 导语            # 可选，默认使用 description
  eyebrow: 2026 年 10 月  # 可选，默认使用日期
  index: true          # 用文章的 h2 生成编号目录
  facts:               # 最多 4 项
    - label: 阅读时间
      value: 8 分钟
  series: [18, 27, 33, 41]   # dataflow 预设绘制的上升曲线
  intensity: calm      # calm | lively
  scroll: true         # 滚动视差与淡出
  seed: 7              # 固定场景布局（默认按标题哈希）
```

字段定义与校验在 `components/blog-hero/schema.ts`（zod），由 `source.config.ts` 引用，写错字段会在构建时报错。

## 架构

| 文件 | 职责 |
| --- | --- |
| `blog-hero.tsx` | 服务端组件：渲染 eyebrow、`<h1>`、导语、目录、要点；场景层标为 `aria-hidden` |
| `hero-scroll.tsx` | 客户端组件：用 Motion `useScroll` 把滚动进度写入 CSS 变量 `--hero-p`，位移和透明度都由 CSS 计算 |
| `hero-scene.tsx` | 客户端组件：先判定动效等级，再按预设懒加载场景（`React.lazy`），视口外暂停 |
| `scenes/aurora-scene.tsx` | 渐变光斑用 CSS transform 动画；粒子用 2D canvas（DPR 上限 2，带帧时监控） |
| `scenes/dataflow-scene.tsx` | SVG：点阵网格、数据流虚线、SMIL 粒子，以及用 Motion `pathLength` 绘制的上升曲线 |
| `scenes/paper-scene.tsx` | SVG：纸艺层叠山丘、地平弧线、静态纸纹；各层随滚动以不同速度位移 |
| `motion-scene.tsx` | 同一套场景作为 MDX 行内插图：`<MotionScene preset="aurora" />` |

## 性能与可访问性约束

- **LCP**：标题、导语、目录都在静态 HTML 中，第一帧即可见；标题只做 `transform` 入场，不从透明开始。实测（dev 环境、Playwright）中 LCP 元素为标题的 `span`，CLS 为 0。
- **CLS**：首屏高度由 CSS 的 `min-height` 决定，场景层绝对定位。脚本加载前先显示纯 CSS 海报背景。
- **水合**：`useHeroMotion` 在服务端和首次客户端渲染中都返回 `null`，挂载后才确定等级，避免 hydration mismatch。
- **降级**：
  - `prefers-reduced-motion` 或 Save-Data → `static`：只渲染静态一帧；
  - CPU 核数 ≤ 4 或内存 ≤ 4 GB → `reduced`：粒子与数据流减半，关闭指针响应；
  - canvas 平均帧时持续超过 34ms → 自动停在当前一帧。
- **暂停**：IntersectionObserver 加 `visibilitychange` 检测，离开视口或切到后台时停止 rAF、CSS 动画与 SMIL 动画。
- **SEO**：真实 `<h1>`；文章页补充 `openGraph.type = article` 与 `publishedTime`。
- **打印**：隐藏场景层。

## 为什么不用 WebGL

参考页面中有一页使用了 three.js 加 GLB 模型。对学习站点来说，首屏 JS 体积和低端设备体验更重要，所以四种预设都只使用 CSS、SVG 和 2D canvas。如果将来确实需要，可以把 WebGL 场景作为第五种预设，沿用同样的懒加载与降级机制。
