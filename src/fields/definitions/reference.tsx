import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { InputNumber, Select, Typography } from 'antd';
import type { LcRow } from '../../contract/field';
import type { FieldContext, FieldDefinition } from '../types';
import { DEFAULT_FIELD_TYPE_INDEX, operatorsForValueType } from '../defaults';
import { asNumber, asText, isBlank, toWireValue } from '../coerce';
import { NullCell, editorFillStyle } from './shared';

const { Text } = Typography;

/**
 * Reference (REF / `refEntity`) field.
 *
 * The runtime LEFT JOINs `refEntity` as a *table name* on `id` and exposes
 * `{field}_name` sourced from a column literally called `entity_name`. Business
 * tables rarely carry that column, so the derived label is honoured only when
 * actually present; otherwise the picker's own loaded options provide the label
 * and the cell falls back to the visible id.
 */

const REFERENCE_PAGE_SIZE = 50;

function rowLabel(row: LcRow, labelField?: string): string {
  if (labelField && !isBlank(row[labelField])) return asText(row[labelField]);
  const derived = row['entity_name'] ?? row['name'] ?? row['title'];
  if (!isBlank(derived)) return asText(derived);
  return `#${asText(row['id'])}`;
}

/**
 * 引擎不持有传输层: 候选记录由消费方通过 `ctx.services.loadReference` 注入
 * (z-lc 接的是 `api/runtime.listRecords`)。未注入时选择器只剩当前 id, 不发请求。
 *
 * 关键字每次都重新拉, 旧请求的结果由 cancelled 丢掉, 不会覆盖新输入。
 */
function useReferenceOptions(ctx: FieldContext, keyword: string) {
  const target = ctx.refEntity?.entityCode;
  const labelField = ctx.refLabelField?.fieldCode;
  const load = ctx.services.loadReference;
  const { appCode, tenantCode } = ctx;
  const [state, setState] = useState<{ data: LcRow[]; isFetching: boolean; error: unknown }>({
    data: [],
    isFetching: false,
    error: null,
  });

  useEffect(() => {
    if (!target || !load) {
      setState({ data: [], isFetching: false, error: null });
      return;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, isFetching: true, error: null }));
    load({ entityCode: target, appCode, tenantCode, labelField, keyword, page: 1, size: REFERENCE_PAGE_SIZE })
      .then((records) => {
        if (!cancelled) setState({ data: records ?? [], isFetching: false, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ data: [], isFetching: false, error });
      });
    return () => {
      cancelled = true;
    };
  }, [load, target, appCode, tenantCode, labelField, keyword]);

  return state;
}

function Ellipsis({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: 'block',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function ReferenceSelect({
  ctx,
  value,
  onCommit,
  autoFocus,
  disabled,
  inline,
}: {
  ctx: FieldContext;
  value: unknown;
  onCommit: (next: unknown) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  inline?: boolean;
}) {
  const [keyword, setKeyword] = useState('');
  const { data, isFetching, error } = useReferenceOptions(ctx, keyword);
  const labelField = ctx.refLabelField?.fieldCode;

  const options = (data ?? []).map((row) => ({
    value: asNumber(row['id']) ?? asText(row['id']),
    label: rowLabel(row, labelField),
  }));

  // Keep the current selection visible even when it is outside the loaded page.
  const current = asNumber(value);
  if (current !== null && !options.some((option) => option.value === current)) {
    options.unshift({ value: current, label: `#${current}` });
  }

  return (
    <Select
      size={inline ? 'small' : 'middle'}
      style={editorFillStyle}
      showSearch
      allowClear
      autoFocus={autoFocus}
      disabled={disabled || !ctx.refEntity}
      filterOption={false}
      onSearch={setKeyword}
      loading={isFetching}
      placeholder={ctx.refEntity ? '搜索并选择' : '未配置关联实体'}
      value={current ?? undefined}
      options={options}
      onChange={(next) => onCommit(next ?? null)}
      notFoundContent={
        error ? (
          <Text type="danger" style={{ fontSize: 12 }}>
            关联数据加载失败
          </Text>
        ) : isFetching ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            加载中
          </Text>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            无可选记录
          </Text>
        )
      }
    />
  );
}

export const referenceDefinition: FieldDefinition = {
  key: 'ref',
  label: '关联记录',
  order: 3,
  descriptor: {
    ...DEFAULT_FIELD_TYPE_INDEX['REF']!,
    widget: 'reference',
    label: '关联记录',
  },
  operators: operatorsForValueType('Number'),
  configFields: [
    { key: 'refEntity', label: '关联实体', kind: 'entitySelect', required: true },
    { key: 'defaultValue', label: '默认值', kind: 'text', help: '目标记录 id' },
    { key: 'description', label: '说明', kind: 'text' },
  ],
  renderCell: ({ value, displayValue }) => {
    if (isBlank(value)) return <NullCell />;
    // `_name` is only trustworthy when the backend actually returned it.
    const label = isBlank(displayValue) ? `#${asText(value)}` : asText(displayValue);
    return <Ellipsis>{label}</Ellipsis>;
  },
  renderEditor: ({ value, ctx, onCommit }) => (
    <ReferenceSelect ctx={ctx} value={value} onCommit={onCommit} autoFocus inline />
  ),
  renderFormInput: ({ value, onChange, ctx, disabled, preview }) =>
    preview ? (
      <span>{isBlank(value) ? '—' : `#${asText(value)}`}</span>
    ) : (
      <ReferenceSelect ctx={ctx} value={value} onCommit={onChange} disabled={disabled} />
    ),
  renderFilterInput: ({ value, onChange }) => (
    <InputNumber
      size="small"
      style={editorFillStyle}
      controls={false}
      placeholder="记录 id"
      value={asNumber(value)}
      onChange={(next) => onChange(next === null ? undefined : Number(next))}
    />
  ),
  toCellText: ({ value, displayValue }) =>
    isBlank(displayValue) ? asText(value) : asText(displayValue),
  toFormValue: (raw) => asNumber(raw),
  toFieldValue: (formValue) => toWireValue('REF', formValue),
  supportsInlineEdit: (ctx) => Boolean(ctx.refEntity),
  groupValue: ({ value }) => (isBlank(value) ? '(空)' : `#${asText(value)}`),
};

export const referenceDefinitions: FieldDefinition[] = [referenceDefinition];
