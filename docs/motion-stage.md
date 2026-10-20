# MotionStage 动画演示组件

`components/motion-stage` 是一套由**步骤**驱动的动画演示框架，基于 React、shadcn/ui 和
`motion`（Framer Motion）构建，用来交互式讲解算法流程、网络协议、存储管理等知识点。

示例页：`content/docs/408/knowledge/motion-stage-demo.mdx`（站点路径
`/docs/408/knowledge/motion-stage-demo`）。

## 设计

```
MotionStage                  外壳：时间线、播放控制、讲解、代码/变量面板、画布
 ├─ StageProvider            播放状态（当前步骤、方向、播放/暂停、倍速），useStage() 读取
 ├─ 画布 children            任意内容；组件按当前步骤决定外观
 │   ├─ primitives           StageReveal / StageSwitch+StageCase / StageText / StageNode / StageBadge
 │   └─ scenes               SequenceDiagram / ArrayTrack / BlockGrid / AddressBits / FlowGraph
 ├─ StageCode / StageWatch   代码行高亮（steps[i].lines）、变量面板（steps[i].vars）
 ├─ StageNarration           当前步骤标题与说明（aria-live）
 └─ StageControls            重新开始、上一步、播放/暂停、下一步、分段进度条、倍速
```

- 场景只描述“第 n 步长什么样”，时间、输入和布局都由舞台统一处理。
- 所有 props 都是可序列化的纯数据，可以直接写在 MDX 里（MDX 页面是 Server Component）。
- 进入视口后才会自动播放（`autoPlay`），离开视口时暂停计时；遵循系统“减少动态效果”设置。
- 键盘：聚焦舞台后 `←` / `→` 切换步骤，空格播放 / 暂停，`Home` / `End` 跳到首尾。
- 颜色只来自 `styles/tokens`：任何带 `data-tone` 的元素都会得到
  `--tone-surface / --tone-border / --tone-solid / --tone-ink`（见 `styles/motion-stage.css`），
  可选 `neutral | blue | green | amber | rose | violet | teal | orange`，明暗主题自动适配。

## 步骤与门控

```ts
type StageStep = {
  title: string;
  description?: string;
  lines?: number[];                 // 高亮 code 的第几行（从 1 开始）
  vars?: Record<string, string | number | boolean | null>;
  duration?: number;                // 自动播放时本步停留的毫秒数，默认 2600
  tone?: StageTone;                 // 讲解序号的颜色
};
```

步骤从 **0** 开始计数。组件响应步骤的两种方式：

| 方式 | 写法 | 说明 |
| --- | --- | --- |
| 门控 | `at`、`activeAt`、`doneAt`、`mutedAt`、`splitAt` | `2`、`[1, 3]`、`"2+"`、`"1-3"`、`"-2"`、`"0, 3-4"` |
| 帧 | `frames={[...]}` | 第 n 帧对应第 n 步，帧不够时保持最后一帧 |

## 组件速查

| 组件 | 用途 | 关键 props |
| --- | --- | --- |
| `MotionStage` | 外壳 | `title` `description` `steps` `code`（推荐字符串数组）`codeTitle` `autoPlay` `loop` `aside` `minHeight` |
| `StageReveal` | 在指定步骤出现 | `at` `effect`（fade/rise/drop/scale/blur/slide）`inactive`（unmount/hold/dim）`delay` |
| `StageSwitch` + `StageCase` | 同一位置按步骤切换内容 | `StageCase at` |
| `StageText` | 按步骤变化的行内文字 | `values` |
| `StageNode` | 通用节点块 | `label` `sub` `tone` `at` `activeAt` `doneAt` `mutedAt` `shape` `layoutId` |
| `StageBadge` | 小标签 | `tone` |
| `SequenceDiagram` | 时序图：协议报文往来 | `actors` `messages[{from,to,label,detail,at,tone,lost,dashed}]` `states[{actor,at,label,tone}]` |
| `ArrayTrack` | 数组：排序、查找、双指针 | `frames[{values,active,compare,done,muted,range,pointers}]` `variant`（cells/bars） |
| `BlockGrid` | 槽位：页框、Cache 行、TLB、磁盘块 | `blocks` `frames[{set,active,muted,marks}]` `columns` `indexLabel` |
| `AddressBits` | 地址字段拆分 | `fields[{label,bits,tone,value,activeAt}]` `splitAt` |
| `FlowGraph` | 流程图、状态机、查找路径 | `nodes[{id,label,x,y,shape}]` `edges[{from,to,label,curve}]` `frames[{active,done,muted,edges}]` `minWidth` |

注意事项：

- MDX 会去掉 JSX 属性中多行模板字符串的续行缩进，`code` 请写成字符串数组。
- `BlockGrid` 的 `set` 是持久修改（之后的步骤继续生效），`active` / `muted` / `marks` 只作用于当前步骤。
- `ArrayTrack` 按“第 k 次出现的同值元素”追踪身份，交换会以移动动画呈现。
- 用 `StageReveal inactive="hold"` 预留空间，避免内容出现时画布高度跳动。

## 扩展新场景

在 `components/motion-stage/scenes/` 新建客户端组件，通过 `useStage()` 读取
`step`、`direction`、`speed`、`epoch` 等状态，动画参数复用 `motion-presets.ts`
（`stageSpring`、`stageFade`、`TRAVEL_SECONDS`），颜色使用 `data-tone` 与 `--tone-*` 变量。
然后从 `components/motion-stage/index.ts` 导出，并在 `components/mdx.tsx` 注册即可在 MDX 中使用。

```tsx
'use client';
import { motion } from 'motion/react';
import { useStage, stageSpring } from '@/components/motion-stage';

export function Pendulum({ angles }: { angles: number[] }) {
  const { step } = useStage();
  return <motion.div animate={{ rotate: angles[step] ?? 0 }} transition={stageSpring} />;
}
```
