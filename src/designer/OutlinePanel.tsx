import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CaretDownOutlined, CaretRightOutlined, DeleteOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import type { PageSchema } from '../tree';
import { useDesignerStore } from './store';
import { materialAcceptsChildren, materialIcon, materialTitle } from './materials';

/**
 * 大纲树：把组件树摊平成带缩进的行（不是嵌套 DOM）。
 *
 * 摊平的好处：行与行之间没有嵌套关系，拖拽时不会出现「拖父行触发子行」的问题，
 * 落点解算也只需要行自带 data-dnode 属性 —— 与画布共用同一套 resolver。
 */

interface Row {
  id: string;
  parentId: string | null;
  slot?: string;
  index: number;
  depth: number;
  hasChildren: boolean;
}

function flatten(schema: PageSchema, collapsed: Set<string>): Row[] {
  const rows: Row[] = [];
  const structure = schema.layout?.structure ?? {};
  const visit = (id: string, parentId: string | null, slot: string | undefined, index: number, depth: number): void => {
    const st = structure[id];
    const childCount = (st?.children?.length ?? 0) + Object.values(st?.namedSlots ?? {}).reduce((n, v) => n + v.length, 0);
    rows.push({ id, parentId, slot, index, depth, hasChildren: childCount > 0 });
    if (collapsed.has(id)) return;
    (st?.children ?? []).forEach((childId, i) => visit(childId, id, undefined, i, depth + 1));
    Object.entries(st?.namedSlots ?? {}).forEach(([slotName, ids]) => {
      ids.forEach((childId, i) => visit(childId, id, slotName, i, depth + 1));
    });
  };
  const root = schema.layout?.root;
  if (root) visit(root, null, undefined, -1, 0);
  return rows;
}

function OutlineRow({
  row,
  selected,
  collapsed,
  onToggle,
}: {
  row: Row;
  selected: boolean;
  collapsed: boolean;
  onToggle: (id: string) => void;
}) {
  const node = useDesignerStore((s) => s.schema.elements?.[row.id]);
  const hoveredId = useDesignerStore((s) => s.hoveredId);
  const select = useDesignerStore((s) => s.select);
  const hover = useDesignerStore((s) => s.hover);
  const removeNode = useDesignerStore((s) => s.removeNode);
  const isRoot = useDesignerStore((s) => s.schema.layout?.root === row.id);

  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `outline:${row.id}`,
    data: { source: 'node', nodeId: row.id },
    disabled: isRoot,
  });

  if (!node) return null;
  const accepts = materialAcceptsChildren(node.type);

  return (
    <div
      ref={setNodeRef}
      className={[
        'dn-outline-row',
        selected ? 'dn-outline-row--selected' : '',
        hoveredId === row.id ? 'dn-outline-row--hovered' : '',
        isDragging ? 'dn-outline-row--dragging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-dnode={row.id}
      data-dnode-kind="node"
      data-dnode-parent={row.parentId ?? ''}
      data-dnode-slot={row.slot ?? ''}
      data-dnode-index={row.index}
      data-dnode-accepts={accepts ? '1' : '0'}
      data-dnode-depth={row.depth}
      data-outline-row={row.id}
      style={{ paddingLeft: 8 + row.depth * 14 }}
      {...listeners}
      {...attributes}
      onClick={() => select(row.id)}
      onMouseEnter={() => hover(row.id)}
      onMouseLeave={() => hover(null)}
    >
      <span
        className="dn-outline-row__caret"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(row.id);
        }}
      >
        {row.hasChildren ? collapsed ? <CaretRightOutlined /> : <CaretDownOutlined /> : null}
      </span>
      <span className="dn-outline-row__icon">{materialIcon(node.type)}</span>
      <span className="dn-outline-row__title">{materialTitle(node.type)}</span>
      {row.slot ? <span className="dn-outline-row__slot">{row.slot}</span> : null}
      {!isRoot ? (
        <span className="dn-outline-row__actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="dn-icon-btn dn-icon-btn--danger" onClick={() => removeNode(row.id)}>
            <DeleteOutlined />
          </button>
        </span>
      ) : null}
    </div>
  );
}

export function OutlinePanel() {
  const schema = useDesignerStore((s) => s.schema);
  const selectedId = useDesignerStore((s) => s.selectedId);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const rows = useMemo(() => flatten(schema, collapsed), [schema, collapsed]);

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (rows.length === 0) {
    return (
      <div className="dn-panel-empty">
        <EyeInvisibleOutlined /> 暂无节点
      </div>
    );
  }

  return (
    <div className="dn-panel-body dn-outline">
      {rows.map((row) => (
        <OutlineRow
          key={`${row.parentId ?? 'root'}:${row.slot ?? ''}:${row.id}`}
          row={row}
          selected={selectedId === row.id}
          collapsed={collapsed.has(row.id)}
          onToggle={toggle}
        />
      ))}
    </div>
  );
}
