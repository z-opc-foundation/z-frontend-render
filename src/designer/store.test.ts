import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDesigner, useDesignerStore } from './store';
import type { DesignerPlugin } from './plugins';

describe('designer2 store 内核', () => {
  beforeEach(() => resetDesigner());

  it('初始 schema 有 root 容器节点', () => {
    const s = useDesignerStore.getState();
    expect(s.schema.layout?.root).toBe('root');
    expect(s.schema.elements?.root?.type).toBe('container');
  });

  it('insertNode 同时维护 elements 与 layout.children', () => {
    const id = useDesignerStore.getState().insertNode('input', 'root');
    expect(id).toBeTruthy();
    const s = useDesignerStore.getState();
    expect(s.schema.elements?.[id!]?.type).toBe('input');
    expect(s.schema.layout?.structure?.root?.children).toContain(id);
    expect(s.selectedId).toBe(id);
  });

  it('容器默认属性由插件注入', () => {
    const id = useDesignerStore.getState().insertNode('formContainer', 'root');
    const node = useDesignerStore.getState().schema.elements?.[id!];
    expect(node?.props?.padding).toBe(16);
  });

  it('具名插槽挂载', () => {
    const wrapper = useDesignerStore.getState().insertNode('container', 'root');
    const slotId = useDesignerStore.getState().insertNode('button', wrapper!, 'header');
    const st = useDesignerStore.getState().schema.layout?.structure?.[wrapper!];
    expect(st?.namedSlots?.header).toContain(slotId);
    expect(st?.children).not.toContain(slotId);
  });

  it('removeNode 递归清理整棵子树', () => {
    const outer = useDesignerStore.getState().insertNode('container', 'root')!;
    const inner = useDesignerStore.getState().insertNode('container', outer)!;
    const leaf = useDesignerStore.getState().insertNode('input', inner)!;
    useDesignerStore.getState().removeNode(outer);
    const s = useDesignerStore.getState();
    expect(s.schema.elements?.[outer]).toBeUndefined();
    expect(s.schema.elements?.[inner]).toBeUndefined();
    expect(s.schema.elements?.[leaf]).toBeUndefined();
    expect(s.schema.layout?.structure?.root?.children).not.toContain(outer);
  });

  it('根节点不可删', () => {
    useDesignerStore.getState().removeNode('root');
    expect(useDesignerStore.getState().schema.elements?.root).toBeDefined();
  });

  it('updateProps 合并不覆盖其它字段', () => {
    const id = useDesignerStore.getState().insertNode('input', 'root')!;
    useDesignerStore.getState().updateProps(id, { label: '姓名' });
    useDesignerStore.getState().updateProps(id, { placeholder: '请输入' });
    const props = useDesignerStore.getState().schema.elements?.[id]?.props;
    expect(props?.label).toBe('姓名');
    expect(props?.placeholder).toBe('请输入');
  });

  it('moveNode 拒绝拖入自身子树', () => {
    const outer = useDesignerStore.getState().insertNode('container', 'root')!;
    const inner = useDesignerStore.getState().insertNode('container', outer)!;
    useDesignerStore.getState().moveNode(outer, inner);
    const st = useDesignerStore.getState().schema.layout?.structure;
    expect(st?.[inner]?.children ?? []).not.toContain(outer);
  });

  it('undo/redo 往返', () => {
    const id = useDesignerStore.getState().insertNode('input', 'root')!;
    expect(useDesignerStore.getState().schema.elements?.[id]).toBeDefined();
    useDesignerStore.getState().undo();
    expect(useDesignerStore.getState().schema.elements?.[id]).toBeUndefined();
    useDesignerStore.getState().redo();
    expect(useDesignerStore.getState().schema.elements?.[id]).toBeDefined();
  });

  it('beforeInsert 返回 false 阻止插入', () => {
    const blocker: DesignerPlugin = {
      name: 'blocker',
      editorHooks: { beforeInsert: () => false },
    };
    useDesignerStore.getState().plugins.use(blocker);
    const before = Object.keys(useDesignerStore.getState().schema.elements ?? {}).length;
    const id = useDesignerStore.getState().insertNode('input', 'root');
    expect(id).toBeNull();
    expect(Object.keys(useDesignerStore.getState().schema.elements ?? {}).length).toBe(before);
  });

  it('afterPropChange 钩子可改写属性', () => {
    const upper: DesignerPlugin = {
      name: 'upper',
      editorHooks: {
        afterPropChange: (_id, props) => ({ ...props, label: String(props.label ?? '').toUpperCase() }),
      },
    };
    useDesignerStore.getState().plugins.use(upper);
    const id = useDesignerStore.getState().insertNode('input', 'root')!;
    useDesignerStore.getState().updateProps(id, { label: 'abc' });
    expect(useDesignerStore.getState().schema.elements?.[id]?.props?.label).toBe('ABC');
  });

  it('afterInsert 钩子被调用', () => {
    const spy = vi.fn();
    useDesignerStore.getState().plugins.use({
      name: 'spy',
      editorHooks: { afterInsert: spy },
    });
    useDesignerStore.getState().insertNode('button', 'root');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('insertAt 按下标插入，而不是总追加到末尾', () => {
    const a = useDesignerStore.getState().insertNode('input', 'root')!;
    const c = useDesignerStore.getState().insertNode('input', 'root')!;
    const b = useDesignerStore.getState().insertAt('button', 'root', 1)!;
    expect(useDesignerStore.getState().schema.layout?.structure?.root?.children).toEqual([a, b, c]);
  });

  it('moveTo 同容器前移：下标自动右移修正', () => {
    const a = useDesignerStore.getState().insertNode('input', 'root')!;
    const b = useDesignerStore.getState().insertNode('input', 'root')!;
    const c = useDesignerStore.getState().insertNode('input', 'root')!;
    // 把 a 插到 c 之后（目标下标 3 → 摘除 a 后应为 2）
    useDesignerStore.getState().moveTo(a, 'root', 3);
    expect(useDesignerStore.getState().schema.layout?.structure?.root?.children).toEqual([b, c, a]);
  });

  it('moveTo 跨容器移动并保持单选位置', () => {
    const box = useDesignerStore.getState().insertNode('container', 'root')!;
    const a = useDesignerStore.getState().insertNode('input', 'root')!;
    useDesignerStore.getState().moveTo(a, box, 0);
    const st = useDesignerStore.getState().schema.layout?.structure;
    expect(st?.root?.children).not.toContain(a);
    expect(st?.[box]?.children).toEqual([a]);
    expect(useDesignerStore.getState().selectedId).toBe(a);
  });

  it('moveTo 到原位置不产生历史记录', () => {
    const a = useDesignerStore.getState().insertNode('input', 'root')!;
    useDesignerStore.getState().insertNode('input', 'root');
    const depth = useDesignerStore.getState().past.length;
    useDesignerStore.getState().moveTo(a, 'root', 0);
    expect(useDesignerStore.getState().past.length).toBe(depth);
  });

  it('duplicate 复制整棵子树并插在原节点之后', () => {
    const box = useDesignerStore.getState().insertNode('card', 'root')!;
    const leaf = useDesignerStore.getState().insertNode('input', box)!;
    const copy = useDesignerStore.getState().duplicate(box)!;
    const s = useDesignerStore.getState();
    expect(copy).not.toBe(box);
    expect(s.schema.layout?.structure?.root?.children).toEqual([box, copy]);
    const copiedLeaf = s.schema.layout?.structure?.[copy]?.children ?? [];
    expect(copiedLeaf).toHaveLength(1);
    expect(copiedLeaf[0]).not.toBe(leaf);
    expect(s.schema.elements?.[copiedLeaf[0]!]?.type).toBe('input');
  });

  it('copy/paste 粘贴到指定容器末尾', () => {
    const box = useDesignerStore.getState().insertNode('container', 'root')!;
    const btn = useDesignerStore.getState().insertNode('button', box)!;
    expect(useDesignerStore.getState().copyNode(btn)).toBe(true);
    const pasted = useDesignerStore.getState().paste(box)!;
    expect(pasted).not.toBe(btn);
    expect(useDesignerStore.getState().schema.layout?.structure?.[box]?.children).toEqual([btn, pasted]);
  });

  it('insertNode 使用物料默认属性，避免空白组件', () => {
    const id = useDesignerStore.getState().insertNode('button', 'root')!;
    expect(useDesignerStore.getState().schema.elements?.[id]?.props?.text).toBe('提交');
  });

  it('updateLogic 写入事件绑定且可撤销', () => {
    const id = useDesignerStore.getState().insertNode('button', 'root')!;
    useDesignerStore.getState().updateLogic((logic) => {
      logic.flowBinds![`${id}.onClick`] = ['flow_1'];
      logic.flows!.flow_1 = { id: 'flow_1', headAddress: 'n1', flowNodeMap: { n1: { execute: { logicType: 'start' }, next: [] } } };
    });
    expect(useDesignerStore.getState().schema.logic?.flowBinds?.[`${id}.onClick`]).toEqual(['flow_1']);
    useDesignerStore.getState().undo();
    expect(useDesignerStore.getState().schema.logic?.flowBinds?.[`${id}.onClick`]).toBeUndefined();
  });

  it('updateContext 声明变量', () => {
    useDesignerStore.getState().updateContext((ctx) => {
      ctx.variableList = [{ name: 'orderNo', description: '订单号' }];
    });
    expect(useDesignerStore.getState().schema.context?.variableList?.[0]?.name).toBe('orderNo');
  });
});
