import type { DropRect, RectLike } from './dropResolver';

/**
 * DOM → 落点矩形快照。
 *
 * 画布（含大纲树）上每个可投放元素都带 data-dnode* 属性，属性即契约：
 *   data-dnode="<id>"            节点 id（插槽区为 slot:<parent>:<slot>）
 *   data-dnode-kind="node|slot"
 *   data-dnode-parent="<id|>"    父节点，空串表示顶层
 *   data-dnode-slot="<name>"     所属具名插槽
 *   data-dnode-index="<n>"       在父级中的下标
 *   data-dnode-accepts="1|0"     能否容纳子节点
 *   data-dnode-depth="<n>"       嵌套深度
 *
 * 这样做的好处：画布与大纲树共用同一套解算逻辑 —— 大纲树行只要挂同样的属性，
 * 拖到树上同样能算出 before/after/inside，无需第二套实现。
 */

export const DNODE_ATTR = 'data-dnode';

function readNumber(el: HTMLElement, name: string, fallback: number): number {
  const raw = el.getAttribute(name);
  if (raw == null || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toRectLike(el: Element): RectLike {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}

/** 从文档里抓一份当前可投放矩形快照 */
export function snapshotDropRects(root: ParentNode = document): DropRect[] {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(`[${DNODE_ATTR}]`));
  const out: DropRect[] = [];
  for (const el of nodes) {
    const id = el.getAttribute(DNODE_ATTR);
    if (!id) continue;
    const rect = toRectLike(el);
    // 零尺寸元素不参与（display:none / 尚未布局）
    if (rect.width <= 0 || rect.height <= 0) continue;
    const parentRaw = el.getAttribute('data-dnode-parent') ?? '';
    const slotRaw = el.getAttribute('data-dnode-slot') ?? '';
    out.push({
      id,
      kind: el.getAttribute('data-dnode-kind') === 'slot' ? 'slot' : 'node',
      parentId: parentRaw === '' ? null : parentRaw,
      slot: slotRaw === '' ? undefined : slotRaw,
      index: readNumber(el, 'data-dnode-index', -1),
      acceptsChildren: el.getAttribute('data-dnode-accepts') === '1',
      depth: readNumber(el, 'data-dnode-depth', 0),
      rect,
    });
  }
  return out;
}

/** 画布滚动容器的可见矩形（作为空白区兜底） */
export function rectOf(el: Element | null): RectLike | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}
