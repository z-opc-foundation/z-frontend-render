import type { ReactElement } from 'react'
import type { ChartType, WidgetOption } from '../contract/view'

/** 部件只吃 option: 外框、布局由渲染器负责, 自定义部件与内置部件因此完全同构 */
export interface WidgetProps {
  option: WidgetOption
  widgetId: string
}

export type WidgetComponent = (props: WidgetProps) => ReactElement | null

/** ChartType → 部件实现; 未注册的类型落到 echarts 兜底 */
export type WidgetRegistry = Partial<Record<ChartType, WidgetComponent>>
