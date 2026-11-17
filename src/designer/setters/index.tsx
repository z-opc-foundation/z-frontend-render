import { useEffect, useMemo, useState } from 'react';
import { Input, InputNumber, Select, Space, Switch } from 'antd';
import type { SetterProps, SetterDef, SetterComponent } from '../../tree';
import { createCoreSetterRegistry, setterBehaviors } from '../../tree';

/**
 * 属性面板 setter：宿主用 antd 实现 z-render/tree 的 SetterProps 协议（value/onChange）。
 * 与渲染内核完全解耦 —— 协议来自共享包，UI 由本应用提供。
 */

const stringSetter: SetterComponent = ({ value, onChange, disabled }: SetterProps) => (
  <Input
    size="small"
    disabled={disabled}
    value={value == null ? '' : String(value)}
    onChange={(e) => onChange(e.target.value)}
  />
);

const textareaSetter: SetterComponent = ({ value, onChange, disabled }: SetterProps) => (
  <Input.TextArea
    size="small"
    rows={3}
    disabled={disabled}
    value={value == null ? '' : String(value)}
    onChange={(e) => onChange(e.target.value)}
  />
);

/**
 * JSON setter：表格数据这类「结构化数组」用它。
 * 编辑中允许暂时是半截文本（不能每敲一个字就 parse 失败），失焦时才解析回结构；
 * 解析不了就保持原文，避免把用户正在写的内容冲掉。
 */
const jsonSetter: SetterComponent = ({ value, onChange, disabled }: SetterProps) => {
  const text = useMemo(() => {
    if (value == null) return '';
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  }, [value]);
  const [draft, setDraft] = useState(text);
  useEffect(() => setDraft(text), [text]);
  return (
    <Input.TextArea
      size="small"
      rows={4}
      disabled={disabled}
      value={draft}
      placeholder={'[{ "列字段": "值" }]'}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const raw = draft.trim();
        if (!raw) {
          onChange(undefined);
          return;
        }
        try {
          onChange(JSON.parse(raw));
        } catch {
          /* 写坏了就保持原样，别把用户输入吞掉 */
        }
      }}
    />
  );
};

const numberSetter: SetterComponent = ({ value, onChange, disabled }: SetterProps) => (
  <InputNumber
    size="small"
    disabled={disabled}
    style={{ width: '100%' }}
    value={typeof value === 'number' ? value : value == null || value === '' ? undefined : Number(value)}
    onChange={(v) => onChange(v ?? 0)}
  />
);

const booleanSetter: SetterComponent = ({ value, onChange, disabled }: SetterProps) => (
  <Switch size="small" disabled={disabled} checked={Boolean(value)} onChange={(v) => onChange(v)} />
);

const selectSetter: SetterComponent = ({ value, onChange, config, disabled }: SetterProps) => {
  const raw = Array.isArray(config?.options) ? (config!.options as unknown[]) : [];
  const options = raw.map((o) => ({ label: String(o), value: String(o) }));
  return (
    <Select
      size="small"
      disabled={disabled}
      style={{ width: '100%' }}
      value={value == null ? undefined : String(value)}
      options={options}
      onChange={(v) => onChange(v)}
    />
  );
};

/** 选项编辑：每行一条 `显示名:值`，兼容旧的 {label,value}[] 结构 */
const optionsSetter: SetterComponent = ({ value, onChange, disabled }: SetterProps) => {
  const rows = Array.isArray(value)
    ? (value as Array<Record<string, unknown> | string>)
        .map((o) => (typeof o === 'string' ? o : `${String(o.label ?? '')}:${String(o.value ?? '')}`))
        .join('\n')
    : '';
  return (
    <Input.TextArea
      size="small"
      disabled={disabled}
      rows={3}
      placeholder={'每行一项：显示名:值\n例如：待处理:pending'}
      value={rows}
      onChange={(e) => {
        const next = e.target.value
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const idx = line.indexOf(':');
            return idx >= 0
              ? { label: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() }
              : { label: line, value: line };
          });
        onChange(next);
      }}
    />
  );
};

const dateFormatSetter: SetterComponent = ({ value, onChange, disabled }: SetterProps) => (
  <Select
    size="small"
    disabled={disabled}
    style={{ width: '100%' }}
    value={value == null ? 'YYYY-MM-DD' : String(value)}
    onChange={(v) => onChange(v)}
    options={['YYYY-MM-DD', 'YYYY/MM/DD', 'YYYY-MM-DD HH:mm', 'DD/MM/YYYY'].map((v) => ({ label: v, value: v }))}
  />
);

const PRESET_COLORS = ['', '#ffffff', '#f2f4f7', '#1677ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#1f2329'];

const colorSetter: SetterComponent = ({ value, onChange, disabled }: SetterProps) => {
  const current = value == null ? '' : String(value);
  return (
    <Space.Compact style={{ width: '100%' }}>
      <div className="dn-color-setter">
        {PRESET_COLORS.map((color) => (
          <button
            key={color || 'none'}
            type="button"
            title={color || '透明'}
            disabled={disabled}
            className={`dn-color-dot${current === color ? ' dn-color-dot--active' : ''}`}
            style={{
              background: color || 'transparent',
              borderStyle: color ? 'solid' : 'dashed',
            }}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
      <Input
        size="small"
        disabled={disabled}
        placeholder="#1677ff"
        value={current}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 92 }}
        suffix={
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              display: 'inline-block',
              background: current || 'transparent',
              border: '1px solid #d9d9d9',
            }}
          />
        }
      />
    </Space.Compact>
  );
};

const sizeSetter: SetterComponent = ({ value, onChange, disabled }: SetterProps) => {
  const options = ['auto', '100%', '50%', '320px', '240px', '160px'];
  const current = value == null ? 'auto' : String(value);
  return (
    <Space.Compact style={{ width: '100%' }}>
      <Select
        size="small"
        disabled={disabled}
        style={{ width: 110 }}
        value={options.includes(current) ? current : 'custom'}
        options={[...options, 'custom'].map((v) => ({ label: v === 'custom' ? '自定义' : v, value: v }))}
        onChange={(v) => onChange(v === 'custom' ? current : v)}
      />
      <Input
        size="small"
        disabled={disabled}
        style={{ width: 96 }}
        placeholder="100%"
        value={options.includes(current) ? '' : current}
        onChange={(e) => onChange(e.target.value)}
      />
    </Space.Compact>
  );
};

/** 名称 → 组件实现（宿主侧用 unknown 泛型，value/onChange 自由） */
export const setterComponents: Record<string, SetterComponent> = {
  string: stringSetter,
  text: stringSetter,
  textarea: textareaSetter,
  number: numberSetter,
  boolean: booleanSetter,
  select: selectSetter,
  options: optionsSetter,
  dateFormat: dateFormatSetter,
  color: colorSetter,
  size: sizeSetter,
  json: jsonSetter,
};

/** 把组件实现注入共享包的 setter 注册表，得到可直接渲染的完整注册表 */
export function buildSetterRegistry() {
  const registry = createCoreSetterRegistry();
  Object.entries(setterComponents).forEach(([name, component]) => {
    const existing = registry.get(name);
    registry.register({
      name,
      label: existing?.label ?? name,
      // SetterDef.component 在共享包里固定为 SetterComponent<never>，此处做一次显式转换
      component: component as unknown as SetterDef['component'],
      defaultValue: existing?.defaultValue ?? setterBehaviors[name as keyof typeof setterBehaviors]?.defaultValue,
    });
  });
  return registry;
}

/** 空值占位，供属性面板判断「是否已改过」 */
export function isUnset(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}
