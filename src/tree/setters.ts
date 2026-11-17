import type { ReactNode } from 'react'

/**
 * Setter 体系：属性面板的最小可复用编辑单元。
 *
 * 与参考引擎 setter 对齐但完全去品牌化：每个 setter 是 {value, onChange} 的纯受控组件，
 * 不依赖任何 UI 库；宿主用自己的组件实现（antd/自研皆可）后注册进来。
 * editConfig.type / editConfig.setter 决定用哪个 setter。
 */
export interface SetterProps<T = unknown> {
  value?: T
  onChange: (value: T) => void
  /** 来自 editConfig.props 的附加配置（如 options/ min/max） */
  config?: Record<string, unknown>
  disabled?: boolean
}

export type SetterComponent<T = unknown> = (props: SetterProps<T>) => ReactNode

export interface SetterDef {
  name: string
  label?: string
  component: SetterComponent<never>
  /** 默认值工厂，新增字段时自动填 */
  defaultValue?: () => unknown
}

/** setter 注册表：支持覆盖 */
export class SetterRegistry {
  private readonly setters = new Map<string, SetterDef>()

  register(def: SetterDef): this {
    this.setters.set(def.name, def)
    return this
  }

  get(name: string): SetterDef | undefined {
    return this.setters.get(name)
  }

  has(name: string): boolean {
    return this.setters.has(name)
  }

  list(): string[] {
    return Array.from(this.setters.keys())
  }
}

/** 核心 setter 名称常量（宿主按名提供组件实现） */
export const CORE_SETTERS = [
  'string',      // 单行文本
  'text',        // 多行文本
  'number',      // 数字
  'boolean',     // 开关
  'select',      // 下拉单选
  'multiSelect', // 多选
  'options',     // 选项列表（label/value 数组）
  'rules',       // 校验规则列表
  'color',       // 颜色
  'size',        // 尺寸（宽高）
  'materialPicker', // 物料选择器
  'function',    // 函数/表达式编辑器
  'icon',        // 图标选择
  'dateFormat',  // 日期格式
] as const

export type CoreSetterName = typeof CORE_SETTERS[number]

/**
 * 内置 setter 的「行为层」——不渲染 UI，只提供值变换与默认值，
 * 让宿主能快速把任意组件接成 setter（真正渲染交给宿主的 component）。
 * 这些纯函数可独立测试，也是 setters 规模化复用的关键。
 */
export const setterBehaviors: Record<CoreSetterName, {
  defaultValue: () => unknown
  normalize: (value: unknown, config?: Record<string, unknown>) => unknown
  validate?: (value: unknown) => boolean
}> = {
  string: { defaultValue: () => '', normalize: (v) => v == null ? '' : String(v) },
  text: { defaultValue: () => '', normalize: (v) => v == null ? '' : String(v) },
  number: {
    defaultValue: () => 0,
    normalize: (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 },
    validate: (v) => typeof v === 'number' && Number.isFinite(v),
  },
  boolean: { defaultValue: () => false, normalize: (v) => Boolean(v), validate: (v) => typeof v === 'boolean' },
  select: { defaultValue: () => undefined, normalize: (v) => v },
  multiSelect: { defaultValue: () => [], normalize: (v) => Array.isArray(v) ? v : [] },
  options: {
    defaultValue: () => [],
    normalize: (v) => Array.isArray(v)
      ? v.map((o, i) => ({ label: (o as { label?: unknown })?.label ?? `选项${i + 1}`, value: (o as { value?: unknown })?.value ?? `opt_${i}` }))
      : [],
    validate: (v) => Array.isArray(v),
  },
  rules: { defaultValue: () => [], normalize: (v) => Array.isArray(v) ? v : [] },
  color: {
    defaultValue: () => '#1677ff',
    normalize: (v) => typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : '#1677ff',
  },
  size: {
    defaultValue: () => ({ width: 'auto', height: 'auto' }),
    normalize: (v) => v && typeof v === 'object' ? v as Record<string, unknown> : { width: 'auto', height: 'auto' },
  },
  materialPicker: { defaultValue: () => undefined, normalize: (v) => v },
  function: { defaultValue: () => '', normalize: (v) => v == null ? '' : String(v) },
  icon: { defaultValue: () => undefined, normalize: (v) => v },
  dateFormat: {
    defaultValue: () => 'YYYY-MM-DD',
    normalize: (v) => typeof v === 'string' && v ? v : 'YYYY-MM-DD',
  },
}

/** 创建预置全部核心 setter 默认行为的注册表（component 由宿主补充） */
export function createCoreSetterRegistry(): SetterRegistry {
  const reg = new SetterRegistry()
  CORE_SETTERS.forEach((name) => {
    reg.register({
      name,
      label: name,
      component: (() => null) as SetterComponent<never>,
      defaultValue: setterBehaviors[name].defaultValue,
    })
  })
  return reg
}
