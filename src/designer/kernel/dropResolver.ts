/**
 * 落点解算内核（纯函数，无 React / 无 DOM 依赖）。
 *
 * 设计器拖拽的难点不在「能不能拖」，而在「落在哪」：容器可以嵌套、可以带具名插槽，
 * 父节点矩形天然覆盖子节点矩形。用 dnd-kit 默认的 rectIntersection 会命中面积最大的
 * 祖先（因为父矩形包含指针），于是永远只能追加到最外层。
 *
 * 这里改用自解算：
 *   1. 取所有包含指针的矩形，按面积升序 —— 第一个就是最深的那个节点（真正的目标）；
 *   2. 目标可容纳子节点时，按指针在矩形内的纵向位置分三段：上边缘 → 插到目标之前，
 *      下边缘 → 插到目标之后，中间 → 放进目标内部（再按直接子节点的中线决定插入下标）；
 *   3. 原子节点（不可容纳子节点）只产出前/后两种结果，避免出现「按钮里塞输入框」。
 *
 * 结果是纯数据（父节点 + 插槽 + 下标 + 指示线矩形），store 直接消费；指示线用
 * viewport 坐标 + position:fixed 渲染，不受画布滚动影响。
 */

export interface RectLike {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** 画布上参与落点解算的一个矩形：普通节点 或 具名插槽投放区 */
export interface DropRect {
  /** 节点 id；插槽投放区的 id 形如 slot:<parentId>:<slot> */
  id: string;
  kind: 'node' | 'slot';
  /** 所属父节点；顶层节点为 null */
  parentId: string | null;
  /** 该节点挂在父节点的哪个具名插槽里（普通子节点为 undefined） */
  slot?: string;
  /** 在父节点 children / 插槽列表中的下标；插槽投放区为 -1 */
  index: number;
  /** 该节点能否容纳子节点（容器类物料） */
  acceptsChildren: boolean;
  /** 嵌套深度，仅用于调试与排序兜底 */
  depth: number;
  rect: RectLike;
}

export type DropKind = 'inside' | 'before' | 'after';

/** 指示线：mode=line 画横线（前后插入），mode=box 画内嵌框（放入容器） */
export interface DropIndicator {
  mode: 'line' | 'box';
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface DropTarget {
  kind: DropKind;
  parentId: string;
  slot?: string;
  index: number;
  /** 命中的目标节点/插槽 id，便于高亮 */
  targetId: string;
  indicator: DropIndicator;
}

export interface ResolveOptions {
  /** 参与解算时排除的节点 id（拖拽源自身及其子树：不能拖进自己内部） */
  excludeIds?: Set<string>;
  /** 边缘判定阈值上限，默认 14px */
  edgeMax?: number;
}

const LINE_THICKNESS = 2;

function areaOf(r: RectLike): number {
  return Math.max(0, r.width) * Math.max(0, r.height);
}

function containsPoint(r: RectLike, x: number, y: number): boolean {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function centerY(r: RectLike): number {
  return r.top + r.height / 2;
}

/** 目标节点的直接子节点矩形（按 index 升序）；插槽投放区取该插槽内的节点 */
function directChildren(target: DropRect, rects: DropRect[]): DropRect[] {
  const kids =
    target.kind === 'slot'
      ? rects.filter(
          (r) => r.kind === 'node' && r.parentId === target.parentId && r.slot === target.slot,
        )
      : rects.filter((r) => r.kind === 'node' && r.parentId === target.id && r.slot === undefined);
  return [...kids].sort((a, b) => a.index - b.index);
}

function lineIndicator(r: RectLike, edge: 'top' | 'bottom'): DropIndicator {
  const y = edge === 'top' ? r.top : r.bottom - LINE_THICKNESS;
  return { mode: 'line', top: y, left: r.left, width: r.width, height: LINE_THICKNESS };
}

function boxIndicator(r: RectLike): DropIndicator {
  return { mode: 'box', top: r.top, left: r.left, width: r.width, height: r.height };
}

/** 把指针位置换算成「插到第几个」 */
function indexAtPointer(y: number, kids: DropRect[], fallback: number): number {
  for (const kid of kids) {
    if (y < centerY(kid.rect)) return kid.index;
  }
  return kids.length === 0 ? fallback : (kids[kids.length - 1]?.index ?? fallback) + 1;
}

/**
 * 解算落点。
 *
 * @param x 指针 clientX
 * @param y 指针 clientY
 * @param rects 当前可投放矩形快照
 * @returns 落点；指针不在任何矩形内时返回 null（调用方按「画布空白区」兜底）
 */
export function resolveDrop(
  x: number,
  y: number,
  rects: DropRect[],
  options: ResolveOptions = {},
): DropTarget | null {
  const exclude = options.excludeIds;
  const edgeMax = options.edgeMax ?? 14;
  const pool = exclude ? rects.filter((r) => !exclude.has(r.id)) : rects;

  const hits = pool.filter((r) => containsPoint(r.rect, x, y)).sort((a, b) => areaOf(a.rect) - areaOf(b.rect));
  const target = hits[0];
  if (!target) return null;

  // 插槽投放区：整个区域都是「放进去」，无法在其前后插入
  if (target.kind === 'slot') {
    const kids = directChildren(target, pool);
    return {
      kind: 'inside',
      parentId: target.parentId ?? '',
      slot: target.slot,
      index: kids.length,
      targetId: target.id,
      indicator: boxIndicator(target.rect),
    };
  }

  const h = target.rect.height;
  const edge = Math.min(edgeMax, Math.max(6, h / 3));
  const canInsertSibling = target.parentId !== null;

  if (target.acceptsChildren) {
    if (canInsertSibling && y <= target.rect.top + edge) {
      return {
        kind: 'before',
        parentId: target.parentId!,
        slot: target.slot,
        index: target.index,
        targetId: target.id,
        indicator: lineIndicator(target.rect, 'top'),
      };
    }
    if (canInsertSibling && y >= target.rect.bottom - edge) {
      return {
        kind: 'after',
        parentId: target.parentId!,
        slot: target.slot,
        index: target.index + 1,
        targetId: target.id,
        indicator: lineIndicator(target.rect, 'bottom'),
      };
    }
    const kids = directChildren(target, pool);
    return {
      kind: 'inside',
      parentId: target.id,
      index: indexAtPointer(y, kids, 0),
      targetId: target.id,
      indicator: boxIndicator(target.rect),
    };
  }

  // 原子节点：只能落在它前/后，成为兄弟
  if (!canInsertSibling) return null;
  const before = y < centerY(target.rect);
  return {
    kind: before ? 'before' : 'after',
    parentId: target.parentId!,
    slot: target.slot,
    index: before ? target.index : target.index + 1,
    targetId: target.id,
    indicator: lineIndicator(target.rect, before ? 'top' : 'bottom'),
  };
}

/**
 * 画布兜底：指针落在画布空白处（或最外层容器之外）时，追加到根节点的子列表末尾。
 * 返回 null 表示指针已经离开画布。
 */
export function resolveCanvasFallback(
  x: number,
  y: number,
  canvasRect: RectLike,
  rootId: string,
  rootChildCount: number,
): DropTarget | null {
  if (!containsPoint(canvasRect, x, y)) return null;
  return {
    kind: 'inside',
    parentId: rootId,
    index: rootChildCount,
    targetId: rootId,
    indicator: boxIndicator(canvasRect),
  };
}

/** 收集节点 id 的整棵子树（用于拖拽源排除） */
export function collectSubtreeIds(
  rootId: string,
  structure: Record<string, { children?: string[]; namedSlots?: Record<string, string[]> }> | undefined,
): Set<string> {
  const seen = new Set<string>();
  const walk = (id: string): void => {
    if (seen.has(id)) return;
    seen.add(id);
    const st = structure?.[id];
    if (!st) return;
    (st.children ?? []).forEach(walk);
    Object.values(st.namedSlots ?? {}).forEach((ids) => ids.forEach(walk));
  };
  walk(rootId);
  return seen;
}
