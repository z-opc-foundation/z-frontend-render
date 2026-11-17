import { create } from 'zustand';
import type { NodeStructure, PageSchema, SchemaNode } from '../tree';
import { PluginHost, containerDefaultsPlugin } from './plugins';
import { collectSubtreeIds } from './kernel/dropResolver';
import { DEFAULT_PROPS_RESOLVER } from './materials';

/**
 * 设计器状态内核：维护统一 PageSchema（elements 扁平表 + layout 树）+ 选中态 + undo/redo。
 *
 * 关键约定：
 * - 所有 schema 变更都产生新对象（不可变），历史栈存快照引用；
 * - 插入/删除/属性变更都经 PluginHost 钩子，业务逻辑（如容器默认属性）不硬编码在 store；
 * - elements 与 layout.structure 同步维护，删除节点递归清理整棵子树；
 * - 位置语义统一为 (parentId, slot, index)，拖拽/大纲树/粘贴共用同一套动作，
 *   同父移动时做下标修正（先摘除再插入，目标下标需回退一位）。
 */

export type DesignerMode = 'design' | 'preview';
export type ViewportPreset = 'desktop' | 'tablet' | 'mobile';

export interface NodeLocation {
  parentId: string;
  slot?: string;
  index: number;
}

interface Clipboard {
  rootId: string;
  nodes: Record<string, SchemaNode>;
  structure: Record<string, NodeStructure>;
}

export interface DesignerState {
  schema: PageSchema;
  selectedId: string | null;
  hoveredId: string | null;
  past: PageSchema[];
  future: PageSchema[];
  plugins: PluginHost;
  clipboard: Clipboard | null;
  mode: DesignerMode;
  viewport: ViewportPreset;
  zoom: number;

  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  setMode: (mode: DesignerMode) => void;
  setViewport: (viewport: ViewportPreset) => void;
  setZoom: (zoom: number) => void;

  /** 按位置插入新节点（parentId/slot/index） */
  insertAt: (
    type: string,
    parentId: string,
    index: number,
    slot?: string,
    props?: Record<string, unknown>,
  ) => string | null;
  /** 追加到父节点末尾（兼容旧调用） */
  insertNode: (type: string, parentId?: string, slot?: string, props?: Record<string, unknown>) => string | null;
  removeNode: (id: string) => void;
  updateProps: (id: string, patch: Record<string, unknown>) => void;
  /** 移动到指定位置 */
  moveTo: (id: string, parentId: string, index: number, slot?: string) => void;
  /** 追加到父节点末尾（兼容旧调用） */
  moveNode: (id: string, parentId: string, slot?: string) => void;
  appendToSlot: (parentId: string, slot: string, id: string) => void;

  copyNode: (id: string) => boolean;
  paste: (targetParentId?: string, slot?: string) => string | null;
  duplicate: (id: string) => string | null;
  selectParent: () => void;

  setSchema: (schema: PageSchema) => void;
  updatePageMeta: (patch: { id?: string; title?: string; description?: string }) => void;
  /** 逻辑域统一写入口：拷贝后交给调用方按需改写，保证不可变与历史栈一致 */
  updateLogic: (mutate: (logic: NonNullable<PageSchema['logic']>) => void) => void;
  /** 上下文（变量/事件/方法声明）统一写入口 */
  updateContext: (mutate: (context: NonNullable<PageSchema['context']>) => void) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

let idSeq = 0;
function genId(type: string): string {
  idSeq += 1;
  return `${type}-${Date.now().toString(36)}-${idSeq}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function emptySchema(pageId = 'page'): PageSchema {
  return {
    version: '1.0',
    id: pageId,
    meta: { title: '未命名页面' },
    elements: { root: { type: 'container', props: { direction: 'column', gap: 12, padding: 16, bordered: false } } },
    layout: { root: 'root', structure: { root: { children: [] } } },
    context: { variableList: [], eventList: [], contextMethods: [] },
    logic: { flowBinds: {}, flows: {} },
  };
}

/** 查找某个节点在树里的位置 */
export function locateNode(schema: PageSchema, id: string): NodeLocation | null {
  const structure = schema.layout?.structure ?? {};
  for (const [parentId, st] of Object.entries(structure)) {
    const idx = (st.children ?? []).indexOf(id);
    if (idx >= 0) return { parentId, index: idx };
    for (const [slot, ids] of Object.entries(st.namedSlots ?? {})) {
      const si = ids.indexOf(id);
      if (si >= 0) return { parentId, slot, index: si };
    }
  }
  return null;
}

function listOf(schema: PageSchema, parentId: string, slot?: string): string[] {
  const st = schema.layout?.structure?.[parentId];
  if (!st) return [];
  if (slot) return st.namedSlots?.[slot] ?? [];
  return st.children ?? [];
}

function unlink(schema: PageSchema, id: string): void {
  const structure = schema.layout?.structure;
  if (!structure) return;
  Object.values(structure).forEach((st) => {
    if (st.children) st.children = st.children.filter((c) => c !== id);
    if (st.namedSlots) {
      Object.entries(st.namedSlots).forEach(([slot, ids]) => {
        st.namedSlots![slot] = ids.filter((c) => c !== id);
      });
    }
  });
}

function link(schema: PageSchema, id: string, parentId: string, index: number, slot?: string): void {
  const structure = (schema.layout!.structure = schema.layout!.structure ?? {});
  if (!structure[parentId]) structure[parentId] = { children: [] };
  const parent = structure[parentId]!;
  if (slot) {
    parent.namedSlots = parent.namedSlots ?? {};
    const list = parent.namedSlots[slot] ?? [];
    list.splice(Math.max(0, Math.min(index, list.length)), 0, id);
    parent.namedSlots[slot] = list;
  } else {
    const list = parent.children ?? [];
    list.splice(Math.max(0, Math.min(index, list.length)), 0, id);
    parent.children = list;
  }
}

const HISTORY_LIMIT = 100;

function commit(state: DesignerState, next: PageSchema, selectedId?: string | null): Partial<DesignerState> {
  return {
    schema: next,
    past: [...state.past, state.schema].slice(-HISTORY_LIMIT),
    future: [],
    ...(selectedId !== undefined ? { selectedId } : {}),
  };
}

function extractSubtree(schema: PageSchema, rootId: string): Clipboard {
  const ids = collectSubtreeIds(rootId, schema.layout?.structure);
  const nodes: Record<string, SchemaNode> = {};
  const structure: Record<string, NodeStructure> = {};
  ids.forEach((id) => {
    const node = schema.elements?.[id];
    if (node) nodes[id] = clone(node);
    const st = schema.layout?.structure?.[id];
    if (st) structure[id] = clone(st);
  });
  return { rootId, nodes, structure };
}

/** 把剪贴板子树按新 id 粘回 schema，返回新根 id */
function graft(schema: PageSchema, clip: Clipboard): { rootId: string; idMap: Map<string, string> } {
  const idMap = new Map<string, string>();
  Object.keys(clip.nodes).forEach((oldId) => idMap.set(oldId, genId(clip.nodes[oldId]?.type ?? 'node')));
  schema.elements = schema.elements ?? {};
  schema.layout = schema.layout ?? { root: 'root', structure: {} };
  schema.layout.structure = schema.layout.structure ?? {};

  idMap.forEach((newId, oldId) => {
    const node = clip.nodes[oldId];
    if (node) schema.elements![newId] = clone(node);
    const st = clip.structure[oldId];
    if (st) {
      // 子树内的引用全部能映射到新 id（extractSubtree 收集了整棵子树）；
      // 这里不能用「元素已存在」过滤 —— 父节点可能先于子节点写入，会误删正常子引用。
      const remap = (ids: string[]) => ids.map((c) => idMap.get(c) ?? c);
      schema.layout!.structure![newId] = {
        children: remap(st.children ?? []),
        ...(st.namedSlots
          ? { namedSlots: Object.fromEntries(Object.entries(st.namedSlots).map(([slot, ids]) => [slot, remap(ids)])) }
          : {}),
      };
    } else {
      schema.layout!.structure![newId] = { children: [] };
    }
  });

  return { rootId: idMap.get(clip.rootId) ?? clip.rootId, idMap };
}

export const useDesignerStore = create<DesignerState>((set, get) => ({
  schema: emptySchema(),
  selectedId: null,
  hoveredId: null,
  past: [],
  future: [],
  plugins: new PluginHost().use(containerDefaultsPlugin()),
  clipboard: null,
  mode: 'design',
  viewport: 'desktop',
  zoom: 1,

  select: (id) => set({ selectedId: id }),
  hover: (id) => set({ hoveredId: id }),
  setMode: (mode) => set({ mode }),
  setViewport: (viewport) => set({ viewport }),
  setZoom: (zoom) => set({ zoom: Math.min(1.5, Math.max(0.5, Number(zoom.toFixed(2)))) }),

  insertAt: (type, parentId, index, slot, props) => {
    const state = get();
    const schema = clone(state.schema);
    const nodeId = genId(type);
    const defaults = DEFAULT_PROPS_RESOLVER(type);
    const draftNode: SchemaNode = { type, props: { ...defaults, ...(props ?? {}) } };
    const parent = schema.elements?.[parentId] ? parentId : (schema.layout?.root ?? 'root');

    const hookResult = state.plugins.beforeInsert({ nodeId, node: draftNode, parentId: parent, slot, schema });
    if (hookResult === false) return null;

    schema.elements = schema.elements ?? {};
    schema.layout = schema.layout ?? { root: 'root', structure: {} };
    schema.layout.structure = schema.layout.structure ?? {};
    schema.elements[nodeId] = hookResult.node;
    schema.layout.structure[nodeId] = { children: [] };
    link(schema, nodeId, parent, index, slot);

    set(commit(state, schema, nodeId));
    state.plugins.afterInsert({ nodeId, node: hookResult.node, parentId: parent, slot, schema });
    return nodeId;
  },

  insertNode: (type, parentId, slot, props) => {
    const state = get();
    const parent = parentId && state.schema.elements?.[parentId] ? parentId : (state.schema.layout?.root ?? 'root');
    const index = listOf(state.schema, parent, slot).length;
    return get().insertAt(type, parent, index, slot, props);
  },

  removeNode: (id) => {
    const state = get();
    if (id === state.schema.layout?.root) return; // 根节点不可删
    if (!state.plugins.beforeRemove(id, state.schema)) return;
    const schema = clone(state.schema);
    const doomed = collectSubtreeIds(id, schema.layout?.structure);
    doomed.forEach((nodeId) => {
      delete schema.elements?.[nodeId];
      delete schema.layout?.structure?.[nodeId];
    });
    unlink(schema, id);
    set(commit(state, schema, state.selectedId && doomed.has(state.selectedId) ? null : state.selectedId));
  },

  updateProps: (id, patch) => {
    const state = get();
    const schema = clone(state.schema);
    const node = schema.elements?.[id];
    if (!node) return;
    const merged = { ...(node.props ?? {}), ...patch };
    const processed = state.plugins.afterPropChange(id, merged, schema);
    schema.elements![id] = { ...node, props: processed };
    set(commit(state, schema));
  },

  moveTo: (id, parentId, index, slot) => {
    const state = get();
    if (id === parentId) return;
    const schema = clone(state.schema);
    if (id === schema.layout?.root) return; // 根节点不可移动
    // 防止把节点拖进自己的子树
    if (collectSubtreeIds(id, schema.layout?.structure).has(parentId)) return;
    if (!schema.elements?.[parentId]) return;

    const from = locateNode(schema, id);
    let target = index;
    if (from && from.parentId === parentId && (from.slot ?? null) === (slot ?? null) && from.index < index) {
      target = index - 1; // 同容器内前移后插：摘除后下标左移
    }
    if (from && from.parentId === parentId && (from.slot ?? null) === (slot ?? null) && from.index === target) {
      return; // 位置没变，不产生历史记录
    }
    unlink(schema, id);
    link(schema, id, parentId, target, slot);
    set(commit(state, schema, id));
  },

  moveNode: (id, parentId, slot) => {
    const state = get();
    get().moveTo(id, parentId, listOf(state.schema, parentId, slot).length, slot);
  },

  appendToSlot: (parentId, slot, id) => {
    const state = get();
    get().moveTo(id, parentId, listOf(state.schema, parentId, slot).length, slot);
  },

  copyNode: (id) => {
    const state = get();
    if (!state.schema.elements?.[id]) return false;
    set({ clipboard: extractSubtree(state.schema, id) });
    return true;
  },

  paste: (targetParentId, slot) => {
    const state = get();
    const clip = state.clipboard;
    if (!clip) return null;
    const schema = clone(state.schema);
    let parentId = targetParentId ?? state.schema.layout?.root ?? 'root';
    // 粘贴到原子节点时，落到它的父容器里
    const parentNode = schema.elements?.[parentId];
    if (!parentNode) return null;

    const { rootId } = graft(schema, clip);
    const index = listOf(schema, parentId, slot).length;
    link(schema, rootId, parentId, index, slot);
    set(commit(state, schema, rootId));
    return rootId;
  },

  duplicate: (id) => {
    const state = get();
    if (!state.schema.elements?.[id]) return null;
    const schema = clone(state.schema);
    const clip = extractSubtree(state.schema, id);
    const from = locateNode(state.schema, id);
    if (!from) return null;
    const { rootId } = graft(schema, clip);
    link(schema, rootId, from.parentId, from.index + 1, from.slot);
    set(commit(state, schema, rootId));
    return rootId;
  },

  selectParent: () => {
    const state = get();
    if (!state.selectedId) return;
    const loc = locateNode(state.schema, state.selectedId);
    if (loc) set({ selectedId: loc.parentId });
  },

  setSchema: (schema) => set((state) => commit(state, clone(schema), null)),

  updatePageMeta: (patch) => {
    const state = get();
    const schema = clone(state.schema);
    if (patch.id !== undefined) schema.id = patch.id;
    schema.meta = { ...(schema.meta ?? {}), ...(patch.title !== undefined ? { title: patch.title } : {}) };
    if (patch.description !== undefined) schema.meta = { ...(schema.meta ?? {}), description: patch.description };
    set(commit(state, schema));
  },

  updateLogic: (mutate) => {
    const state = get();
    const schema = clone(state.schema);
    schema.logic = schema.logic ?? { flowBinds: {}, flows: {} };
    schema.logic.flowBinds = schema.logic.flowBinds ?? {};
    schema.logic.flows = schema.logic.flows ?? {};
    mutate(schema.logic);
    set(commit(state, schema));
  },

  updateContext: (mutate) => {
    const state = get();
    const schema = clone(state.schema);
    schema.context = schema.context ?? { variableList: [], eventList: [], contextMethods: [] };
    mutate(schema.context);
    set(commit(state, schema));
  },

  undo: () =>
    set((state) => {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        schema: previous,
        past: state.past.slice(0, -1),
        future: [state.schema, ...state.future].slice(0, HISTORY_LIMIT),
        selectedId: null,
        hoveredId: null,
      };
    }),

  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return state;
      return {
        schema: next,
        past: [...state.past, state.schema].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        selectedId: null,
        hoveredId: null,
      };
    }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));

/** 供测试/重置用：造一个空设计器状态 */
export function resetDesigner(schema: PageSchema = emptySchema()): void {
  useDesignerStore.setState({
    schema,
    selectedId: null,
    hoveredId: null,
    past: [],
    future: [],
    plugins: new PluginHost().use(containerDefaultsPlugin()),
    clipboard: null,
    mode: 'design',
    viewport: 'desktop',
    zoom: 1,
  });
}
