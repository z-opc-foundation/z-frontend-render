/**
 * 统一页面 Schema 契约 (TypeScript 侧镜像): 与 z-lc-schema 的 Java 类逐字段对齐。
 *
 * 只有一个模型：elements 扁平节点表 + layout.structure 树。
 * 报表域历史上的 `{widgets:[...], layout:[{widgetId,x,y,w,h}]}` **不是另一种 schema**，
 * 而是同一模型的扁平淡法 —— 每个 widget 就是「带 rect 的节点」，读入时由后端
 * WidgetSchemaAdapter 折成标准形态；前端只认标准形态。
 *
 * 单一事实源在 Java (PageSchema / SchemaNode / NodeStructure), 本文件只声明形状, 不做校验。
 */

/** 节点在绝对定位布局里的栅格单元 */
export interface NodeRect {
  x?: number
  y?: number
  w?: number
  h?: number
}

/** 扁平节点: id → SchemaNode */
export interface SchemaNode {
  type: string
  props?: Record<string, unknown>
  /** 有 rect 表示按栅格绝对定位；无值表示参与流式排版 */
  rect?: NodeRect
}

/** 一个容器节点在树中的结构: 普通子节点 + 具名插槽 */
export interface NodeStructure {
  children?: string[]
  namedSlots?: Record<string, string[]>
}

export interface PageLayout {
  root?: string
  structure?: Record<string, NodeStructure>
  /** flow(默认) / absolute */
  mode?: 'flow' | 'absolute'
}

/** 执行态逻辑边: 条件语义编码在边上 */
export interface NextEdge {
  address: string
  conditionType?: 'expression' | 'ifLine' | 'hyperValue'
  condition?: string
}

export interface FlowNodeExecute {
  type?: 'logic' | 'flow'
  logicType?: string
  targetId?: string
  props?: Record<string, unknown>
}

export interface FlowNode {
  execute?: FlowNodeExecute
  next?: NextEdge[]
  pre?: string[]
}

export interface LogicFlow {
  id?: string
  headAddress?: string
  flowNodeMap?: Record<string, FlowNode>
}

export interface LogicDef {
  flowBinds?: Record<string, string[]>
  flows?: Record<string, LogicFlow>
}

export interface Declaration {
  name: string
  description?: string
  params?: Array<Record<string, unknown>>
}

export interface SchemaContext {
  variableList?: Declaration[]
  eventList?: Declaration[]
  contextMethods?: Declaration[]
  extensions?: Record<string, unknown>
  global?: Record<string, unknown>
}

/** 统一页面 Schema —— 设计器/渲染器/逻辑引擎的唯一契约 */
export interface PageSchema {
  version?: string
  id?: string
  elements?: Record<string, SchemaNode>
  layout?: PageLayout
  /** 数据绑定声明: dataset id → 取数描述（页面自带，跨重启可渲染） */
  datasets?: Record<string, unknown>
  imports?: Array<{
    name?: string
    version?: string
    packageName?: string
    type?: 'component' | 'schema'
    async?: boolean
  }>
  context?: SchemaContext
  logic?: LogicDef
  meta?: Record<string, unknown>
}
