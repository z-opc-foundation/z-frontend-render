import { Empty, Spin } from 'antd'
import type { CSSProperties } from 'react'
import type { RenderData } from '../contract/view'
import { GRID_COLUMNS, ROW_H, cellStyle, totalRows } from '../layout/grid'
import ChartWidget from './widgets/ChartWidget'
import KpiWidget from './widgets/KpiWidget'
import RawWidget from './widgets/RawWidget'
import TableWidget from './widgets/TableWidget'
import type { WidgetRegistry } from './types'

/**
 * 内置分发: LINE/BAR/PIE 原生 echarts, KPI/TABLE 是渲染器约定结构,
 * RAW 兜住"任意结构" (对象整形语言的产出), 使用方可注册部件覆盖它。
 */
export const BUILTIN_WIDGETS: WidgetRegistry = {
  LINE: ChartWidget,
  BAR: ChartWidget,
  PIE: ChartWidget,
  KPI: KpiWidget,
  TABLE: TableWidget,
  RAW: RawWidget,
}

export interface UniversalRendererProps {
  /** 后端 GET /api/render/view/{id} 的响应 */
  renderData?: RenderData | null
  /** 追加或覆盖按 ChartType 的分发, 新图表类型不需要改渲染引擎 */
  widgetRenderers?: WidgetRegistry
  rowHeight?: number
  gap?: number
  loadingText?: string
  className?: string
  style?: CSSProperties
}

/**
 * 通用渲染器: schema 驱动, 前端零业务逻辑。
 * layout 决定摆哪, options 决定摆什么, 两者用 widgetId 对齐。
 */
export default function UniversalRenderer({
  renderData,
  widgetRenderers,
  rowHeight = ROW_H,
  gap = 12,
  loadingText = '加载中...',
  className,
  style,
}: UniversalRendererProps) {
  if (!renderData) {
    return (
      <div className={className} style={{ padding: 24, textAlign: 'center', ...style }}>
        <Spin /> <span style={{ marginLeft: 8 }}>{loadingText}</span>
      </div>
    )
  }

  const registry: WidgetRegistry = { ...BUILTIN_WIDGETS, ...widgetRenderers }
  const cells = renderData.layout ?? []
  const options = renderData.options ?? {}
  const rows = totalRows(cells)

  const blocks = cells.flatMap((cell) => {
    const option = options[cell.widgetId]
    // 后端渲染失败的 widget 不产出 option: 跳过, 不阻塞整页
    if (!option) return []
    const type = option._widgetType ?? 'TABLE'
    const Widget = registry[type] ?? ChartWidget
    const box: CSSProperties = {
      ...cellStyle(cell),
      background: '#fff',
      border: '1px solid #f0f0f0',
      borderRadius: 8,
      overflow: 'hidden',
    }
    return [
      <div key={cell.widgetId} data-widget-id={cell.widgetId} data-testid={`widget-${cell.widgetId}`} style={box}>
        <Widget option={option} widgetId={cell.widgetId} />
      </div>,
    ]
  })

  return (
    <div className={className} style={{ padding: 16, ...style }} data-renderer="universal">
      {renderData.title ? (
        <h2 style={{ margin: `0 0 ${gap}px`, fontSize: 18, fontWeight: 600 }}>{renderData.title}</h2>
      ) : null}
      {blocks.length === 0 ? (
        <Empty description="该视图没有可渲染的部件" />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, ${rowHeight}px)`,
            gap,
          }}
        >
          {blocks}
        </div>
      )}
    </div>
  )
}
