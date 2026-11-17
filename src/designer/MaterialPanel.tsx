import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Empty, Input, Tooltip } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useDesignerStore, locateNode } from './store';
import { GROUP_META, HOST_MATERIALS, materialAcceptsChildren, type HostMaterial } from './materials';

/**
 * 左侧物料面板：分组 + 搜索 + 图标网格。
 *
 * 每个物料既是 dnd-kit 拖拽源，也支持点击追加 —— 拖拽在复杂嵌套里难免有落点歧义，
 * 点击追加是确定性兜底（插到当前选中容器末尾；未选中则插到根末尾）。
 */

export interface MaterialDragData {
  source: 'material';
  materialType: string;
}

const GROUP_ORDER = ['layout', 'form', 'display', 'data'] as const;

function MaterialTile({ material }: { material: HostMaterial }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `material:${material.config.type}`,
    data: { source: 'material', materialType: material.config.type } satisfies MaterialDragData,
  });
  const insertNode = useDesignerStore((s) => s.insertNode);
  const select = useDesignerStore((s) => s.select);
  const schema = useDesignerStore((s) => s.schema);
  const selectedId = useDesignerStore((s) => s.selectedId);

  const addToSelection = () => {
    const selected = selectedId ? schema.elements?.[selectedId] : undefined;
    const canNest = selected ? materialAcceptsChildren(selected.type) : false;
    const parentId = selected && canNest ? selectedId! : (schema.layout?.root ?? 'root');
    insertNode(material.config.type, parentId);
    const loc = locateNode(schema, parentId);
    if (loc) select(parentId);
  };

  return (
    <Tooltip title={`${material.config.title}　拖入画布，或点击追加`} mouseEnterDelay={0.5}>
      <div
        ref={setNodeRef}
        className="dn-material"
        data-material-type={material.config.type}
        style={{ opacity: isDragging ? 0.45 : 1 }}
        {...listeners}
        {...attributes}
        onClick={addToSelection}
      >
        <span className="dn-material__icon">{material.icon}</span>
        <span className="dn-material__label">{material.config.title}</span>
      </div>
    </Tooltip>
  );
}

export function MaterialPanel() {
  const [keyword, setKeyword] = useState('');

  const groups = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const filtered = HOST_MATERIALS.filter((m) => {
      if (!kw) return true;
      const t = m.config.title ?? '';
      return m.config.type.toLowerCase().includes(kw) || t.toLowerCase().includes(kw);
    });
    return GROUP_ORDER.map((group) => ({
      group,
      meta: GROUP_META[group],
      materials: filtered
        .filter((m) => (m.config.group ?? 'display') === group)
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
    })).filter((g) => g.materials.length > 0);
  }, [keyword]);

  return (
    <div className="dn-panel-body">
      <div className="dn-panel-search">
        <Input
          size="small"
          allowClear
          prefix={<SearchOutlined style={{ color: '#9aa4b2' }} />}
          placeholder="搜索组件"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      {groups.length === 0 ? (
        <Empty description="没有匹配的组件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        groups.map(({ group, meta, materials }) => (
          <section key={group} className="dn-group">
            <header className="dn-group__head">
              <span>{meta.title}</span>
              <em>{meta.hint}</em>
            </header>
            <div className="dn-material-grid">
              {materials.map((m) => (
                <MaterialTile key={m.config.type} material={m} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
