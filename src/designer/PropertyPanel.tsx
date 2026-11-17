import { useMemo, useState } from 'react';
import { Button, Empty, Form, Segmented, Select, Tag, Typography } from 'antd';
import type { EditField } from '../tree';
import { useDesignerStore } from './store';
import { MATERIAL_MAP, materialIcon, materialTitle } from './materials';
import { setterComponents } from './setters';

const { Text } = Typography;

/**
 * 右侧属性面板：读取物料的 editConfig（声明式协议，来自 z-render/tree 物料库），
 * 经设计器插件改写后，用 setter 组件渲染成表单。改值即写回 store（含 undo/redo + 钩子）。
 *
 * 三个页签对齐参考引擎的「属性 / 样式 / 事件」分工：
 * - 属性：内容与校验字段（editConfig.group !== 样式）
 * - 样式：尺寸/间距/配色（写进同一份 props，物料渲染时消费）
 * - 事件：物料声明的 eventList → 绑定 schema.logic.flowBinds
 */

type PanelTab = 'props' | 'style' | 'events';

function FieldRow({
  field,
  nodeId,
  props,
}: {
  field: EditField;
  nodeId: string;
  props: Record<string, unknown>;
}) {
  const updateProps = useDesignerStore((s) => s.updateProps);
  const setterName = field.setter ?? field.type ?? 'string';
  const Setter = setterComponents[setterName] ?? setterComponents.string!;
  const current = props[field.field] ?? field.defaultValue;
  return (
    <Form.Item label={field.label ?? field.field} style={{ marginBottom: 10 }} colon={false}>
      <Setter
        value={current}
        config={{ ...(field.props ?? {}), defaultValue: field.defaultValue }}
        onChange={(v) => updateProps(nodeId, { [field.field]: v })}
      />
    </Form.Item>
  );
}

export function PropertyPanel() {
  const selectedId = useDesignerStore((s) => s.selectedId);
  const node = useDesignerStore((s) => (s.selectedId ? s.schema.elements?.[s.selectedId] : undefined));
  const plugins = useDesignerStore((s) => s.plugins);
  const logic = useDesignerStore((s) => s.schema.logic);
  const updateLogic = useDesignerStore((s) => s.updateLogic);
  const [tab, setTab] = useState<PanelTab>('props');

  const fields: EditField[] = useMemo(() => {
    if (!node) return [];
    const base = MATERIAL_MAP.get(node.type)?.config.editConfig;
    return plugins.getEditConfig(node, base) ?? [];
  }, [node, plugins]);

  if (!selectedId || !node) {
    return (
      <div className="dn-panel-empty">
        <Empty description="选中画布上的组件以编辑" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        <div className="dn-panel-empty__tip">
          快捷键：Delete 删除 · ⌘Z 撤销 · ⌘C/⌘V 复制粘贴 · ⌘D 再制
        </div>
      </div>
    );
  }

  const material = MATERIAL_MAP.get(node.type);
  const props = node.props ?? {};
  const contentFields = fields.filter((f) => (f.group ?? '内容') !== '样式');
  const styleFields = fields.filter((f) => (f.group ?? '内容') === '样式');
  const events = material?.config.eventList ?? [];
  const variables = material?.config.variableList ?? [];
  const flows = Object.keys(logic?.flows ?? {});

  const groupOf = (field: EditField): string => field.group ?? '内容';
  const grouped = contentFields.reduce<Record<string, EditField[]>>((acc, f) => {
    const g = groupOf(f);
    acc[g] = [...(acc[g] ?? []), f];
    return acc;
  }, {});

  const bindFlow = (eventName: string, flowId: string | undefined) => {
    const key = `${selectedId}.${eventName}`;
    updateLogic((l) => {
      if (!flowId) {
        delete l.flowBinds![key];
        return;
      }
      l.flowBinds![key] = [flowId];
    });
  };

  const createFlowFor = (eventName: string) => {
    const seq = Object.keys(logic?.flows ?? {}).length + 1;
    const flowId = `flow_${seq}_${eventName}`;
    const key = `${selectedId}.${eventName}`;
    updateLogic((l) => {
      l.flows![flowId] = {
        id: flowId,
        headAddress: 'n1',
        flowNodeMap: {
          n1: { execute: { type: 'logic', logicType: 'start' }, next: [{ address: 'n2' }] },
          n2: { execute: { type: 'logic', logicType: 'message', props: { type: 'success', content: '操作成功' } }, next: [] },
        },
      };
      l.flowBinds![key] = [flowId];
    });
  };

  const boundFlow = (eventName: string): string | undefined => logic?.flowBinds?.[`${selectedId}.${eventName}`]?.[0];

  return (
    <div className="dn-prop">
      <div className="dn-prop__head">
        <span className="dn-prop__icon">{materialIcon(node.type)}</span>
        <div className="dn-prop__title">
          <div>
            <Text strong>{materialTitle(node.type)}</Text>
            <Tag color="blue" style={{ marginLeft: 6 }}>
              {node.type}
            </Tag>
          </div>
          <Text type="secondary" code style={{ fontSize: 11 }}>
            {selectedId}
          </Text>
        </div>
      </div>

      <div className="dn-prop__tabs">
        <Segmented
          size="small"
          block
          value={tab}
          onChange={(v) => setTab(v as PanelTab)}
          options={[
            { label: '属性', value: 'props' },
            { label: '样式', value: 'style' },
            { label: '事件', value: 'events' },
          ]}
        />
      </div>

      <div className="dn-prop__body">
        {tab === 'props' ? (
          <>
            {Object.keys(grouped).length === 0 ? (
              <Text type="secondary">该组件没有可配置属性</Text>
            ) : (
              Object.entries(grouped).map(([group, list]) => (
                <section key={group} className="dn-prop__section">
                  <header>{group}</header>
                  <Form size="small" layout="vertical">
                    {list.map((field) => (
                      <FieldRow key={field.field} field={field} nodeId={selectedId} props={props} />
                    ))}
                  </Form>
                </section>
              ))
            )}
            {variables.length > 0 ? (
              <section className="dn-prop__section">
                <header>可用变量</header>
                <div className="dn-prop__chips">
                  {variables.map((v) => (
                    <Tag key={v.name} color="purple">
                      {v.name}
                    </Tag>
                  ))}
                </div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  在文本/字段中用 {'${变量名}'} 引用
                </Text>
              </section>
            ) : null}
          </>
        ) : null}

        {tab === 'style' ? (
          <section className="dn-prop__section">
            <header>盒模型与外观</header>
            {styleFields.length === 0 ? (
              <Text type="secondary">该组件没有样式项</Text>
            ) : (
              <Form size="small" layout="vertical">
                {styleFields.map((field) => (
                  <FieldRow key={field.field} field={field} nodeId={selectedId} props={props} />
                ))}
              </Form>
            )}
          </section>
        ) : null}

        {tab === 'events' ? (
          <section className="dn-prop__section">
            <header>事件绑定</header>
            {events.length === 0 ? (
              <Text type="secondary">该组件未声明事件</Text>
            ) : (
              events.map((event) => (
                <div key={event.name} className="dn-event-row">
                  <div className="dn-event-row__name">
                    <Text code>{event.name}</Text>
                    <span>{event.description}</span>
                  </div>
                  {flows.length === 0 ? (
                    <Button size="small" type="dashed" block onClick={() => createFlowFor(event.name)}>
                      新建逻辑流并绑定
                    </Button>
                  ) : (
                    <Select
                      size="small"
                      allowClear
                      style={{ width: '100%' }}
                      placeholder="选择逻辑流"
                      value={boundFlow(event.name)}
                      options={flows.map((f) => ({ label: f, value: f }))}
                      onChange={(v) => bindFlow(event.name, v ?? undefined)}
                    />
                  )}
                </div>
              ))
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
