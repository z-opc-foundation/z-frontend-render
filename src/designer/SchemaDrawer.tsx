import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Drawer, Empty, Form, Input, Popconfirm, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import type { PageSchema } from '../tree';
import { useDesignerStore } from './store';
import { drawerSizeProps } from './antdCompat';

const { Text, Paragraph } = Typography;

/**
 * PageSchema 抽屉：
 * - JSON：查看当前契约快照，可复制、可导入替换（导入走结构校验，字段不全直接拒绝）
 * - 变量：页面级上下文声明（schema.context.variableList），文本里用 ${name} 引用
 * - 页面：id / 标题 / 描述等 meta
 *
 * 这里不做「代码生成」——契约本身就是产物，后端 z-lc-schema 负责校验与三方合并。
 */

interface VariableRow {
  name: string;
  type?: string;
  description?: string;
  defaultValue?: unknown;
}

const VARIABLE_TYPES = ['string', 'number', 'boolean', 'object', 'array'];

export function SchemaDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const schema = useDesignerStore((s) => s.schema);
  const setSchema = useDesignerStore((s) => s.setSchema);
  const updateContext = useDesignerStore((s) => s.updateContext);
  const updatePageMeta = useDesignerStore((s) => s.updatePageMeta);
  const [tab, setTab] = useState('json');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const json = useMemo(() => JSON.stringify(schema, null, 2), [schema]);
  const variables: VariableRow[] = (schema.context?.variableList ?? []) as VariableRow[];

  useEffect(() => {
    if (!open) {
      setImportText('');
      setImportError(null);
    }
  }, [open]);

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText) as PageSchema;
      if (!parsed || typeof parsed !== 'object') throw new Error('不是合法 JSON 对象');
      if (!parsed.elements || typeof parsed.elements !== 'object') throw new Error('缺少 elements（扁平节点表）');
      if (!parsed.layout?.root) throw new Error('缺少 layout.root（根节点 id）');
      if (!parsed.elements[parsed.layout.root]) throw new Error(`layout.root 指向的节点 ${parsed.layout.root} 不存在`);
      setSchema(parsed);
      setImportError(null);
      setImportText('');
      message.success('已导入并替换当前 Schema');
    } catch (e) {
      setImportError(e instanceof Error ? e.message : '解析失败');
    }
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(json);
      message.success(`已复制 ${json.length} 字节`);
    } catch {
      message.warning('浏览器拒绝了剪贴板访问，请手动全选复制');
    }
  };

  const setVariables = (next: VariableRow[]) => {
    updateContext((ctx) => {
      ctx.variableList = next as NonNullable<typeof ctx.variableList>;
    });
  };

  return (
    <Drawer title="页面 Schema" {...drawerSizeProps(620)} open={open} onClose={onClose} destroyOnHidden>
      <Tabs
        size="small"
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'json',
            label: 'JSON',
            children: (
              <>
                <Space style={{ marginBottom: 8 }}>
                  <Tag>{(json.length / 1024).toFixed(1)} KB</Tag>
                  <Tag>节点 {Object.keys(schema.elements ?? {}).length}</Tag>
                  <Button size="small" onClick={copyJson}>
                    复制
                  </Button>
                </Space>
                <Input.TextArea readOnly rows={16} value={json} style={{ fontFamily: 'monospace', fontSize: 11 }} />
                <Paragraph type="secondary" style={{ fontSize: 11, marginTop: 8 }}>
                  导入会整体替换当前设计（可 ⌘Z 撤销）：
                </Paragraph>
                <Input.TextArea
                  rows={5}
                  placeholder='粘贴 PageSchema JSON，例如 {"elements":{…},"layout":{"root":"root",…}}'
                  value={importText}
                  status={importError ? 'error' : undefined}
                  onChange={(e) => setImportText(e.target.value)}
                />
                {importError ? (
                  <Text type="danger" style={{ fontSize: 12 }}>
                    {importError}
                  </Text>
                ) : null}
                <Space style={{ marginTop: 8 }}>
                  <Popconfirm title="用导入的 Schema 替换当前设计？" okText="替换" cancelText="取消" onConfirm={handleImport}>
                    <Button size="small" type="primary" disabled={!importText.trim()}>
                      导入替换
                    </Button>
                  </Popconfirm>
                  <Button size="small" onClick={() => setImportText('')} disabled={!importText}>
                    清空
                  </Button>
                </Space>
              </>
            ),
          },
          {
            key: 'vars',
            label: `变量 (${variables.length})`,
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="页面级上下文变量"
                  description="声明后可在文本/表达式中用 ${变量名} 引用；逻辑流通过 setVariables 节点写入。"
                />
                {variables.length === 0 ? (
                  <Empty description="还没有变量" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <Table<VariableRow>
                    size="small"
                    rowKey="name"
                    pagination={false}
                    dataSource={variables}
                    columns={[
                      { title: '名称', dataIndex: 'name', width: 130 },
                      { title: '类型', dataIndex: 'type', width: 100, render: (v?: string) => v ?? 'string' },
                      { title: '说明', dataIndex: 'description' },
                      {
                        title: '',
                        width: 60,
                        render: (_, row) => (
                          <Button
                            size="small"
                            type="link"
                            danger
                            onClick={() => setVariables(variables.filter((v) => v.name !== row.name))}
                          >
                            删除
                          </Button>
                        ),
                      },
                    ]}
                  />
                )}
                <Form
                  size="small"
                  layout="inline"
                  style={{ marginTop: 12 }}
                  onFinish={(values: { name: string; type: string; description?: string }) => {
                    if (!values.name) return;
                    if (variables.some((v) => v.name === values.name)) {
                      message.warning('变量名已存在');
                      return;
                    }
                    setVariables([
                      ...variables,
                      { name: values.name, type: values.type, description: values.description },
                    ]);
                  }}
                >
                  <Form.Item name="name" rules={[{ required: true, message: '名称' }]}>
                    <Input placeholder="变量名" style={{ width: 130 }} />
                  </Form.Item>
                  <Form.Item name="type" initialValue="string">
                    <Select
                      style={{ width: 100 }}
                      options={VARIABLE_TYPES.map((t) => ({ label: t, value: t }))}
                    />
                  </Form.Item>
                  <Form.Item name="description">
                    <Input placeholder="说明" style={{ width: 150 }} />
                  </Form.Item>
                  <Button size="small" type="primary" htmlType="submit">
                    添加
                  </Button>
                </Form>
              </>
            ),
          },
          {
            key: 'page',
            label: '页面',
            children: (
              <Form size="small" layout="vertical">
                <Form.Item label="页面 ID">
                  <Input
                    value={schema.id ?? ''}
                    onChange={(e) => updatePageMeta({ id: e.target.value })}
                    placeholder="page id，发布后用于路由"
                  />
                </Form.Item>
                <Form.Item label="页面标题">
                  <Input
                    value={String(schema.meta?.title ?? '')}
                    onChange={(e) => updatePageMeta({ title: e.target.value })}
                    placeholder="显示名称"
                  />
                </Form.Item>
                <Form.Item label="描述">
                  <Input.TextArea
                    rows={2}
                    value={String(schema.meta?.description ?? '')}
                    onChange={(e) => updatePageMeta({ description: e.target.value })}
                  />
                </Form.Item>
                <Form.Item label="契约版本">
                  <Input value={schema.version ?? '1.0'} readOnly />
                </Form.Item>
              </Form>
            ),
          },
        ]}
      />
    </Drawer>
  );
}
