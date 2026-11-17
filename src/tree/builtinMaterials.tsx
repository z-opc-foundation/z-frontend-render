import type { MaterialDefinition, EditField } from './material'

/**
 * 具名物料库（12 个高频物料，去品牌化纯自研）。
 *
 * 全部用原生 HTML 元素实现 view，不引入 antd/图标库 —— 保持运行时轻量，
 * 宿主可用 register 覆盖任意 type 换成自己的 UI 实现。
 * 每个物料声明 editConfig（声明式属性面板）与事件/变量，设计态可直接消费。
 */

const html = (tag: string) => ({ props, children }: { props: Record<string, unknown>; children?: React.ReactNode }) => {
  const { text, value, placeholder, ...rest } = props
  const safeProps: Record<string, unknown> = {}
  Object.entries(rest).forEach(([k, v]) => {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') safeProps[k] = v
  })
  return (
    <div data-material={tag} {...safeProps}>
      {text != null ? String(text) : value != null ? String(value) : placeholder != null ? String(placeholder) : null}
      {children}
    </div>
  )
}

function def(
  type: string,
  title: string,
  group: string,
  view: MaterialDefinition['view'],
  editConfig: EditField[],
  extra: Partial<MaterialDefinition['config']> = {},
): MaterialDefinition {
  return {
    config: { type, title, group, editConfig, ...extra },
    view,
  }
}

/** 字段通用 editConfig 片段 */
const fieldEdit = (): EditField[] => [
  { field: 'name', label: '字段名', type: 'string' },
  { field: 'label', label: '标题', type: 'string' },
  { field: 'placeholder', label: '占位提示', type: 'string' },
  { field: 'required', label: '必填', type: 'boolean', defaultValue: false },
]

export const BUILTIN_MATERIALS: MaterialDefinition[] = [
  // ===== 原子输入类 =====
  def('input', '输入框', 'atom', html('input'), fieldEdit(), { isAtomic: true }),
  def('textarea', '多行文本', 'atom', html('textarea'), fieldEdit(), { isAtomic: true }),
  def('number', '数字输入', 'atom', html('input'), [
    ...fieldEdit(), { field: 'min', label: '最小值', type: 'number' }, { field: 'max', label: '最大值', type: 'number' },
  ], { isAtomic: true }),
  def('select', '下拉选择', 'atom', html('select'), [
    ...fieldEdit(), { field: 'options', label: '选项', type: 'custom', setter: 'options' },
  ], { isAtomic: true }),
  def('radio', '单选', 'atom', html('radio'), [
    ...fieldEdit(), { field: 'options', label: '选项', type: 'custom', setter: 'options' },
  ], { isAtomic: true }),
  def('checkbox', '复选', 'atom', html('checkbox'), [
    ...fieldEdit(), { field: 'options', label: '选项', type: 'custom', setter: 'options' },
  ], { isAtomic: true }),
  def('date', '日期选择', 'atom', html('date'), [
    ...fieldEdit(), { field: 'format', label: '格式', type: 'custom', setter: 'dateFormat', defaultValue: 'YYYY-MM-DD' },
  ], { isAtomic: true }),
  def('switch', '开关', 'atom', html('switch'), fieldEdit(), { isAtomic: true }),
  def('upload', '上传', 'atom', html('upload'), [
    ...fieldEdit(), { field: 'accept', label: '接受类型', type: 'string' },
  ], { isAtomic: true }),

  // ===== 展示类 =====
  def('text', '文本', 'display', ({ props }) => <span>{String(props.value ?? props.text ?? '')}</span>, [
    { field: 'text', label: '内容', type: 'string' },
  ], { isAtomic: true }),
  def('button', '按钮', 'display', ({ props, emit }) => (
    <button type="button" onClick={() => emit?.('onClick')}>{String(props.text ?? '按钮')}</button>
  ), [
    { field: 'text', label: '文案', type: 'string' },
    { field: 'type', label: '类型', type: 'select', props: { options: ['primary', 'default', 'danger'] } },
  ], { isAtomic: true, eventList: [{ name: 'onClick', description: '点击时触发' }] }),

  // ===== 容器类 =====
  def('container', '容器', 'container', html('div'), [
    { field: 'padding', label: '内边距', type: 'number' },
    { field: 'background', label: '背景色', type: 'custom', setter: 'color' },
  ]),
  def('formContainer', '表单容器', 'container', html('form'), [
    { field: 'layout', label: '布局', type: 'select', props: { options: ['vertical', 'horizontal'] } },
    { field: 'labelWidth', label: '标签宽度', type: 'number' },
  ], { variableList: [{ name: 'formData', description: '表单数据' }] }),
]

/** 取指定物料定义 */
export function getBuiltinMaterial(type: string): MaterialDefinition | undefined {
  return BUILTIN_MATERIALS.find((m) => m.config.type === type)
}
