import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { z } from 'zod';

const text = z.string().max(4000);
const label = z.string().min(1).max(200);
const powerOfTwo = z.number().int().min(1).max(256).refine((n) => (n & (n - 1)) === 0, '必须是 2 的幂');

/** Shared by generation instructions, server validation and the React registry. */
export const studyCatalog = defineCatalog(schema, {
  components: {
    Stack: {
      props: z.object({ direction: z.enum(['vertical', 'horizontal']).default('vertical') }).strict(),
      slots: ['default'],
      description: '排列子组件；horizontal 自动换行，适合按钮组。',
    },
    Card: {
      props: z.object({ title: label, description: text.optional() }).strict(),
      slots: ['default'],
      description: '一组学习内容，标题加可选说明。',
    },
    Text: {
      props: z.object({ text, tone: z.enum(['normal', 'muted', 'success', 'warning']).default('normal') }).strict(),
      description: '纯文本说明或反馈；不支持 HTML。text 可以用 $state 读取字符串。',
    },
    Choice: {
      props: z.object({ label, options: z.array(z.object({ label, value: label }).strict()).min(2).max(10), value: text }).strict(),
      description: '单选题。value 使用 {"$bindState":"/answer"} 双向绑定字符串状态。',
    },
    Slider: {
      props: z.object({ label, min: z.number().int().min(0), max: z.number().int().max(65535), step: z.number().int().positive().default(1), value: z.number().int() }).strict(),
      description: '整数滑块。value 使用 $bindState；0 ≤ min < max ≤ 65535，初始值位于范围内，step 为正整数。',
    },
    Toggle: {
      props: z.object({ label, checked: z.boolean() }).strict(),
      description: '复习任务复选框。checked 使用 $bindState 绑定布尔状态。',
    },
    Button: {
      props: z.object({ label, variant: z.enum(['primary', 'secondary']).default('primary') }).strict(),
      description: '按钮；使用元素级 on.press 调用 setState，只修改本代码块的状态。',
    },
    Progress: {
      props: z.object({ label, values: z.array(z.boolean()).min(1).max(30) }).strict(),
      description: '复习完成度。values 的每个值可使用 $state 引用任务布尔状态。',
    },
    MemoryAddress: {
      props: z.object({ address: z.number().int().min(0).max(65535), blockBytes: powerOfTwo, lines: powerOfTwo }).strict(),
      description: '16 位字节地址的直接映射 Cache 地址分解。address 可使用 $state；blockBytes 和 lines 为 1–256 之间的 2 的幂。',
    },
  },
  actions: {},
});

export const studyGenerationRules = [
  '输出完整的中文 Markdown 文档：正文解释知识点，交互内容放进 ```json-render 代码块，代码块内只放完整 JSON 对象，不是 JSONL patches。不要输出 import、JSX 或 JavaScript。',
  '每个 JSON 对象只有 root、elements、state。elements 使用平铺 ID 映射，每个元素有 type、props、children；children 是子节点 ID 数组，叶子使用 []。只允许 Stack 和 Card 拥有子节点；形成无环树，所有元素恰好被访问一次，深度不超过 20，最多 100 个元素。',
  'state 仅允许平铺的字符串、有限数字或布尔值。路径只能是 /字段名，字段名以英文字母开头，只含字母、数字、下划线和连字符。必须在 state 声明所有使用的路径。每个代码块独立状态，刷新或“重置交互”会复原。',
  '仅支持这些 props 表达式：Text.text 的 $state；Choice.value、Slider.value、Toggle.checked 的 $state 或 $bindState；MemoryAddress.address 的 $state；Progress.values 数组项的 $state。其他 props 必须为字面量。',
  '仅 Button 支持 on.press，只允许 {"action":"setState","params":{"statePath":"/字段名","value":字面量}} 或上述对象数组。value 类型必须与初始状态一致。禁止其他动作、watch、repeat、slots、$computed、$template、$item、链接、网络请求和自定义代码。',
  'visible 只支持布尔值、{"$state":"/字段名"}、带一个 eq 或 neq 的条件，以及上述条件的 AND 数组。不要使用其他可见性语法。',
  '交互题用 Choice 双向绑定答案，Button 将 submitted 状态设为 true，使用 visible 同时检查 submitted 和答案来显示反馈。更换答案后反馈应随答案变化。每个交互块前后都要写普通文字，保留离线阅读时的题目、答案和解释。',
];
