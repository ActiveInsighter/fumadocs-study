import { resolveElementProps, type Spec } from '@json-render/core';
import { z } from 'zod';
import { studyCatalog } from './catalog';

const scalar = z.union([z.string().max(4000), z.number().finite(), z.boolean()]);
const stateName = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]*$/);
const pointer = z.string().regex(/^\/[A-Za-z][A-Za-z0-9_-]*$/);
const condition = z.object({ $state: pointer, eq: scalar.optional(), neq: scalar.optional() }).strict()
  .refine((v) => !(v.eq !== undefined && v.neq !== undefined), '只允许一个比较运算符');
const action = z.object({ action: z.literal('setState'), params: z.object({ statePath: pointer, value: scalar }).strict() }).strict();
const element = z.object({
  type: z.string(),
  props: z.record(z.string(), z.unknown()),
  children: z.array(z.string()).max(100).default([]),
  visible: z.union([z.boolean(), condition, z.array(condition).min(1).max(10)]).optional(),
  on: z.object({ press: z.union([action, z.array(action).min(1).max(30)]) }).strict().optional(),
}).strict();
const documentSchema = z.object({
  root: z.string(),
  elements: z.record(z.string(), element),
  state: z.record(stateName, scalar).default({}),
}).strict();

const readable: Record<string, string[]> = {
  Text: ['text'], Choice: ['value'], Slider: ['value'], Toggle: ['checked'],
  Progress: ['values'], MemoryAddress: ['address'],
};
const writable: Record<string, string[]> = { Choice: ['value'], Slider: ['value'], Toggle: ['checked'] };

/** Deliberately bounded document subset of json-render, validated before hydration. */
export function parseStudySpec(code: string): Spec {
  if (code.length > 100_000) throw new Error('交互 JSON 不能超过 100 KB。');
  const raw: unknown = JSON.parse(code);
  rejectDangerousKeys(raw);
  const spec = documentSchema.parse(raw);
  const entries = Object.entries(spec.elements);
  if (entries.length === 0 || entries.length > 100) throw new Error('需要 1–100 个元素。');

  function assertPath(path: string) {
    pointer.parse(path);
    if (!Object.hasOwn(spec.state, path.slice(1))) throw new Error(`状态路径未声明：${path}`);
  }

  function inspectProp(value: unknown, type: string, prop: string, nested = false): void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((item) => inspectProp(item, type, prop, true));
      return;
    }
    const object = value as Record<string, unknown>;
    const expressions = Object.keys(object).filter((key) => key.startsWith('$'));
    if (expressions.length) {
      const kind = expressions[0];
      const allowed = kind === '$state' ? readable : kind === '$bindState' ? writable : {};
      if (Object.keys(object).length !== 1 || !allowed[type]?.includes(prop) || (nested && type !== 'Progress')) {
        throw new Error(`不支持的属性表达式：${type}.${prop}`);
      }
      assertPath(z.string().parse(object[kind]));
    } else {
      Object.values(object).forEach((item) => inspectProp(item, type, prop, true));
    }
  }

  function validateProps(state: Record<string, unknown>) {
    for (const [id, node] of entries) {
      const definition = studyCatalog.data.components[node.type as keyof typeof studyCatalog.data.components];
      if (!definition) throw new Error(`未知组件：${node.type}`);
      const resolved = resolveElementProps(node.props, { stateModel: state });
      const result = definition.props.safeParse(resolved);
      if (!result.success) throw new Error(`${id} 属性无效：${result.error.message}`);
      if (node.type === 'Slider') {
        const { min, max, value } = resolved as { min: number; max: number; value: number };
        if (min >= max || value < min || value > max) throw new Error(`${id} 滑块范围或初始值无效。`);
      }
    }
  }

  for (const [id, node] of entries) {
    Object.entries(node.props).forEach(([key, value]) => inspectProp(value, node.type, key));
    if (node.children.length && node.type !== 'Stack' && node.type !== 'Card') throw new Error(`${id} 不支持子节点。`);
    if (node.visible && typeof node.visible !== 'boolean') {
      for (const rule of Array.isArray(node.visible) ? node.visible : [node.visible]) assertPath(rule.$state);
    }
    if (node.on) {
      if (node.type !== 'Button') throw new Error('只有 Button 支持 on.press。');
      for (const binding of Array.isArray(node.on.press) ? node.on.press : [node.on.press]) {
        assertPath(binding.params.statePath);
        if (typeof spec.state[binding.params.statePath.slice(1)] !== typeof binding.params.value) throw new Error('setState 不能改变状态类型。');
        validateProps({ ...spec.state, [binding.params.statePath.slice(1)]: binding.params.value });
      }
    }
  }
  validateProps(spec.state);

  // Also rejects shared subtrees: a bounded tree cannot grow exponentially.
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

function rejectDangerousKeys(value: unknown, depth = 0): void {
  if (depth > 40) throw new Error('JSON 嵌套过深。');
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('JSON 包含不支持的键。');
    rejectDangerousKeys(child, depth + 1);
  }
}
