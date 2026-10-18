import { writeFile } from 'node:fs/promises';
import { shadcnComponentDefinitions as definitions } from '@json-render/shadcn/catalog';

// Demo authoring helper only. Runtime component schemas and implementations
// remain the upstream exports; nulls below follow their nullable prop contract.
function example(state = {}) {
  const elements = {};
  const add = (id, type, props = {}, children = [], extra = {}) => {
    const defaults = Object.fromEntries(Object.entries(definitions[type].props.shape)
      .filter(([, schema]) => schema.safeParse(null).success).map(([key]) => [key, null]));
    elements[id] = { type, props: { ...defaults, ...props }, children, ...extra };
  };
  const stack = (id, children, props = {}) => add(id, 'Stack', { direction: 'vertical', align: 'stretch', gap: 'lg', ...props }, children);
  return { add, stack, finish: () => ({ root: 'root', elements, state }) };
}
const bind = (key) => ({ $bindState: `/${key}` });
const when = (key, eq) => ({ $state: `/${key}`, eq });
const set = (key, value) => ({ action: 'setState', params: { statePath: `/${key}`, value } });
const specs = [];

{
  const { add, stack, finish } = example({ answer: '', submitted: false, explanation: false });
  stack('root', ['context', 'question', 'actions', 'correct', 'wrong', 'explanation']);
  add('context', 'Text', { text: '直接映射 Cache：每块 16 B，共 8 行。比较字节地址 52 和 180。', variant: 'body' });
  add('question', 'Radio', {
    label: '这两个地址的内存块会映射到哪里？', name: 'cache-quiz-answer',
    options: ['同一行，属于冲突块', '不同行，互不影响'], value: bind('answer'),
  }, [], { on: { change: set('submitted', false) } });
  stack('actions', ['submit', 'open-explanation'], { direction: 'horizontal', align: 'center', gap: 'sm' });
  add('submit', 'Button', { label: '检查答案', variant: 'primary', disabled: { $cond: when('answer', ''), $then: true, $else: false } }, [], { on: { press: set('submitted', true) } });
  add('open-explanation', 'Button', { label: '查看推导', variant: 'secondary' }, [], { on: { press: set('explanation', true) } });
  add('correct', 'Alert', { title: '判断正确：都映射到第 3 行', message: '52 的块号是 3，180 的块号是 11；3 mod 8 与 11 mod 8 都等于 3。它们的标记不同，所以会发生冲突。', type: 'success' }, [], { visible: [when('submitted', true), when('answer', '同一行，属于冲突块')] });
  add('wrong', 'Alert', { title: '再检查一次“行号”的计算', message: '先用地址除以块大小取整，得到内存块号；再对 Cache 行数取模。不能直接拿地址对行数取模来判断块的映射。', type: 'warning' }, [], { visible: [when('submitted', true), when('answer', '不同行，互不影响')] });
  add('explanation', 'Dialog', { title: '从地址推到 Cache 行号', description: '字节地址 → 内存块号 → Cache 行号', openPath: '/explanation' }, ['formula', 'calculation', 'conclusion']);
  add('formula', 'Text', { text: '内存块号 = ⌊地址 / 16⌋\n行号 = 内存块号 mod 8', variant: 'code' });
  add('calculation', 'Text', { text: '地址 52：块号 3，行号 3，块内偏移 4 B。\n地址 180：块号 11，行号 3，块内偏移 4 B。' });
  add('conclusion', 'Text', { text: '结论：偏移相同、行号相同，但不是同一个内存块。' });
  specs.push(finish());
}
{
  const { add, stack, finish } = example({ phase: 'connect' });
  stack('root', ['tabs', 'questions']);
  add('tabs', 'Tabs', { tabs: [{ label: '三次握手', value: 'connect' }, { label: '四次挥手', value: 'close' }], defaultValue: 'connect', value: bind('phase') }, ['connect', 'close']);
  stack('connect', ['connect-table', 'connect-note']);
  add('connect-table', 'Table', {
    columns: ['步', '方向', '报文'],
    rows: [
      ['1', '客户端\n→ 服务端', 'SYN\nseq = 100'],
      ['2', '服务端\n→ 客户端', 'SYN + ACK\nseq = 300\nack = 101'],
      ['3', '客户端\n→ 服务端', 'ACK\nseq = 101\nack = 301'],
    ], caption: '示例中没有数据负载。SYN 占用一个序号，纯 ACK 不占用序号。',
  });
  add('connect-note', 'Text', { text: '第三次握手到达后，服务端也进入 ESTABLISHED，连接建立完成。', variant: 'muted' });
  stack('close', ['close-table', 'close-note']);
  add('close-table', 'Table', {
    columns: ['步', '方向', '报文'],
    rows: [
      ['1', '主动关闭方\n→ 对端', 'FIN + ACK\nseq = 200\nack = 700'],
      ['2', '对端\n→ 主动关闭方', 'ACK\nseq = 700\nack = 201'],
      ['3', '对端\n→ 主动关闭方', 'FIN + ACK\nseq = 700\nack = 201'],
      ['4', '主动关闭方\n→ 对端', 'ACK\nseq = 201\nack = 701'],
    ], caption: '假设关闭期间双方都不再发送数据。这是 ACK 与 FIN 分开发送的常见四报文过程。',
  });
  add('close-note', 'Text', { text: '主动关闭方发送最后一个 ACK 后进入 TIME-WAIT；收到对方重传的 FIN 时，需要再次确认。', variant: 'muted' });
  add('questions', 'Accordion', { items: [
    { title: '第三次握手确认了什么？', content: '服务端确认客户端收到了自己的 SYN 和初始序号。双方因此知道连接建立所需的初始序号与确认关系。' },
    { title: '为什么要等待 2MSL？', content: '允许重发最后的 ACK，并让旧连接的报文段在网络中消失。若最后的 ACK 丢失，对端仍可能重传 FIN。' },
  ], type: 'single' });
  const result = finish();
  result.elements.connect.visible = when('phase', 'connect');
  result.elements.close.visible = when('phase', 'close');
  specs.push(result);
}
{
  const keys = ['concept', 'practice', 'review'];
  function tally(render, index = 0, completed = 0) {
    if (index === keys.length) return render(completed);
    return { $cond: when(keys[index], true), $then: tally(render, index + 1, completed + 1), $else: tally(render, index + 1, completed) };
  }
  const { add, stack, finish } = example({ topic: '计算机网络', goal: '', minutes: 30, concept: false, practice: false, review: false });
  stack('root', ['fields', 'duration', 'separator', 'tasks', 'progress', 'completion']);
  add('fields', 'Grid', { columns: 2, gap: 'lg', className: 'grid-cols-1 sm:grid-cols-2' }, ['topic', 'goal']);
  add('topic', 'Select', { label: '复习科目', name: 'review-topic', options: ['计算机网络', '计算机组成原理', '操作系统', '数据结构'], placeholder: '选择科目', value: bind('topic') });
  add('goal', 'Input', { label: '这次想解决的问题', name: 'review-goal', placeholder: '例如：解释 TIME-WAIT…', value: bind('goal') });
  add('duration', 'Slider', { label: '专注目标（分钟）', min: 15, max: 90, step: 5, value: bind('minutes') });
  add('separator', 'Separator', { orientation: 'horizontal' });
  stack('tasks', ['concept', 'practice', 'review'], { gap: 'md' });
  add('concept', 'Checkbox', { label: '合上资料，复述一次概念', name: 'review-concept', checked: bind('concept') });
  add('practice', 'Checkbox', { label: '独立完成一道相关练习', name: 'review-practice', checked: bind('practice') });
  add('review', 'Checkbox', { label: '回看错误，写下一个易错点', name: 'review-summary', checked: bind('review') });
  add('progress', 'Progress', { value: tally((n) => Math.round(n / 3 * 100)), max: 100, label: '本次复习进度' });
  add('completion', 'Text', { text: tally((n) => n === 3 ? '3 / 3 已完成，可以结束这一轮复习了。' : `${n} / 3 已完成，按自己的节奏继续。`), variant: 'muted' });
  specs.push(finish());
}
{
  const { add, stack, finish } = example({ mode: '精读', priority: '常规', marked: false, reminder: true, note: '', next: '今天', page: 1, drawer: false, loading: false });
  stack('root', ['badge', 'tools', 'separator', 'reading', 'loading-demo']);
  add('badge', 'Badge', { text: '其他官方组件', variant: 'secondary' });
  add('tools', 'Grid', { columns: 2, gap: 'lg', className: 'grid-cols-1 sm:grid-cols-2' }, ['controls', 'resources']);
  add('controls', 'Card', { title: '阅读工具', description: '尝试不同的选择与记录方式。' }, ['modes', 'priorities', 'mark', 'reminder', 'note', 'schedule', 'schedule-text']);
  add('modes', 'ToggleGroup', { items: [{ label: '精读', value: '精读' }, { label: '做题', value: '做题' }, { label: '回顾', value: '回顾' }], type: 'single', value: bind('mode') });
  add('priorities', 'ButtonGroup', { buttons: [{ label: '常规', value: '常规' }, { label: '加练', value: '加练' }], selected: bind('priority') });
  add('mark', 'Toggle', { label: '标记为重点', variant: 'outline', pressed: bind('marked') });
  add('reminder', 'Switch', { label: '复习后提醒我回顾', name: 'gallery-reminder', checked: bind('reminder') });
  add('note', 'Textarea', { label: '记下易错点', name: 'gallery-note', rows: 3, placeholder: '例如：FIN 也占用一个序号…', value: bind('note') });
  add('schedule', 'DropdownMenu', { label: '安排下一次复习', items: [{ label: '今天', value: '今天' }, { label: '明天', value: '明天' }, { label: '本周', value: '本周' }], value: bind('next') });
  add('schedule-text', 'Text', { text: { $template: '当前：${/mode} · ${/priority}；下次复习：${/next}。' }, variant: 'caption' });
  add('resources', 'Card', { title: '补充资料', description: '需要时再打开，不打断正文。' }, ['avatar-row', 'tooltip', 'popover', 'drawer-open', 'drawer', 'collapsible']);
  stack('avatar-row', ['avatar', 'author'], { direction: 'horizontal', align: 'center', gap: 'sm' });
  add('avatar', 'Avatar', { name: '学习者', size: 'sm' });
  add('author', 'Text', { text: '把解释写给未来的自己。', variant: 'muted' });
  add('tooltip', 'Tooltip', { text: 'MSL 是什么？', content: 'Maximum Segment Lifetime，即报文段最大生存时间。' });
  add('popover', 'Popover', { trigger: '查看复习方法', content: '先回忆、再验证；先解释原因，再记忆结论。' });
  add('drawer-open', 'Button', { label: '打开学习提示', variant: 'secondary' }, [], { on: { press: set('drawer', true) } });
  add('drawer', 'Drawer', { title: '给下一次复习的提示', description: '只留下最需要提醒自己的内容。', openPath: '/drawer' }, ['drawer-note']);
  add('drawer-note', 'Text', { text: { $cond: when('note', ''), $then: '试着先在“记下易错点”里写一句话，再打开这里。', $else: { $state: '/note' } } });
  add('collapsible', 'Collapsible', { title: '展开写作参考', defaultOpen: false }, ['reference']);
  add('reference', 'Link', { label: '官方组件与属性说明', href: 'https://json-render.dev/docs/api/shadcn' });
  add('separator', 'Separator', { orientation: 'horizontal' });
  stack('reading', ['heading', 'image', 'carousel', 'pagination']);
  add('heading', 'Heading', { text: '换一种方式复习', level: 'h3' });
  add('image', 'Image', { src: '/smart-ui/study-notes.svg', alt: '笔记本与复习卡片的黑白线稿', width: 640, height: 180 });
  add('carousel', 'Carousel', { items: [{ title: '主动回忆', description: '不看资料，先解释一次。' }, { title: '间隔复习', description: '过一段时间，再检索记忆。' }, { title: '交错练习', description: '比较相近概念的关键差别。' }, { title: '错误归因', description: '找出推理中断的那一步。' }] });
  add('pagination', 'Pagination', { totalPages: 3, page: bind('page') });
  add('loading-demo', 'Collapsible', { title: '预览加载状态样式', defaultOpen: false }, ['loading-open', 'loading', 'loading-close']);
  add('loading-open', 'Button', { label: '显示加载状态', variant: 'secondary' }, [], { on: { press: set('loading', true) }, visible: when('loading', false) });
  stack('loading', ['skeleton', 'spinner']);
  add('skeleton', 'Skeleton', { width: '100%', height: '24px', rounded: false });
  add('spinner', 'Spinner', { size: 'sm', label: '加载状态外观预览' });
  add('loading-close', 'Button', { label: '结束预览', variant: 'secondary' }, [], { on: { press: set('loading', false) }, visible: when('loading', true) });
  const result = finish(); result.elements.loading.visible = when('loading', true);
  specs.push(result);
}
const fence = (spec) => '```json-render\n' + JSON.stringify(spec, null, 2) + '\n```\n';
const markdown = `---
title: 交互式学习示例
description: 用一道题、一组 TCP 报文和一次复习计划，体验官方 UI 组件。
---

先判断一道题，再对照 TCP 的报文顺序，最后安排一次复习。每个练习都可单独重置；切换到 JSON 可以查看它的写法。

## 判断 Cache 映射

两个地址相差 128 B，为什么仍可能争用同一条 Cache 行？先做判断，再查看推导。

${fence(specs[0])}
<details>
<summary>纸面答案与推导</summary>

同一行。块号分别是 ⌊52 / 16⌋ = 3 和 ⌊180 / 16⌋ = 11；对 8 取模都得到 3。它们属于不同的内存块，因此会发生映射冲突。

</details>

## 对照 TCP 报文

切换握手与挥手，逐条比较发送方向、序号和确认号。表格里的换行用于把每个字段分开，手机上也能直接读全。

${fence(specs[1])}
## 完成一轮复习

给自己一个具体问题，按“回忆 → 练习 → 纠错”完成三个小任务。进度条统计的是已完成任务，专注时长单独设置。

${fence(specs[2])}
计划和笔记只保存在当前页面里，刷新后会恢复初始状态。

## 更多组件

正文优先展示学习内容。其他官方组件可以按需展开，单独尝试。

<details>
<summary>展开组件体验区</summary>

${fence(specs[3])}
</details>

## 组件可以自定义吗？

可以。颜色、圆角、间距与手机布局由站点统一调整；组件已有的 variant 可直接在 JSON 里选择。也可以在 React 注册表里替换某个组件的实现，或新增函数图、时序图等学习组件。

JSON 只能使用已经注册的组件和属性。新增组件时，要同步定义属性、实现组件并更新校验与写作说明。当前这页仍使用官方组件，没有新增绘图组件。

[下载文档写作约定](/smart-ui/authoring-prompt.md) · [查看官方组件目录](https://json-render.dev/docs/api/shadcn)
`;
await writeFile(new URL('../content/docs/408/knowledge/smart-ui-demo.mdx', import.meta.url), markdown);
const used = new Set(specs.flatMap((spec) => Object.values(spec.elements).map((element) => element.type)));
if (used.size !== 36) throw new Error(`Expected all 36 components across the main and optional examples, got ${used.size}.`);
console.log(`Wrote ${specs.length} examples covering ${used.size} official components.`);
