import { resolveElementProps, VisibilityConditionSchema, type Spec } from '@json-render/core';
import { z } from 'zod';
import { studyCatalog } from './catalog';

const action = z.object({
  action: z.enum(['setState', 'pushState', 'removeState', 'validateForm']),
  params: z.record(z.string(), z.unknown()).default({}),
}).strict();
const element = z.object({
  type: z.string(),
  props: z.record(z.string(), z.unknown()),
  children: z.array(z.string()).max(100),
  visible: VisibilityConditionSchema.optional(),
  on: z.record(z.string(), z.union([action, z.array(action).min(1).max(30)])).optional(),
}).strict();
const documentSchema = z.object({
  root: z.string(),
  elements: z.record(z.string(), element),
  state: z.record(z.string(), z.unknown()).default({}),
}).strict();
const boundProps: Record<string, string[]> = {
  Input: ['value'], Textarea: ['value'], Select: ['value'], Radio: ['value'],
  Checkbox: ['checked'], Switch: ['checked'], Slider: ['value'], Tabs: ['value'],
  Toggle: ['pressed'], ToggleGroup: ['value'], ButtonGroup: ['selected'],
  DropdownMenu: ['value'], Pagination: ['page'],
};

/** Document transport limits; component contracts come unchanged from upstream. */
export function parseStudySpec(code: string): Spec {
  if (new TextEncoder().encode(code).length > 100_000) throw new Error('交互 JSON 不能超过 100 KB。');
  const raw: unknown = JSON.parse(code);
  rejectDangerousKeys(raw);
  const spec = documentSchema.parse(raw);
  const entries = Object.entries(spec.elements);
  if (!entries.length || entries.length > 100) throw new Error('需要 1–100 个元素。');

  function readPath(value: unknown, requireExisting = true): unknown {
    const pointer = z.string().regex(/^\/(?:[A-Za-z0-9_-]+)(?:\/[A-Za-z0-9_-]+)*$/).parse(value);
    let current: unknown = spec.state;
    for (const key of pointer.slice(1).split('/')) {
      if (!current || typeof current !== 'object' || !Object.hasOwn(current, key)) {
        if (requireExisting) throw new Error(`状态路径未声明：${pointer}`);
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  function inspect(value: unknown, type: string, prop: string, top = true): void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach((item) => inspect(item, type, prop, false)); return; }
    const object = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(object)) {
      if (key === '$state' || key === '$bindState') {
        readPath(child);
        if (key === '$bindState' && (!top || !boundProps[type]?.includes(prop))) throw new Error(`属性不支持双向绑定：${type}.${prop}`);
      } else if (key.startsWith('$') && !['$cond', '$then', '$else', '$template', '$and', '$or', '$not'].includes(key)) {
        throw new Error(`未注册的表达式：${key}`);
      }
      inspect(child, type, prop, false);
    }
  }

  for (const [id, node] of entries) {
    const definition = studyCatalog.data.components[node.type as keyof typeof studyCatalog.data.components];
    if (!definition) throw new Error(`未知组件：${node.type}`);
    const resolved = resolveElementProps(node.props, { stateModel: spec.state });
    const result = definition.props.strict().safeParse(resolved);
    if (!result.success) throw new Error(`${id} 属性无效：${result.error.message}`);
    Object.entries(node.props).forEach(([key, value]) => inspect(value, node.type, key));
    inspect(node.visible, node.type, 'visible');
    if (node.children.length && !('slots' in definition)) throw new Error(`${id} 不支持子节点。`);
    if (node.type === 'Link' && (typeof node.props.href !== 'string' || !isSafeUrl(resolved.href))) throw new Error('链接必须使用站内路径或 HTTPS 字面量。');
    if (['Image', 'Avatar'].includes(node.type) && node.props.src && (typeof node.props.src !== 'string' || !isSafeUrl(resolved.src))) throw new Error('图片必须使用站内路径或 HTTPS 字面量。');
    if (['Dialog', 'Drawer'].includes(node.type) && typeof readPath(resolved.openPath) !== 'boolean') throw new Error('openPath 必须指向布尔状态。');
    if (node.type === 'Slider') {
      const min = (resolved.min as number | null) ?? 0;
      const max = (resolved.max as number | null) ?? 100;
      const step = (resolved.step as number | null) ?? 1;
      const value = (resolved.value as number | null) ?? min;
      if (min >= max || step <= 0 || value < min || value > max) throw new Error(`${id} 滑块范围无效。`);
    }
    for (const [event, bindings] of Object.entries(node.on ?? {})) {
      if (!('events' in definition) || !(definition.events as readonly string[]).includes(event)) throw new Error(`${node.type} 未声明事件 ${event}。`);
      for (const binding of Array.isArray(bindings) ? bindings : [bindings]) {
        const { params } = binding;
        inspect(params, node.type, 'params');
        if (binding.action === 'validateForm') {
          if (params.statePath !== undefined) readPath(params.statePath, false);
          continue;
        }
        const current = readPath(params.statePath);
        if (binding.action === 'setState' && !Object.hasOwn(params, 'value')) throw new Error('setState 缺少 value。');
        if (binding.action !== 'setState' && !Array.isArray(current)) throw new Error('数组动作需要数组状态。');
        if (binding.action === 'removeState') z.number().int().nonnegative().parse(params.index);
        if (params.clearStatePath !== undefined) readPath(params.clearStatePath);
      }
    }
  }

  const visited = new Set<string>();
  function walk(id: string, depth: number) {
    if (depth > 20) throw new Error('交互树深度不能超过 20。');
    if (visited.has(id)) throw new Error(`循环引用或重复子节点：${id}`);
    if (!Object.hasOwn(spec.elements, id)) throw new Error(`找不到元素：${id}`);
    visited.add(id);
    spec.elements[id].children.forEach((child) => walk(child, depth + 1));
  }
  walk(spec.root, 1);
  if (visited.size !== entries.length) throw new Error('存在未连接到 root 的元素。');
  return spec;
}

function isSafeUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (/^\/(?!\/)/.test(value) && !/[\\\s]/.test(value)) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function rejectDangerousKeys(value: unknown, depth = 0): void {
  if (depth > 40) throw new Error('JSON 嵌套过深。');
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('JSON 包含不支持的键。');
    rejectDangerousKeys(child, depth + 1);
  }
}
