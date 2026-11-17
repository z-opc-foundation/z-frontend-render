import { useMemo, useState } from 'react';
import { Alert, Button, Drawer, Empty, Input, Space, Table, Tag, Typography } from 'antd';
import type { PageSchema } from '../tree';
import { useDesignerStore } from './store';
import { drawerSizeProps } from './antdCompat';

const { Text, Paragraph } = Typography;

/**
 * 版本差异抽屉（diff 可视化）：
 * 粘贴另一版本 schema JSON，与当前 schema 做结构化对比（节点增删改），
 * 展示为差异表。后端 z-lc-schema 的 SchemaDiffer/SchemaMerger 提供更完整的三方合并，
 * 此处是设计器内的轻量即时对比，数据口径一致（elements + layout）。
 */

interface Row {
  key: string;
  op: 'ADDED' | 'REMOVED' | 'CHANGED' | 'SAME';
  target: string;
  detail: string;
}

function compareSchemas(current: PageSchema, other: PageSchema): Row[] {
  const a = current.elements ?? {};
  const b = other.elements ?? {};
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
  const rows: Row[] = [];
  keys.forEach((key) => {
    const na = a[key];
    const nb = b[key];
    if (!na) {
      rows.push({ key, op: 'ADDED', target: key, detail: `新增 ${nb!.type}` });
    } else if (!nb) {
      rows.push({ key, op: 'REMOVED', target: key, detail: `删除 ${na.type}` });
    } else if (JSON.stringify(na) !== JSON.stringify(nb)) {
      rows.push({ key, op: 'CHANGED', target: key, detail: `${na.type}: ${JSON.stringify(na.props ?? {})} → ${JSON.stringify(nb.props ?? {})}` });
    }
  });
  if (rows.length === 0) rows.push({ key: '-', op: 'SAME', target: '-', detail: '两个版本结构一致' });
  return rows;
}

const OP_COLOR: Record<Row['op'], string> = {
  ADDED: 'green',
  REMOVED: 'red',
  CHANGED: 'orange',
  SAME: 'default',
};

export function DiffDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const current = useDesignerStore((s) => s.schema);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [committed, setCommitted] = useState<PageSchema | null>(null);

  const rows = useMemo(() => {
    if (!committed) return [];
    return compareSchemas(current, committed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, committed, open]);

  const handleCompare = () => {
    try {
      const parsed = JSON.parse(text) as PageSchema;
      if (!parsed || typeof parsed !== 'object' || !parsed.elements) {
        throw new Error('不是合法的 PageSchema（缺少 elements）');
      }
      setError(null);
      setCommitted(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'JSON 解析失败');
      setCommitted(null);
    }
  };

  return (
    <Drawer title="版本差异" {...drawerSizeProps(560)} open={open} onClose={onClose} destroyOnHidden>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="结构化 Schema 对比"
        description="粘贴另一版本的 PageSchema JSON，按 elements 节点做增删改对比。完整的三方合并（业务优先）由后端 z-lc-schema 提供。"
      />
      <Paragraph type="secondary" style={{ fontSize: 12 }}>
        当前版本节点数：{Object.keys(current.elements ?? {}).length}
      </Paragraph>
      <Input.TextArea
        rows={6}
        placeholder='粘贴对比版本的 PageSchema JSON，例如 {"elements":{...},"layout":{...}}'
        value={text}
        onChange={(e) => setText(e.target.value)}
        status={error ? 'error' : undefined}
      />
      {error && <Text type="danger" style={{ fontSize: 12 }}>{error}</Text>}
      <Space style={{ marginTop: 8 }}>
        <Button type="primary" size="small" onClick={handleCompare} disabled={!text.trim()}>
          对比
        </Button>
        <Button size="small" onClick={() => { setText(''); setCommitted(null); setError(null); }}>
          清空
        </Button>
      </Space>

      <div style={{ marginTop: 20 }}>
        {!committed ? (
          <Empty description="输入版本后点击对比" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table<Row>
            size="small"
            rowKey="key"
            dataSource={rows}
            pagination={false}
            columns={[
              { title: '操作', dataIndex: 'op', width: 90, render: (op: Row['op']) => <Tag color={OP_COLOR[op]}>{op}</Tag> },
              { title: '节点', dataIndex: 'target', width: 140, render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text> },
              { title: '详情', dataIndex: 'detail', render: (v: string) => <Text style={{ fontSize: 11, wordBreak: 'break-all' }}>{v}</Text> },
            ]}
          />
        )}
      </div>
    </Drawer>
  );
}
