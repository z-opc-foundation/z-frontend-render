import { describe, expect, it } from 'vitest';
import { resolveDrop, resolveCanvasFallback, collectSubtreeIds, type DropRect } from './dropResolver';

/**
 * 落点解算单测：这套逻辑决定了「拖到两个组件中间」和「拖进容器」的差别，
 * 是把拖拽从「只能追加到最外层」修好的核心，必须覆盖到边界。
 */

function rect(
  partial: Partial<DropRect> & { id: string; rect: DropRect['rect'] },
): DropRect {
  return {
    kind: 'node',
    parentId: 'root',
    index: 0,
    acceptsChildren: false,
    depth: 1,
    ...partial,
  };
}

/** 根容器 (0,0)-(800,600)，两个子节点上下排列 */
const root: DropRect = rect({
  id: 'root',
  parentId: null,
  index: -1,
  acceptsChildren: true,
  depth: 0,
  rect: { top: 0, left: 0, right: 800, bottom: 600, width: 800, height: 600 },
});

const childA: DropRect = rect({
  id: 'a',
  index: 0,
  rect: { top: 20, left: 20, right: 780, bottom: 80, width: 760, height: 60 },
});

const childB: DropRect = rect({
  id: 'b',
  index: 1,
  rect: { top: 100, left: 20, right: 780, bottom: 160, width: 760, height: 60 },
});

const nestedContainer: DropRect = rect({
  id: 'c',
  index: 2,
  acceptsChildren: true,
  rect: { top: 200, left: 20, right: 780, bottom: 400, width: 760, height: 200 },
});

const nestedLeaf: DropRect = rect({
  id: 'c1',
  parentId: 'c',
  index: 0,
  depth: 2,
  rect: { top: 220, left: 40, right: 760, bottom: 280, width: 720, height: 60 },
});

const rects = [root, childA, childB, nestedContainer, nestedLeaf];

describe('resolveDrop', () => {
  it('指针在原子节点上半部 → 插到它之前', () => {
    const t = resolveDrop(400, 30, rects);
    expect(t).toMatchObject({ kind: 'before', parentId: 'root', index: 0, targetId: 'a' });
    expect(t?.indicator.mode).toBe('line');
  });

  it('指针在原子节点下半部 → 插到它之后', () => {
    const t = resolveDrop(400, 70, rects);
    expect(t).toMatchObject({ kind: 'after', parentId: 'root', index: 1, targetId: 'a' });
  });

  it('指针在容器中部 → 放进容器，下标按子节点中线算', () => {
    // 容器内只有 c1（220-280），指针 y=320 在 c1 中线下方 → 插到 c1 之后
    const t = resolveDrop(400, 320, rects);
    expect(t).toMatchObject({ kind: 'inside', parentId: 'c', index: 1 });
  });

  it('指针在容器上边缘 → 插到容器之前，而不是放进容器', () => {
    const t = resolveDrop(400, 203, rects);
    expect(t).toMatchObject({ kind: 'before', parentId: 'root', index: 2 });
  });

  it('嵌套最深优先：指针落在 c1 上时命中的是 c1 而非祖先', () => {
    const t = resolveDrop(400, 230, rects);
    expect(t?.targetId).toBe('c1');
    expect(t).toMatchObject({ kind: 'before', parentId: 'c', index: 0 });
  });

  it('空容器中部 → 放进容器 index 0', () => {
    const empty = rect({
      id: 'e',
      index: 3,
      acceptsChildren: true,
      rect: { top: 450, left: 20, right: 380, bottom: 550, width: 360, height: 100 },
    });
    const t = resolveDrop(200, 500, [...rects, empty]);
    expect(t).toMatchObject({ kind: 'inside', parentId: 'e', index: 0 });
  });

  it('指针在空白处（无节点命中）→ null，交给画布兜底', () => {
    expect(resolveDrop(700, 590, rects)).toMatchObject({ kind: 'inside', parentId: 'root' });
    expect(resolveDrop(-10, -10, rects)).toBeNull();
  });

  it('excludeIds 排除拖拽源子树后不再命中自身', () => {
    const exclude = new Set(['a']);
    const t = resolveDrop(400, 30, rects, { excludeIds: exclude });
    // 排掉 a 之后，同一位置命中的是 root 内部 → 放进根容器
    expect(t?.targetId).toBe('root');
  });

  it('具名插槽投放区整体算「放进去」', () => {
    const slot: DropRect = {
      id: 'slot:card:body',
      kind: 'slot',
      parentId: 'card',
      slot: 'body',
      index: -1,
      acceptsChildren: true,
      depth: 2,
      rect: { top: 0, left: 0, right: 400, bottom: 200, width: 400, height: 200 },
    };
    const inSlot: DropRect = {
      id: 'x',
      kind: 'node',
      parentId: 'card',
      slot: 'body',
      index: 0,
      acceptsChildren: false,
      depth: 3,
      rect: { top: 20, left: 20, right: 380, bottom: 60, width: 360, height: 40 },
    };
    const t = resolveDrop(200, 150, [slot, inSlot]);
    expect(t).toMatchObject({ kind: 'inside', parentId: 'card', slot: 'body', index: 1 });
  });
});

describe('resolveCanvasFallback', () => {
  const canvas = { top: 0, left: 0, right: 1000, bottom: 800, width: 1000, height: 800 };

  it('画布内 → 追加到根末尾', () => {
    expect(resolveCanvasFallback(500, 400, canvas, 'root', 3)).toMatchObject({
      kind: 'inside',
      parentId: 'root',
      index: 3,
    });
  });

  it('画布外 → null', () => {
    expect(resolveCanvasFallback(1200, 400, canvas, 'root', 0)).toBeNull();
  });
});

describe('collectSubtreeIds', () => {
  it('覆盖普通子节点与具名插槽', () => {
    const ids = collectSubtreeIds('a', {
      a: { children: ['b'], namedSlots: { body: ['c'] } },
      b: { children: ['d'] },
      c: { children: [] },
      d: { children: [] },
    });
    expect([...ids].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('容忍环形引用不死循环', () => {
    const ids = collectSubtreeIds('a', { a: { children: ['b'] }, b: { children: ['a'] } });
    expect([...ids].sort()).toEqual(['a', 'b']);
  });
});
