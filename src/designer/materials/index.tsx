import type { ReactNode } from 'react';
import {
  Button,
  Checkbox,
  DatePicker,
  Divider,
  Input,
  InputNumber,
  Progress,
  Radio,
  Rate,
  Select,
  Slider,
  Switch,
  Table,
  Tag,
  Upload,
} from 'antd';
import {
  AlignLeftOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BorderOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  CloudUploadOutlined,
  ColumnWidthOutlined,
  FileTextOutlined,
  FontSizeOutlined,
  FormOutlined,
  HolderOutlined,
  InfoCircleOutlined,
  LineOutlined,
  MinusSquareOutlined,
  NumberOutlined,
  PictureOutlined,
  PlaySquareOutlined,
  SlidersOutlined,
  StarOutlined,
  SwapOutlined,
  TableOutlined,
  TagOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import type { EditField, MaterialConfig, MaterialDefinition, MaterialView } from '../../tree';

/**
 * 宿主物料库：z-lc 设计器 / 运行时共用的一套物料实现（antd 渲染）。
 *
 * 与 @yuku123/z-frontend-render/tree 内置的极简物料不同：那份是无依赖兜底实现，
 * 保证共享包零耦合；这里用 antd 画出真实观感，并补齐声明式属性面板（editConfig）、
 * 默认属性、能否容纳子节点等信息 —— 设计态与运行态读的是同一份定义。
 *
 * 约定：
 * - view 收到 context.designMode=true 时按「设计态」渲染（不弹日期面板、不真正上传），
 *   保证画布上的点击不会打断拖拽；预览/运行态则渲染可交互组件。
 * - group 决定左栏分区：layout 布局容器 / form 表单控件 / display 展示 / data 数据。
 */

export type MaterialGroup = 'layout' | 'form' | 'display' | 'data';

export interface HostMaterial extends MaterialDefinition {
  icon: ReactNode;
  /** 能否容纳子节点（决定拖拽时是「放进去」还是「插到前后」） */
  canHaveChildren?: boolean;
  /** 左栏排序权重 */
  order?: number;
}

const FIELD_GROUP = '内容';
const STYLE_GROUP = '样式';
const RULE_GROUP = '校验';

function isDesign(ctx: Record<string, unknown>): boolean {
  return ctx?.designMode === true;
}

function str(v: unknown, fallback = ''): string {
  return v == null ? fallback : String(v);
}

/** 选项归一化：支持字符串数组与 {label,value} 数组 */
function normalizeOptions(raw: unknown): Array<{ label: string; value: string }> {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === 'string' || typeof item === 'number') {
      return { label: String(item), value: String(item) };
    }
    const obj = item as Record<string, unknown>;
    const value = obj.value ?? obj.label ?? '';
    return { label: str(obj.label ?? value), value: str(value) };
  });
}

function fieldShell(
  props: Record<string, unknown>,
  control: ReactNode,
  opts: { inline?: boolean } = {},
): ReactNode {
  const label = props.label == null ? '' : String(props.label);
  if (!label) return control;
  return (
    <div className={`dn-field${opts.inline ? ' dn-field--inline' : ''}`}>
      <div className="dn-field__label">
        {label}
        {props.required ? <span className="dn-field__req">*</span> : null}
      </div>
      <div className="dn-field__control">{control}</div>
    </div>
  );
}

function textValue(props: Record<string, unknown>, key = 'text'): string {
  const v = props[key];
  if (v != null) return String(v);
  return key === 'text' ? str(props.value) : '';
}

const containerView: MaterialView = ({ props, children }) => (
  <div
    className="dn-container"
    style={{
      display: 'flex',
      flexDirection: str(props.direction, 'column') as 'column',
      gap: Number(props.gap ?? 12),
      padding: Number(props.padding ?? 16),
      background: str(props.background, 'transparent') || 'transparent',
      borderRadius: Number(props.radius ?? 6),
      border: props.bordered === false ? 'none' : '1px solid #e6e8eb',
      minHeight: 56,
    }}
  >
    {children}
  </div>
);

const cardView: MaterialView = ({ props, children, slots }) => (
  <div className="dn-card">
    <div className="dn-card__head">
      <span className="dn-card__title">{textValue(props, 'title') || '卡片标题'}</span>
      {props.extraText ? <span className="dn-card__extra">{String(props.extraText)}</span> : null}
    </div>
    <div className="dn-card__body">
      {slots?.default ?? null}
      {children}
    </div>
  </div>
);

const gridView: MaterialView = ({ props, children }) => (
  <div
    className="dn-grid"
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${Number(props.columns ?? 2)}, minmax(0, 1fr))`,
      gap: Number(props.gap ?? 12),
    }}
  >
    {children}
  </div>
);

const formView: MaterialView = ({ props, children }) => (
  <div
    className="dn-form"
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: Number(props.gap ?? 14),
      padding: Number(props.padding ?? 16),
    }}
  >
    {props.title ? <div className="dn-form__title">{String(props.title)}</div> : null}
    {children}
  </div>
);

const inputView: MaterialView = ({ props, context }) => (
  <div style={{ pointerEvents: isDesign(context) ? 'none' : undefined }}>
    {fieldShell(
      props,
      <Input
        placeholder={str(props.placeholder, '请输入')}
        value={typeof props.value === 'string' ? props.value : undefined}
        readOnly={isDesign(context)}
        allowClear={!isDesign(context)}
      />,
    )}
  </div>
);

const textareaView: MaterialView = ({ props, context }) => (
  <div style={{ pointerEvents: isDesign(context) ? 'none' : undefined }}>
    {fieldShell(
      props,
      <Input.TextArea
        rows={Number(props.rows ?? 3)}
        placeholder={str(props.placeholder, '请输入')}
        readOnly={isDesign(context)}
      />,
    )}
  </div>
);

const numberView: MaterialView = ({ props, context }) => (
  <div style={{ pointerEvents: isDesign(context) ? 'none' : undefined }}>
    {fieldShell(
      props,
      <InputNumber
        style={{ width: '100%' }}
        min={props.min as number | undefined}
        max={props.max as number | undefined}
        placeholder={str(props.placeholder, '0')}
        readOnly={isDesign(context)}
      />,
    )}
  </div>
);

const selectView: MaterialView = ({ props, context }) => (
  <div style={{ pointerEvents: isDesign(context) ? 'none' : undefined }}>
    {fieldShell(
      props,
      <Select
        style={{ width: '100%' }}
        placeholder={str(props.placeholder, '请选择')}
        options={normalizeOptions(props.options)}
        // 设计态不弹下拉（避免拖拽时被浮层挡住），运行态必须能选 ——
        // 早前这里写死 open={false}，等于把运行态的交互一起关掉了。
        open={isDesign(context) ? false : undefined}
        mode={props.multiple ? 'multiple' : undefined}
      />,
    )}
  </div>
);

const radioView: MaterialView = ({ props, context }) => (
  <div style={{ pointerEvents: isDesign(context) ? 'none' : undefined }}>
    {fieldShell(
      props,
      <Radio.Group options={normalizeOptions(props.options)} value={props.value as string | undefined} />,
      { inline: true },
    )}
  </div>
);

const checkboxView: MaterialView = ({ props, context }) => (
  <div style={{ pointerEvents: isDesign(context) ? 'none' : undefined }}>
    {fieldShell(
      props,
      <Checkbox.Group options={normalizeOptions(props.options)} value={props.value as string[] | undefined} />,
      { inline: true },
    )}
  </div>
);

const dateView: MaterialView = ({ props, context }) => {
  const control = isDesign(context) ? (
    <Input
      readOnly
      placeholder={str(props.placeholder, '请选择日期')}
      suffix={<CalendarOutlined style={{ color: '#bfbfbf' }} />}
    />
  ) : (
    <DatePicker style={{ width: '100%' }} placeholder={str(props.placeholder, '请选择日期')} />
  );
  return fieldShell(props, control);
};

const switchView: MaterialView = ({ props, context }) => (
  <div className="dn-switch-row" style={{ pointerEvents: isDesign(context) ? 'none' : undefined }}>
    <span className="dn-switch-row__label">{str(props.label, '开关')}</span>
    <Switch size="small" checked={Boolean(props.checked)} />
  </div>
);

const uploadView: MaterialView = ({ props, context }) => (
  <div style={{ pointerEvents: isDesign(context) ? 'none' : undefined }}>
    {fieldShell(
      props,
      <Upload beforeUpload={() => false} showUploadList={false} disabled={isDesign(context)}>
        <Button icon={<CloudUploadOutlined />}>{str(props.text, '点击上传')}</Button>
      </Upload>,
    )}
  </div>
);

const rateView: MaterialView = ({ props }) => (
  <div className="dn-inline-row">
    <span className="dn-inline-row__label">{str(props.label, '评分')}</span>
    <Rate count={Number(props.count ?? 5)} defaultValue={Number(props.value ?? 3)} disabled />
  </div>
);

const sliderView: MaterialView = ({ props }) => (
  <div style={{ padding: '0 4px' }}>
    {fieldShell(props, <Slider defaultValue={Number(props.value ?? 40)} disabled={false} />)}
  </div>
);

const textView: MaterialView = ({ props }) => (
  <div
    style={{
      fontSize: Number(props.fontSize ?? 14),
      color: str(props.color, '#1f2329') || '#1f2329',
      fontWeight: props.bold ? 600 : 400,
      lineHeight: 1.6,
      whiteSpace: 'pre-wrap',
    }}
  >
    {textValue(props) || '文本内容'}
  </div>
);

const titleView: MaterialView = ({ props }) => {
  const level = Number(props.level ?? 3);
  const size = level <= 1 ? 26 : level === 2 ? 22 : level === 3 ? 18 : 16;
  return (
    <div
      style={{
        fontSize: Number(props.fontSize ?? size),
        fontWeight: 600,
        color: str(props.color, '#1f2329') || '#1f2329',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {props.showBar ? <span style={{ width: 3, height: size, background: '#1677ff', borderRadius: 2 }} /> : null}
      {textValue(props) || '标题'}
    </div>
  );
};

const buttonView: MaterialView = ({ props, context, emit }) => {
  const kind = str(props.type, 'default');
  return (
    <div style={{ pointerEvents: isDesign(context) ? 'none' : undefined }}>
      <Button
        type={kind === 'primary' ? 'primary' : kind === 'dashed' ? 'dashed' : kind === 'text' ? 'text' : 'default'}
        danger={kind === 'danger'}
        block={Boolean(props.block)}
        onClick={() => emit?.('onClick')}
      >
        {textValue(props) || '按钮'}
      </Button>
    </div>
  );
};

const imageView: MaterialView = ({ props }) => (
  <img
    src={str(props.src, '') || 'https://placehold.co/480x180/f2f4f7/9aa4b2?text=image'}
    alt={str(props.alt, '图片')}
    style={{
      width: '100%',
      borderRadius: Number(props.radius ?? 6),
      height: Number(props.height ?? 160),
      objectFit: str(props.fit, 'cover') as 'cover',
      display: 'block',
    }}
  />
);

// 不用 Divider 的 orientation：antd 5 叫 'left'、antd 6 叫 'start'，跨版本会撞类型
const dividerView: MaterialView = ({ props }) => (
  <Divider style={{ margin: '4px 0' }}>{textValue(props)}</Divider>
);

// 同理不用 antd Alert：`message` 在 antd6 改成 `title`，跨版本会一直告警。
const ALERT_TONES: Record<string, { bg: string; border: string; color: string; icon: string }> = {
  info: { bg: '#e6f4ff', border: '#91caff', color: '#0958d9', icon: 'i' },
  success: { bg: '#f6ffed', border: '#b7eb8f', color: '#389e0d', icon: '✓' },
  warning: { bg: '#fffbe6', border: '#ffe58f', color: '#d48806', icon: '!' },
  error: { bg: '#fff2f0', border: '#ffccc7', color: '#cf1322', icon: '×' },
};

const DEFAULT_TONE = { bg: '#e6f4ff', border: '#91caff', color: '#0958d9', icon: 'i' };

const alertView: MaterialView = ({ props }) => {
  const tone = ALERT_TONES[str(props.type, 'info')] ?? DEFAULT_TONE;
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        borderRadius: 6,
        padding: '10px 12px',
      }}
    >
      <span
        style={{
          flex: 'none',
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: tone.color,
          color: '#fff',
          fontSize: 12,
          lineHeight: '18px',
          textAlign: 'center',
        }}
      >
        {tone.icon}
      </span>
      <div>
        <div style={{ color: tone.color, fontWeight: 600 }}>{textValue(props, 'title') || '提示信息'}</div>
        {props.description ? (
          <div style={{ color: 'rgba(0,0,0,0.65)', fontSize: 13, marginTop: 2 }}>{String(props.description)}</div>
        ) : null}
      </div>
    </div>
  );
};

const tagView: MaterialView = ({ props }) => (
  <div>
    <Tag color={str(props.color, 'blue')}>{textValue(props) || '标签'}</Tag>
  </div>
);

const progressView: MaterialView = ({ props }) => (
  <Progress percent={Number(props.percent ?? 60)} status="normal" />
);

// 不用 antd 的 Statistic：antd5 的 valueStyle 在 antd6 已弃用（换 styles.content），
// 跨版本只为一个字号不值得，直接自己排版，设计态/运行态长得完全一样。
const statisticView: MaterialView = ({ props }) => (
  <div className="dn-stat">
    <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 13, marginBottom: 4 }}>
      {textValue(props, 'title') || '指标'}
    </div>
    <div style={{ fontSize: Number(props.fontSize ?? 24), fontWeight: 600, lineHeight: 1.3 }}>
      {props.prefix ? <span style={{ fontSize: 16, marginRight: 4 }}>{String(props.prefix)}</span> : null}
      {Number(props.value ?? 1288)}
      {props.suffix ? <span style={{ fontSize: 16, marginLeft: 4 }}>{String(props.suffix)}</span> : null}
    </div>
  </div>
);

const tableView: MaterialView = ({ props }) => {
  const columns = normalizeOptions(props.columns).map((c) => ({ title: c.label, dataIndex: c.value, key: c.value }));
  const safeColumns = columns.length
    ? columns
    : [
        { title: '名称', dataIndex: 'name', key: 'name' },
        { title: '状态', dataIndex: 'status', key: 'status' },
      ];
  // 有 data 就用真数据（列 key 与 data 的字段名对齐）；没有才退回合成行，
  // 这样「设计器里配了 columns + data」在运行态就是一张能看的表，不必等接口接进来。
  const rows = Array.isArray(props.data) ? (props.data as Array<Record<string, unknown>>) : [];
  const dataSource = rows.length
    ? rows.map((row, i) => ({ key: `r-${i}`, ...row }))
    : Array.from({ length: Number(props.rows ?? 3) }).map((_, i) => ({
        key: `r-${i}`,
        name: `数据 ${i + 1}`,
        status: i % 2 === 0 ? '启用' : '停用',
      }));
  return (
    <Table
      size="small"
      bordered
      pagination={false}
      columns={safeColumns}
      dataSource={dataSource}
      scroll={{ x: 'max-content' }}
    />
  );
};

/** 通用属性面板字段（所有物料共享「样式」段） */
const commonStyleFields = (): EditField[] => [
  { field: 'margin', label: '外边距', type: 'number', group: STYLE_GROUP, setter: 'number' },
  { field: 'padding', label: '内边距', type: 'number', group: STYLE_GROUP, setter: 'number' },
  { field: 'background', label: '背景色', type: 'custom', group: STYLE_GROUP, setter: 'color' },
  { field: 'radius', label: '圆角', type: 'number', group: STYLE_GROUP, setter: 'number' },
  { field: 'width', label: '宽度', type: 'custom', group: STYLE_GROUP, setter: 'size' },
];

const fieldFields = (withPlaceholder = true): EditField[] => [
  { field: 'label', label: '标题', type: 'string', group: FIELD_GROUP },
  { field: 'name', label: '字段名', type: 'string', group: FIELD_GROUP },
  ...(withPlaceholder
    ? [{ field: 'placeholder', label: '占位提示', type: 'string', group: FIELD_GROUP } as EditField]
    : []),
  { field: 'defaultValue', label: '默认值', type: 'string', group: FIELD_GROUP },
  { field: 'required', label: '必填', type: 'boolean', group: RULE_GROUP, defaultValue: false },
  { field: 'disabled', label: '禁用', type: 'boolean', group: RULE_GROUP, defaultValue: false },
];

function mat(
  config: MaterialConfig,
  view: MaterialView,
  icon: ReactNode,
  extra: { canHaveChildren?: boolean; order?: number } = {},
): HostMaterial {
  return { config, view, icon, ...extra };
}

const OPTION_FIELD: EditField = {
  field: 'options',
  label: '选项',
  type: 'custom',
  setter: 'options',
  group: FIELD_GROUP,
};

function optionDefaults(): Array<{ label: string; value: string }> {
  return [
    { label: '选项一', value: 'a' },
    { label: '选项二', value: 'b' },
  ];
}

export const HOST_MATERIALS: HostMaterial[] = [
  // ===== 布局容器 =====
  mat(
    {
      type: 'container',
      title: '容器',
      group: 'layout',
      editConfig: [
        { field: 'direction', label: '排列方向', type: 'select', group: FIELD_GROUP, props: { options: ['column', 'row'] } },
        { field: 'gap', label: '间距', type: 'number', group: FIELD_GROUP },
        { field: 'bordered', label: '显示边框', type: 'boolean', group: FIELD_GROUP, defaultValue: true },
        ...commonStyleFields(),
      ],
      defaultProps: { direction: 'column', gap: 12, padding: 16, bordered: true },
    },
    containerView,
    <BorderOutlined />,
    { canHaveChildren: true, order: 1 },
  ),
  mat(
    {
      type: 'card',
      title: '卡片',
      group: 'layout',
      editConfig: [
        { field: 'title', label: '标题', type: 'string', group: FIELD_GROUP },
        { field: 'extraText', label: '右上角文本', type: 'string', group: FIELD_GROUP },
        ...commonStyleFields(),
      ],
      defaultProps: { title: '卡片标题' },
    },
    cardView,
    <AppstoreOutlined />,
    { canHaveChildren: true, order: 2 },
  ),
  mat(
    {
      type: 'grid',
      title: '栅格',
      group: 'layout',
      editConfig: [
        { field: 'columns', label: '列数', type: 'number', group: FIELD_GROUP, defaultValue: 2 },
        { field: 'gap', label: '间距', type: 'number', group: FIELD_GROUP, defaultValue: 12 },
        ...commonStyleFields(),
      ],
      defaultProps: { columns: 2, gap: 12 },
    },
    gridView,
    <ColumnWidthOutlined />,
    { canHaveChildren: true, order: 3 },
  ),
  mat(
    {
      type: 'formContainer',
      title: '表单容器',
      group: 'layout',
      editConfig: [
        { field: 'title', label: '表单标题', type: 'string', group: FIELD_GROUP },
        { field: 'gap', label: '行间距', type: 'number', group: FIELD_GROUP },
        ...commonStyleFields(),
      ],
      defaultProps: { title: '表单', gap: 14 },
      variableList: [{ name: 'formData', description: '表单数据' }],
    },
    formView,
    <FormOutlined />,
    { canHaveChildren: true, order: 4 },
  ),

  // ===== 表单控件 =====
  mat(
    {
      type: 'input',
      title: '输入框',
      group: 'form',
      isAtomic: true,
      editConfig: [...fieldFields(), ...commonStyleFields()],
      defaultProps: { label: '输入框', placeholder: '请输入' },
      eventList: [{ name: 'onChange', description: '值变化' }],
    },
    inputView,
    <FileTextOutlined />,
    { order: 10 },
  ),
  mat(
    {
      type: 'textarea',
      title: '多行文本',
      group: 'form',
      isAtomic: true,
      editConfig: [
        ...fieldFields(),
        { field: 'rows', label: '行数', type: 'number', group: FIELD_GROUP, defaultValue: 3 },
        ...commonStyleFields(),
      ],
      defaultProps: { label: '备注', placeholder: '请输入', rows: 3 },
    },
    textareaView,
    <AlignLeftOutlined />,
    { order: 11 },
  ),
  mat(
    {
      type: 'number',
      title: '数字输入',
      group: 'form',
      isAtomic: true,
      editConfig: [
        ...fieldFields(),
        { field: 'min', label: '最小值', type: 'number', group: RULE_GROUP },
        { field: 'max', label: '最大值', type: 'number', group: RULE_GROUP },
        ...commonStyleFields(),
      ],
      defaultProps: { label: '数量', placeholder: '0' },
    },
    numberView,
    <NumberOutlined />,
    { order: 12 },
  ),
  mat(
    {
      type: 'select',
      title: '下拉选择',
      group: 'form',
      isAtomic: true,
      editConfig: [...fieldFields(false), OPTION_FIELD, ...commonStyleFields()],
      defaultProps: { label: '类型', placeholder: '请选择', options: optionDefaults() },
    },
    selectView,
    <UnorderedListOutlined />,
    { order: 13 },
  ),
  mat(
    {
      type: 'radio',
      title: '单选框',
      group: 'form',
      isAtomic: true,
      editConfig: [...fieldFields(false), OPTION_FIELD, ...commonStyleFields()],
      defaultProps: { label: '状态', options: optionDefaults() },
    },
    radioView,
    <CheckSquareOutlined />,
    { order: 14 },
  ),
  mat(
    {
      type: 'checkbox',
      title: '多选框',
      group: 'form',
      isAtomic: true,
      editConfig: [...fieldFields(false), OPTION_FIELD, ...commonStyleFields()],
      defaultProps: { label: '标签', options: optionDefaults() },
    },
    checkboxView,
    <MinusSquareOutlined />,
    { order: 15 },
  ),
  mat(
    {
      type: 'date',
      title: '日期',
      group: 'form',
      isAtomic: true,
      editConfig: [
        ...fieldFields(),
        {
          field: 'format',
          label: '格式',
          type: 'custom',
          setter: 'dateFormat',
          group: FIELD_GROUP,
          defaultValue: 'YYYY-MM-DD',
        },
        ...commonStyleFields(),
      ],
      defaultProps: { label: '日期', placeholder: '请选择日期', format: 'YYYY-MM-DD' },
    },
    dateView,
    <CalendarOutlined />,
    { order: 16 },
  ),
  mat(
    {
      type: 'switch',
      title: '开关',
      group: 'form',
      isAtomic: true,
      editConfig: [...fieldFields(false), ...commonStyleFields()],
      defaultProps: { label: '是否启用' },
    },
    switchView,
    <SwapOutlined />,
    { order: 17 },
  ),
  mat(
    {
      type: 'upload',
      title: '上传',
      group: 'form',
      isAtomic: true,
      editConfig: [
        ...fieldFields(false),
        { field: 'accept', label: '接受类型', type: 'string', group: RULE_GROUP },
        ...commonStyleFields(),
      ],
      defaultProps: { label: '附件', text: '点击上传' },
    },
    uploadView,
    <CloudUploadOutlined />,
    { order: 18 },
  ),
  mat(
    {
      type: 'rate',
      title: '评分',
      group: 'form',
      isAtomic: true,
      editConfig: [
        { field: 'label', label: '标题', type: 'string', group: FIELD_GROUP },
        { field: 'count', label: '星数', type: 'number', group: FIELD_GROUP, defaultValue: 5 },
        ...commonStyleFields(),
      ],
      defaultProps: { label: '评分', count: 5 },
    },
    rateView,
    <StarOutlined />,
    { order: 19 },
  ),
  mat(
    {
      type: 'slider',
      title: '滑块',
      group: 'form',
      isAtomic: true,
      editConfig: [{ field: 'label', label: '标题', type: 'string', group: FIELD_GROUP }, ...commonStyleFields()],
      defaultProps: { label: '进度' },
    },
    sliderView,
    <SlidersOutlined />,
    { order: 20 },
  ),

  // ===== 展示 =====
  mat(
    {
      type: 'text',
      title: '文本',
      group: 'display',
      isAtomic: true,
      editConfig: [
        { field: 'text', label: '内容', type: 'custom', setter: 'textarea', group: FIELD_GROUP },
        { field: 'fontSize', label: '字号', type: 'number', group: FIELD_GROUP, defaultValue: 14 },
        { field: 'color', label: '颜色', type: 'custom', setter: 'color', group: FIELD_GROUP },
        { field: 'bold', label: '加粗', type: 'boolean', group: FIELD_GROUP },
        ...commonStyleFields(),
      ],
      defaultProps: { text: '这是一段说明文本，可绑定变量 ${formData.name}', fontSize: 14 },
    },
    textView,
    <FontSizeOutlined />,
    { order: 30 },
  ),
  mat(
    {
      type: 'title',
      title: '标题',
      group: 'display',
      isAtomic: true,
      editConfig: [
        { field: 'text', label: '内容', type: 'string', group: FIELD_GROUP },
        {
          field: 'level',
          label: '级别',
          type: 'select',
          group: FIELD_GROUP,
          props: { options: ['1', '2', '3', '4'] },
          defaultValue: '3',
        },
        { field: 'showBar', label: '左侧色条', type: 'boolean', group: FIELD_GROUP },
        ...commonStyleFields(),
      ],
      defaultProps: { text: '区块标题', level: 3, showBar: true },
    },
    titleView,
    <HolderOutlined />,
    { order: 31 },
  ),
  mat(
    {
      type: 'button',
      title: '按钮',
      group: 'display',
      isAtomic: true,
      editConfig: [
        { field: 'text', label: '文案', type: 'string', group: FIELD_GROUP },
        {
          field: 'type',
          label: '类型',
          type: 'select',
          group: FIELD_GROUP,
          props: { options: ['default', 'primary', 'dashed', 'text', 'danger'] },
          defaultValue: 'default',
        },
        { field: 'block', label: '撑满宽度', type: 'boolean', group: FIELD_GROUP },
        { field: 'link', label: '跳转页面编码', type: 'string', group: FIELD_GROUP },
        ...commonStyleFields(),
      ],
      // link: 运行态点击后跳到本应用的另一个页面（值是 pageCode），
      // 宿主的运行态容器负责把它翻译成路由 —— 物料自己不认识路由。
      defaultProps: { text: '提交', type: 'primary' },
      eventList: [{ name: 'onClick', description: '点击时触发' }],
    },
    buttonView,
    <PlaySquareOutlined />,
    { order: 32 },
  ),
  mat(
    {
      type: 'image',
      title: '图片',
      group: 'display',
      isAtomic: true,
      editConfig: [
        { field: 'src', label: '图片地址', type: 'string', group: FIELD_GROUP },
        { field: 'alt', label: '替代文本', type: 'string', group: FIELD_GROUP },
        { field: 'height', label: '高度', type: 'number', group: FIELD_GROUP, defaultValue: 160 },
        { field: 'radius', label: '圆角', type: 'number', group: STYLE_GROUP },
      ],
      defaultProps: {},
    },
    imageView,
    <PictureOutlined />,
    { order: 33 },
  ),
  mat(
    {
      type: 'divider',
      title: '分割线',
      group: 'display',
      isAtomic: true,
      editConfig: [{ field: 'text', label: '文本', type: 'string', group: FIELD_GROUP }, ...commonStyleFields()],
      defaultProps: {},
    },
    dividerView,
    <LineOutlined />,
    { order: 34 },
  ),
  mat(
    {
      type: 'tag',
      title: '标签',
      group: 'display',
      isAtomic: true,
      editConfig: [
        { field: 'text', label: '文案', type: 'string', group: FIELD_GROUP },
        {
          field: 'color',
          label: '颜色',
          type: 'select',
          group: FIELD_GROUP,
          props: { options: ['blue', 'green', 'orange', 'red', 'purple', 'default'] },
          defaultValue: 'blue',
        },
        ...commonStyleFields(),
      ],
      defaultProps: { text: '标签', color: 'blue' },
    },
    tagView,
    <TagOutlined />,
    { order: 35 },
  ),
  mat(
    {
      type: 'alert',
      title: '提示',
      group: 'display',
      isAtomic: true,
      editConfig: [
        { field: 'title', label: '标题', type: 'string', group: FIELD_GROUP },
        { field: 'description', label: '描述', type: 'custom', setter: 'textarea', group: FIELD_GROUP },
        {
          field: 'type',
          label: '类型',
          type: 'select',
          group: FIELD_GROUP,
          props: { options: ['info', 'success', 'warning', 'error'] },
          defaultValue: 'info',
        },
        ...commonStyleFields(),
      ],
      defaultProps: { title: '提示信息', type: 'info' },
    },
    alertView,
    <InfoCircleOutlined />,
    { order: 36 },
  ),
  mat(
    {
      type: 'progress',
      title: '进度条',
      group: 'data',
      isAtomic: true,
      editConfig: [
        { field: 'percent', label: '百分比', type: 'number', group: FIELD_GROUP, defaultValue: 60 },
        ...commonStyleFields(),
      ],
      defaultProps: { percent: 60 },
    },
    progressView,
    <BarChartOutlined />,
    { order: 40 },
  ),
  mat(
    {
      type: 'statistic',
      title: '指标卡',
      group: 'data',
      isAtomic: true,
      editConfig: [
        { field: 'title', label: '标题', type: 'string', group: FIELD_GROUP },
        { field: 'value', label: '数值', type: 'number', group: FIELD_GROUP },
        { field: 'prefix', label: '前缀', type: 'string', group: FIELD_GROUP },
        { field: 'suffix', label: '后缀', type: 'string', group: FIELD_GROUP },
        ...commonStyleFields(),
      ],
      defaultProps: { title: '本月订单', value: 1288, suffix: '单' },
    },
    statisticView,
    <BarChartOutlined />,
    { order: 41 },
  ),
  mat(
    {
      type: 'table',
      title: '表格',
      group: 'data',
      isAtomic: true,
      editConfig: [
        { field: 'rows', label: '演示行数', type: 'number', group: FIELD_GROUP, defaultValue: 3 },
        { field: 'columns', label: '列', type: 'custom', setter: 'options', group: FIELD_GROUP },
        { field: 'data', label: '数据（JSON 数组）', type: 'custom', setter: 'json', group: FIELD_GROUP },
        ...commonStyleFields(),
      ],
      defaultProps: { rows: 3 },
    },
    tableView,
    <TableOutlined />,
    { order: 42 },
  ),
];

export const MATERIAL_MAP = new Map<string, HostMaterial>(HOST_MATERIALS.map((m) => [m.config.type, m]));

export const GROUP_META: Record<MaterialGroup, { title: string; hint: string }> = {
  layout: { title: '布局容器', hint: '可容纳子节点' },
  form: { title: '表单控件', hint: '数据录入' },
  display: { title: '展示元素', hint: '静态内容' },
  data: { title: '数据展示', hint: '指标与列表' },
};

export function materialTitle(type: string): string {
  return MATERIAL_MAP.get(type)?.config.title ?? type;
}

export function materialIcon(type: string): ReactNode {
  return MATERIAL_MAP.get(type)?.icon ?? <BorderOutlined />;
}

export function materialAcceptsChildren(type: string): boolean {
  return MATERIAL_MAP.get(type)?.canHaveChildren === true;
}

export function materialDefaults(type: string): Record<string, unknown> {
  return { ...(MATERIAL_MAP.get(type)?.config.defaultProps ?? {}) };
}

/** 设计器 store 用的默认属性注入点（避免 store 直接依赖 UI 层细节） */
export const DEFAULT_PROPS_RESOLVER = materialDefaults;
