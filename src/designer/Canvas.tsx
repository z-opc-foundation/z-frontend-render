import type { CSSProperties, ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Tooltip } from 'antd';
import { CopyOutlined, DeleteOutlined, SelectOutlined } from '@ant-design/icons';
import type { PageSchema } from '../tree';
import { useDesignerStore } from './store';
import { MATERIAL_MAP, materialAcceptsChildren, materialTitle } from './materials';
import { recentlyDragged } from './kernel/dragState';

/**
 * 中间画布：设计态渲染器。
 *
 * 与运行态 TreeRenderer 同构（elements 扁平表 + layout.structure 树 + 具名插槽），
 * 差别只有三处：每个节点包一层「可选中的壳」、壳上挂落点解算所需的 data-dnode 属性、
 * 以及拖拽/选中/落点这些编辑态装饰。
 *
 * 关键设计：**装饰不进布局**。选中框用 outline（不占空间），标签与操作条绝对定位，
 * 空容器的占位提示用 min-height 而非额外节点 —— 否则设计态和运行态的排版会不一致，
 * 「所见即所得」就成了一句空话。
 */

export const CANVAS_SCROLL_ID = 'designer-canvas-scroll';

const VIEWPORT_WIDTH: Record<string, string> = {
  desktop: '100%',
  tablet: '820px',
  mobile: '390px',
};

function numStyle(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function wrapperStyle(props: Record<string, unknown>): CSSProperties {
  const margin = numStyle(props.margin);
  const width = props.width && props.width !== 'auto' ? String(props.width) : undefined;
  return {
    ...(margin !== undefined ? { margin } : {}),
    ...(width ? { width } : {}),
  };
}

interface DesignNodeProps {
  nodeId: string;
  parentId: string | null;
  slot?: string;
  index: number;
  depth: number;
  schema: PageSchema;
}

function DesignNode({ nodeId, parentId, slot, index, depth, schema }: DesignNodeProps) {
  const selectedId = useDesignerStore((s) => s.selectedId);
  const hoveredId = useDesignerStore((s) => s.hoveredId);
  const mode = useDesignerStore((s) => s.mode);
  const select = useDesignerStore((s) => s.select);
  const hover = useDesignerStore((s) => s.hover);
  const removeNode = useDesignerStore((s) => s.removeNode);
  const duplicate = useDesignerStore((s) => s.duplicate);
  const selectParent = useDesignerStore((s) => s.selectParent);

  const node = schema.elements?.[nodeId];
  const accepts = node ? materialAcceptsChildren(node.type) : false;

  const { setNodeRef, setActivatorNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `node:${nodeId}`,
    data: { source: 'node', nodeId },
    // 根节点不可拖；预览态整体不参与拖拽
    disabled: mode === 'preview' || nodeId === schema.layout?.root,
  });

  if (!node) return null;

  const def = MATERIAL_MAP.get(node.type);
  const structure = schema.layout?.structure?.[nodeId];
  const selected = selectedId === nodeId;
  const hovered = hoveredId === nodeId && !selected;

  const children: ReactNode[] = (structure?.children ?? []).map((id, i) => (
    <DesignNode
      key={id}
      nodeId={id}
      parentId={nodeId}
      index={i}
      depth={depth + 1}
      schema={schema}
    />
  ));

  const slots: Record<string, ReactNode> = {};
  Object.entries(structure?.namedSlots ?? {}).forEach(([slotName, ids]) => {
    slots[slotName] = (
      <div
        key={slotName}
        className="dn-slot"
        data-dnode={`slot:${nodeId}:${slotName}`}
        data-dnode-kind="slot"
        data-dnode-parent={nodeId}
        data-dnode-slot={slotName}
        data-dnode-index="-1"
        data-dnode-accepts="1"
        data-dnode-depth={depth + 1}
      >
        <div className="dn-slot__label">{slotName}</div>
        {ids.map((id, i) => (
          <DesignNode key={id} nodeId={id} parentId={nodeId} slot={slotName} index={i} depth={depth + 2} schema={schema} />
        ))}
      </div>
    );
  });

  const emptyChildren = children.length === 0 && Object.keys(slots).length === 0;

  return (
    <div
      ref={setNodeRef}
      className={[
        'dn-node',
        selected ? 'dn-node--selected' : '',
        hovered ? 'dn-node--hovered' : '',
        isDragging ? 'dn-node--dragging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-dnode={nodeId}
      data-dnode-kind="node"
      data-dnode-parent={parentId ?? ''}
      data-dnode-slot={slot ?? ''}
      data-dnode-index={index}
      data-dnode-accepts={accepts ? '1' : '0'}
      data-dnode-depth={depth}
      data-node-type={node.type}
      style={wrapperStyle(node.props ?? {})}
      {...listeners}
      {...attributes}
      onMouseEnter={() => hover(nodeId)}
      onMouseLeave={() => hover(null)}
      onClick={(e) => {
        if (recentlyDragged()) return;
        e.stopPropagation();
        select(nodeId);
      }}
    >
      {/* 抓手：整块节点都可拖，这块只负责光标提示与无障碍命名 */}
      <span ref={setActivatorNodeRef} className="dn-node__handle" aria-label={`拖动 ${materialTitle(node.type)}`} />

      <span className="dn-node__badge">{materialTitle(node.type)}</span>

      {(selected || hovered) && nodeId !== schema.layout?.root ? (
        <span className="dn-node__actions" onClick={(e) => e.stopPropagation()}>
          <Tooltip title="选中父级">
            <button type="button" className="dn-icon-btn" aria-label="选中父级" onClick={selectParent}>
              <SelectOutlined />
            </button>
          </Tooltip>
          <Tooltip title="复制节点">
            <button type="button" className="dn-icon-btn" aria-label="复制节点" onClick={() => duplicate(nodeId)}>
              <CopyOutlined />
            </button>
          </Tooltip>
          <Tooltip title="删除">
            <button type="button" className="dn-icon-btn dn-icon-btn--danger" aria-label="删除节点" onClick={() => removeNode(nodeId)}>
              <DeleteOutlined />
            </button>
          </Tooltip>
        </span>
      ) : null}

      {def ? (
        <def.view
          props={node.props ?? {}}
          nodeId={nodeId}
          children={children}
          slots={slots}
          context={{ designMode: true }}
          emit={() => undefined}
        />
      ) : (
        <div className="dn-unregistered">未注册物料：{node.type}</div>
      )}

      {accepts && emptyChildren ? (
        <div className="dn-empty-hint">
          {nodeId === schema.layout?.root ? '从左侧组件面板拖入，或点击组件追加' : '拖入组件'}
        </div>
      ) : null}
    </div>
  );
}

export function Canvas() {
  const schema = useDesignerStore((s) => s.schema);
  const select = useDesignerStore((s) => s.select);
  const viewport = useDesignerStore((s) => s.viewport);
  const zoom = useDesignerStore((s) => s.zoom);

  const root = schema.layout?.root;

  return (
    <div
      id={CANVAS_SCROLL_ID}
      className="dn-canvas-scroll"
      data-panel="canvas"
      onClick={() => {
        if (recentlyDragged()) return;
        select(null);
      }}
    >
      <div
        className="dn-canvas-frame"
        data-tree-renderer="design"
        style={{
          width: VIEWPORT_WIDTH[viewport] ?? '100%',
          transform: `scale(${zoom})`,
          transformOrigin: 'top center',
        }}
      >
        <div className="dn-page">
          {!root ? (
            <div className="dn-empty-page">Schema 缺少根节点</div>
          ) : (
            <>
              <DesignNode nodeId={root} parentId={null} index={-1} depth={0} schema={schema} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
