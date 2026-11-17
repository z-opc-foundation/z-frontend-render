import { useMemo, useState } from 'react';
import { Button, Drawer, Empty, Input, InputNumber, Popconfirm, Select, Tag, Tooltip, Typography } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { FlowNode, LogicFlow } from '../tree';
import { useDesignerStore } from './store';
import { drawerSizeProps } from './antdCompat';

const { Text } = Typography;

/**
 * 逻辑编排面板（可编辑）。
 *
 * 数据契约与后端 z-lc-logic 完全一致：flows[flowId] = { headAddress, flowNodeMap }，
 * 每个节点 { execute: { logicType, props }, next: [{address}], pre: [] }。
 * 后端 LogicCompiler 做主干线性化 + 条件分支树 + 子流程内联，所以这里按「主干链」编辑，
 * 保存时统一重建 pre/next 指针 —— 避免手改出断链或环。
 *
 * 节点种类直接对齐 DefaultNodes 注册的 21 类，不做前端私有类型。
 */

interface NodeDraft {
  logicType: string;
  props: Record<string, unknown>;
}

const NODE_GROUPS: Array<{ title: string; items: Array<{ type: string; label: string }> }> = [
  {
    title: '流程控制',
    items: [
      { type: 'start', label: '开始' },
      { type: 'end', label: '结束' },
      { type: 'noop', label: '空操作' },
      { type: 'subflow', label: '子流程' },
      { type: 'timer', label: '等待' },
      { type: 'debug', label: '调试输出' },
    ],
  },
  {
    title: '条件分支',
    items: [
      { type: 'condition', label: '条件' },
      { type: 'rhombCondition', label: '条件(菱形)' },
      { type: 'switchCase', label: '多路分支' },
    ],
  },
  {
    title: '数据操作',
    items: [
      { type: 'setVariables', label: '设置变量' },
      { type: 'setGlobal', label: '设置全局' },
      { type: 'setState', label: '设置状态' },
      { type: 'batchUpdate', label: '批量更新' },
      { type: 'appendList', label: '追加列表' },
      { type: 'interfaceRequest', label: '接口请求' },
      { type: 'customScript', label: '自定义脚本' },
      { type: 'setMaterialProperty', label: '设置组件属性' },
    ],
  },
  {
    title: '交互动作',
    items: [
      { type: 'message', label: '消息提示' },
      { type: 'openModal', label: '打开弹窗' },
      { type: 'closeModal', label: '关闭弹窗' },
      { type: 'jumpLink', label: '页面跳转' },
    ],
  },
];

const TYPE_LABEL = new Map(NODE_GROUPS.flatMap((g) => g.items.map((i) => [i.type, i.label] as const)));

interface FieldDef {
  key: string;
  label: string;
  kind: 'text' | 'textarea' | 'select' | 'number';
  options?: string[];
}

const NODE_FIELDS: Record<string, FieldDef[]> = {
  message: [
    { key: 'type', label: '类型', kind: 'select', options: ['success', 'info', 'warning', 'error'] },
    { key: 'content', label: '文案', kind: 'text' },
  ],
  condition: [{ key: 'expression', label: '条件表达式', kind: 'text' }],
  rhombCondition: [{ key: 'expression', label: '条件表达式', kind: 'text' }],
  switchCase: [{ key: 'expression', label: '分支表达式', kind: 'text' }],
  setVariables: [
    { key: 'variable', label: '变量名', kind: 'text' },
    { key: 'value', label: '值/表达式', kind: 'text' },
  ],
  setGlobal: [
    { key: 'name', label: '全局键', kind: 'text' },
    { key: 'value', label: '值', kind: 'text' },
  ],
  setState: [
    { key: 'stateKey', label: '状态键', kind: 'text' },
    { key: 'value', label: '值', kind: 'text' },
  ],
  batchUpdate: [{ key: 'target', label: '目标数据源', kind: 'text' }],
  appendList: [{ key: 'target', label: '目标列表', kind: 'text' }],
  interfaceRequest: [
    { key: 'url', label: '接口地址', kind: 'text' },
    { key: 'method', label: '方法', kind: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'] },
  ],
  customScript: [{ key: 'code', label: '脚本', kind: 'textarea' }],
  setMaterialProperty: [
    { key: 'target', label: '组件 id', kind: 'text' },
    { key: 'prop', label: '属性名', kind: 'text' },
    { key: 'value', label: '值', kind: 'text' },
  ],
  jumpLink: [{ key: 'url', label: '目标地址', kind: 'text' }],
  openModal: [{ key: 'modalId', label: '弹窗 id', kind: 'text' }],
  timer: [{ key: 'ms', label: '等待毫秒', kind: 'number' }],
  debug: [{ key: 'message', label: '输出内容', kind: 'text' }],
  subflow: [{ key: 'flowId', label: '子流程 id', kind: 'text' }],
};

/** 从 flowNodeMap 沿主干走成线性链（防环） */
function linearize(flow: LogicFlow | undefined): NodeDraft[] {
  if (!flow) return [];
  const map = flow.flowNodeMap ?? {};
  const out: NodeDraft[] = [];
  const seen = new Set<string>();
  let address = flow.headAddress ?? Object.keys(map)[0];
  while (address && map[address] && !seen.has(address)) {
    seen.add(address);
    const node: FlowNode = map[address]!;
    out.push({
      logicType: node.execute?.logicType ?? 'noop',
      props: { ...(node.execute?.props ?? {}) },
    });
    address = node.next?.[0]?.address;
  }
  return out;
}

/** 线性链 → flowNodeMap（重建 pre/next，地址 n1..nN） */
function rebuild(drafts: NodeDraft[]): LogicFlow {
  const flowNodeMap: Record<string, FlowNode> = {};
  drafts.forEach((draft, i) => {
    const address = `n${i + 1}`;
    const nextAddress = i + 1 < drafts.length ? `n${i + 2}` : undefined;
    flowNodeMap[address] = {
      execute: { type: 'logic', logicType: draft.logicType, props: { ...draft.props } },
      next: nextAddress ? [{ address: nextAddress }] : [],
      pre: i > 0 ? [`n${i}`] : [],
    };
  });
  return { headAddress: drafts.length ? 'n1' : undefined, flowNodeMap };
}

function NodeCard({
  draft,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  draft: NodeDraft;
  index: number;
  total: number;
  onChange: (patch: Partial<NodeDraft>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const fields = NODE_FIELDS[draft.logicType] ?? [];
  return (
    <div className="dn-flow-node">
      <div className="dn-flow-node__head">
        <span className="dn-flow-node__idx">{index + 1}</span>
        <Tag color="geekblue">{TYPE_LABEL.get(draft.logicType) ?? draft.logicType}</Tag>
        <Text type="secondary" code style={{ fontSize: 10 }}>
          {draft.logicType}
        </Text>
        <div className="dn-flow-node__ops">
          <Tooltip title="上移">
            <Button size="small" type="text" disabled={index === 0} icon={<ArrowUpOutlined />} onClick={() => onMove(-1)} />
          </Tooltip>
          <Tooltip title="下移">
            <Button
              size="small"
              type="text"
              disabled={index === total - 1}
              icon={<ArrowDownOutlined />}
              onClick={() => onMove(1)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onRemove} />
          </Tooltip>
        </div>
      </div>
      {fields.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 11 }}>
          该节点无需参数
        </Text>
      ) : (
        <div className="dn-flow-node__fields">
          {fields.map((field) => {
            const value = draft.props[field.key];
            const set = (v: unknown) => onChange({ props: { ...draft.props, [field.key]: v } });
            return (
              <label key={field.key} className="dn-flow-field">
                <span>{field.label}</span>
                {field.kind === 'select' ? (
                  <Select
                    size="small"
                    value={value == null ? undefined : String(value)}
                    options={(field.options ?? []).map((o) => ({ label: o, value: o }))}
                    onChange={set}
                    style={{ minWidth: 120 }}
                  />
                ) : field.kind === 'number' ? (
                  <InputNumber size="small" value={Number(value ?? 0)} onChange={(v) => set(v ?? 0)} />
                ) : field.kind === 'textarea' ? (
                  <Input.TextArea size="small" rows={2} value={value == null ? '' : String(value)} onChange={(e) => set(e.target.value)} />
                ) : (
                  <Input size="small" value={value == null ? '' : String(value)} onChange={(e) => set(e.target.value)} />
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LogicDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const logic = useDesignerStore((s) => s.schema.logic);
  const updateLogic = useDesignerStore((s) => s.updateLogic);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [newType, setNewType] = useState<string>('message');

  const flows = logic?.flows ?? {};
  const flowIds = Object.keys(flows);
  const currentId = activeFlowId && flows[activeFlowId] ? activeFlowId : (flowIds[0] ?? null);
  const drafts = useMemo(() => linearize(currentId ? flows[currentId] : undefined), [currentId, flows]);
  const binds = Object.entries(logic?.flowBinds ?? {});

  const writeFlow = (flowId: string, next: NodeDraft[]) => {
    updateLogic((l) => {
      l.flows![flowId] = { ...rebuild(next), id: flowId };
    });
  };

  const addFlow = () => {
    const seq = flowIds.length + 1;
    const flowId = `flow_${seq}`;
    updateLogic((l) => {
      l.flows![flowId] = {
        id: flowId,
        ...rebuild([
          { logicType: 'start', props: {} },
          { logicType: 'message', props: { type: 'success', content: '操作成功' } },
        ]),
      };
    });
    setActiveFlowId(flowId);
  };

  const removeFlow = (flowId: string) => {
    updateLogic((l) => {
      delete l.flows![flowId];
      Object.entries(l.flowBinds ?? {}).forEach(([key, ids]) => {
        const rest = (ids ?? []).filter((id) => id !== flowId);
        if (rest.length) l.flowBinds![key] = rest;
        else delete l.flowBinds![key];
      });
    });
    if (activeFlowId === flowId) setActiveFlowId(null);
  };

  return (
    <Drawer
      title="逻辑编排"
      {...drawerSizeProps(820)}
      open={open}
      onClose={onClose}
      destroyOnHidden
      extra={
        <Button size="small" type="primary" icon={<PlusOutlined />} onClick={addFlow}>
          新建逻辑流
        </Button>
      }
    >
      {flowIds.length === 0 ? (
        <Empty description="还没有逻辑流，先新建一条，再到组件「事件」页签绑定" />
      ) : (
        <div className="dn-logic">
          <aside className="dn-logic__list">
            {flowIds.map((id) => (
              <div
                key={id}
                className={`dn-logic__item${id === currentId ? ' dn-logic__item--active' : ''}`}
                onClick={() => setActiveFlowId(id)}
              >
                <span>{id}</span>
                <Popconfirm title="删除该逻辑流？" okText="删除" cancelText="取消" onConfirm={() => removeFlow(id)}>
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                </Popconfirm>
              </div>
            ))}
          </aside>

          <section className="dn-logic__editor">
            {currentId ? (
              <>
                <div className="dn-logic__chain">
                  {drafts.map((draft, index) => (
                    <NodeCard
                      key={`${currentId}-${index}`}
                      draft={draft}
                      index={index}
                      total={drafts.length}
                      onChange={(patch) => {
                        const next = drafts.map((d, i) =>
                          i === index ? { ...d, ...patch, props: patch.props ?? d.props } : d,
                        );
                        writeFlow(currentId, next);
                      }}
                      onMove={(dir) => {
                        const target = index + dir;
                        if (target < 0 || target >= drafts.length) return;
                        const next = [...drafts];
                        const a = next[index]!;
                        next[index] = next[target]!;
                        next[target] = a;
                        writeFlow(currentId, next);
                      }}
                      onRemove={() => writeFlow(currentId, drafts.filter((_, i) => i !== index))}
                    />
                  ))}
                  {drafts.length === 0 ? <Empty description="该流为空" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : null}
                </div>

                <div className="dn-logic__add">
                  <Select
                    size="small"
                    value={newType}
                    onChange={setNewType}
                    style={{ width: 220 }}
                    options={NODE_GROUPS.map((group) => ({
                      label: group.title,
                      options: group.items.map((item) => ({ label: item.label, value: item.type })),
                    }))}
                  />
                  <Button
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => writeFlow(currentId, [...drafts, { logicType: newType, props: {} }])}
                  >
                    追加节点
                  </Button>
                </div>
              </>
            ) : (
              <Empty description="选择左侧逻辑流" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </section>
        </div>
      )}

      <div className="dn-logic__binds">
        <div className="dn-logic__binds-head">事件绑定（{binds.length}）</div>
        {binds.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            选中组件 → 右侧「事件」页签 → 绑定逻辑流
          </Text>
        ) : (
          binds.map(([key, ids]) => (
            <div key={key} className="dn-logic__bind-row">
              <Text code>{key}</Text>
              <span>→</span>
              {(ids ?? []).map((id) => (
                <Tag key={id} color="blue">
                  {id}
                </Tag>
              ))}
              <Button
                size="small"
                type="link"
                danger
                onClick={() =>
                  updateLogic((l) => {
                    delete l.flowBinds![key];
                  })
                }
              >
                解绑
              </Button>
            </div>
          ))
        )}
      </div>
    </Drawer>
  );
}
