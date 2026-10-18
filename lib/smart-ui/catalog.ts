import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { shadcnComponentDefinitions } from '@json-render/shadcn/catalog';

/** Upstream schemas, names, props and events, without local component variants. */
export const studyCatalog = defineCatalog(schema, {
  components: shadcnComponentDefinitions,
  actions: {},
});

export const studyGenerationRules = [
  '输出中文 Markdown；交互块使用 ```json-render 围栏，里面放完整的 JSON spec（不是 JSONL patches），不输出 import、JSX 或 JavaScript。',
  '使用官方 @json-render/shadcn 的全部 36 个组件和原始属性。每个 spec 包含 root、elements、state；每个元素包含 type、props、children。可空属性使用 null，不能改用本项目旧版 Choice、MemoryAddress 或 Progress.values。',
  '使用官方 $state 读取状态、$bindState 双向绑定、$template 拼接文字、$cond/$then/$else 选择属性值，以及元素级 visible 条件。状态路径使用 JSON Pointer。每块状态独立，刷新或重置会恢复。',
  '交互使用官方内置 setState、pushState、removeState、validateForm 动作，放在元素级 on 中，并使用官方组件声明的事件；不调用网络或自定义动作。文档模式不使用 repeat、watch、$computed 或自定义脚本。',
  'Tabs 绑定 value 后，通过各子元素的 visible 条件选择内容；Dialog/Drawer 的 openPath 指向布尔状态，再用 Button 的 setState 打开。不要生成不存在的 TabsContent 组件。',
  '使用官方内置 variant；布局类只用于 Card/Stack/Grid 的 className，例如 grid-cols-1 sm:grid-cols-2。颜色、字体、圆角沿用站点主题，不写固定颜色。Input/Checkbox/Radio 等 name 在整篇文档内唯一。',
  '每块最多 100 个元素，深度不超过 20，JSON 不超过 100 KB。正文保留题目、答案和解释。图片和链接只使用站内路径或 HTTPS 地址。',
];
