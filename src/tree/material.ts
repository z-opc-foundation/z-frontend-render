import type { ReactNode } from 'react'

/**
 * 物料协议 (对应参考引擎 ModuleConfig): 一个物料 = view 渲染面 + 完整元数据 + 属性面板声明。
 *
 * 与 fields 注册表不同: fields 只解决"字段类型 → 编辑器/单元格"的映射 (读写的 7 个面);
 * material 解决"组件 → 渲染 + 属性面板 + 事件/变量/方法声明 + API 匹配"的完整搭建协议。
 */
export interface MaterialConfig {
  /** 物料类型 key, 与 schema node.type 对应 */
  type: string
  /** 显示名 */
  title?: string
  /** 是否原子物料(不可再拆) */
  isAtomic?: boolean
  /** 分组: atom / container / business */
  group?: string
  /** 默认属性 */
  defaultProps?: Record<string, unknown>
  /** 可配置变量声明 */
  variableList?: NamedDeclaration[]
  /** 可触发事件声明 */
  eventList?: NamedDeclaration[]
  /** 对外暴露方法声明 */
  contextMethods?: NamedDeclaration[]
  /** 组件抛给上下文的变量 */
  contextVariables?: NamedDeclaration[]
  /** 接口→物料匹配依据 (接口驱动搭建) */
  matchInfo?: { weight: number; match: (apiSchema: unknown) => boolean }
  /** 声明式属性面板配置 */
  editConfig?: EditField[]
  /** 物料图标 / 文档等扩展信息 */
  meta?: Record<string, unknown>
}

export interface NamedDeclaration {
  name: string
  description?: string
  params?: Array<Record<string, unknown>>
}

/**
 * 声明式属性面板字段: 描述右侧面板如何渲染与联动。
 * CustomCom 由宿主传入 setter 组件 (值→onChange), 与 antd 解耦。
 */
export interface EditField {
  field: string
  label?: string
  group?: string
  type?: 'string' | 'number' | 'boolean' | 'select' | 'custom'
  props?: Record<string, unknown>
  /** 自定义 setter 标识, 由宿主的 setter 注册表解析 */
  setter?: string
  /** 联动显隐: 当前字段值 → 需要隐藏的字段列表 */
  linkageHide?: Record<string, string[]>
  defaultValue?: unknown
}

/** 物料实现: view 渲染函数 */
export type MaterialView = (props: {
  props: Record<string, unknown>
  nodeId: string
  children?: ReactNode
  slots?: Record<string, ReactNode>
  context: Record<string, unknown>
  emit?: (event: string, payload?: unknown) => void
}) => ReactNode | null

export interface MaterialDefinition {
  view: MaterialView
  config: MaterialConfig
}

/** 物料注册表: 支持覆盖默认物料 */
export class MaterialRegistry {
  private readonly materials = new Map<string, MaterialDefinition>()

  register(def: MaterialDefinition): this {
    this.materials.set(def.config.type, def)
    return this
  }

  get(type: string): MaterialDefinition | undefined {
    return this.materials.get(type)
  }

  has(type: string): boolean {
    return this.materials.has(type)
  }

  list(): MaterialConfig[] {
    return Array.from(this.materials.values()).map((m) => m.config)
  }

  /** 按接口 schema 匹配最合适的物料 (weight 高者优先) */
  match(apiSchema: unknown): MaterialConfig | undefined {
    let best: MaterialConfig | undefined
    let bestWeight = -1
    for (const def of this.materials.values()) {
      const info = def.config.matchInfo
      if (info?.match(apiSchema) && info.weight > bestWeight) {
        best = def.config
        bestWeight = info.weight
      }
    }
    return best
  }
}

/** 创建带内置物料的注册表 */
export function createMaterialRegistry(defs: MaterialDefinition[] = []): MaterialRegistry {
  const reg = new MaterialRegistry()
  defs.forEach((d) => reg.register(d))
  return reg
}
