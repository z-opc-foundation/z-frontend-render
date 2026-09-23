/**
 * 渲染契约 (TypeScript 侧镜像): 与 z-report-common `schema` 包逐字段对齐。
 *
 * 单一事实源在后端 Java (ViewSchema / WidgetSpec / WidgetLayout / ...), 本文件只做形状声明,
 * 不做校验 —— 校验由后端产出时保证。字段名 / 枚举值必须与 Java 完全一致,
 * 改 Java 契约要同步改这里, 否则渲染分发会静默落到兜底分支。
 */

/** RAW: 数据是对象整形语言产出的任意结构, 无约定形状 */
export type ChartType = 'LINE' | 'BAR' | 'PIE' | 'TABLE' | 'KPI' | 'RAW'
export type AggType = 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX'
export type FieldType = 'STRING' | 'INT' | 'DOUBLE' | 'BOOL' | 'DATE'
export type FieldRole = 'DIMENSION' | 'MEASURE'
export type FilterOp = 'EQ' | 'NE' | 'GT' | 'GE' | 'LT' | 'LE' | 'IN' | 'LIKE'
export type JoinType = 'INNER' | 'LEFT'
export type DataSourceType = 'MEMORY' | 'JDBC' | 'CSV' | 'HTTP' | 'SQL'

/** 视图页内组件的网格布局: 12 栅格, x/w 为栅格数, y/h 为行高单位 (见 layout/grid.ts) */
export interface WidgetLayout {
  widgetId: string
  /** 栅格列起点 0-11 */
  x: number
  /** 栅格行起点 0.. */
  y: number
  /** 占宽 1-12 */
  w: number
  /** 占高 (行高单位) */
  h: number
}

/** 图表字段编码 (视觉通道 → 数据字段绑定) */
export interface WidgetEncode {
  x?: string
  y?: string
  series?: string
  category?: string
  value?: string
  columns?: string[]
}

export interface WidgetFilter {
  field: string
  op: FilterOp
  value?: unknown
  values?: unknown[]
}

export interface ComputedField {
  name: string
  type?: FieldType
  expr: string
}

/** 图表组件规格: 绑定数据集 + 视觉编码 + 过滤 */
export interface WidgetSpec {
  id: string
  type: ChartType
  title?: string
  datasetId?: string
  encode?: WidgetEncode
  /** 度量聚合方式, 缺省 SUM */
  agg?: AggType
  filters?: WidgetFilter[]
  /**
   * 对象整形程序 (RAW 部件): 把数据集的二维结果抬成任意高维结构, 由后端 z-util-expr-obj 执行。
   * 就是一段 JSON (步骤数组或对象), 所以此处只声明为 unknown —— 前端不解释它。
   */
  shape?: unknown
}

/** 视图页 schema: 三个生产者 (AI 一句话生成 / 拖拽设计器 / 模板库), 一个消费者 (UniversalRenderer) */
export interface ViewSchema {
  id?: string
  title?: string
  version?: number
  widgets?: WidgetSpec[]
  layout?: WidgetLayout[]
}

export interface FieldDef {
  name: string
  label?: string
  type?: FieldType
  role?: FieldRole | null
}

export interface JoinDef {
  sourceId?: string
  table?: string
  type?: JoinType
  leftKeys?: string[]
  rightKeys?: string[]
}

/** 数据集定义 (语义层): 主源 + 多源内存 join + 计算字段 + 过滤 + 字段语义标注 */
export interface DatasetSchema {
  id?: string
  name?: string
  sourceId?: string
  baseTable?: string
  joins?: JoinDef[]
  filters?: WidgetFilter[]
  computedFields?: ComputedField[]
  fields?: FieldDef[]
}

export interface DataSourceDef {
  id?: string
  name?: string
  type?: DataSourceType
  properties?: Record<string, string>
}

export interface QueryResult {
  columns?: FieldDef[]
  rows?: Record<string, unknown>[]
  total?: number
}

/* ------------------------------------------------------------------ *
 * 渲染产物 (后端 /api/render/** 的响应形状)
 * ------------------------------------------------------------------ */

/** echarts option 的宽松形状: 不引 echarts 类型, 避免把可选 peer 变成类型上的硬依赖 */
export interface ChartOption {
  [key: string]: unknown
  series?: ChartSeriesOption | ChartSeriesOption[]
}

export interface ChartSeriesOption {
  [key: string]: unknown
  type?: string
  name?: string
  data?: unknown
}

export interface TableColumn {
  key: string
  label?: string
}

/**
 * 单 widget 的渲染产物: 后端在原 option 上包 `_widgetType` / `_title` 用于分发。
 * `_` 前缀键是渲染器元信息, 喂给 echarts 前必须剥掉 (见 charts/option.ts)。
 *
 * 一个带索引签名的宽接口, 而不是 kpi/table/chart 三个类型的联合: option 本身就是后端拼出来的
 * blob, 联合类型只会让分发处到处 `as`。已知字段在此列明, 其余键按 echarts option 原样透传。
 */
export interface WidgetOption {
  [key: string]: unknown
  /** 分发依据: ChartType; 后端缺省时按 TABLE 处理 */
  _widgetType?: ChartType
  _title?: string
  /** 'kpi' / 'table' / echarts 系列类型 */
  type?: string
  /**
   * kpi / raw 的载荷: kpi 是数值或字符串, raw 是整形程序产出的任意结构 (对象/数组/标量)。
   * 两者共用一个字段, 所以只能是 unknown —— 各部件自己按约定收敛 (见 KpiWidget.toStatisticValue)。
   */
  value?: unknown
  label?: string
  /** table 约定字段 */
  columns?: TableColumn[]
  rows?: Record<string, unknown>[]
  series?: ChartSeriesOption | ChartSeriesOption[]
}

/** 整页渲染产物: layout 决定摆哪, options 决定摆什么 */
export interface RenderData {
  viewId?: string
  title?: string
  version?: number
  layout?: WidgetLayout[]
  options?: Record<string, WidgetOption>
}
