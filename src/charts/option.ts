import type { ChartOption, ChartSeriesOption } from '../contract/view'

/**
 * 后端 option → 可绘制的 echarts option: 后端只给数据形状, 视觉决策 (轴/tooltip/图例/留白/配色) 全在这里。
 *
 * 必须过这一道的原因: 后端 `LineOptionBuilder` 产出的 `xAxis` 是裸数组 `["华东","华南"]`,
 * echarts 要的是 `{type:'category', data:[...]}` —— 直接塞进去轴不显示, 图等于白画。
 * `_` 前缀的渲染器元信息同时被剥掉, overrides 最后浅合并。
 */

/** 默认调色板: 与 antd 主色系一致, 避免图表和平台界面两套颜色语言 */
export const DEFAULT_PALETTE = [
  '#1677ff',
  '#13c2c2',
  '#73d13d',
  '#faad14',
  '#f5222d',
  '#722ed1',
  '#eb2f96',
  '#fa8c16',
]

export function isRenderMetaKey(key: string): boolean {
  return key.startsWith('_')
}

/** 剥掉 `_widgetType` / `_title` 等渲染器元信息 */
export function stripRenderMeta(option: ChartOption): ChartOption {
  const clean: ChartOption = {}
  for (const [key, value] of Object.entries(option)) {
    if (!isRenderMetaKey(key)) clean[key] = value
  }
  return clean
}

/**
 * 补全 echarts 能画的 option: 裸 xAxis 数组 → category 轴, 缺 yAxis → value 轴,
 * 并按图形语义给 tooltip / grid / legend / 配色。
 */
export function buildChartOption(raw: ChartOption, overrides: ChartOption = {}): ChartOption {
  const option = stripRenderMeta(raw)
  return { ...(isPie(option) ? pieBase(option) : cartesianBase(option)), ...overrides }
}

function seriesList(option: ChartOption): ChartSeriesOption[] {
  const raw = option.series
  if (raw == null) return []
  return (Array.isArray(raw) ? raw : [raw]).filter((s): s is ChartSeriesOption => s != null && typeof s === 'object')
}

function isPie(option: ChartOption): boolean {
  return seriesList(option).some((s) => s.type === 'pie')
}

function pieBase(option: ChartOption): ChartOption {
  const series = seriesList(option).map((s) => ({
    radius: ['45%', '68%'],
    avoidLabelOverlap: true,
    label: { show: true, formatter: '{b}: {d}%' },
    ...s,
  }))
  return {
    color: DEFAULT_PALETTE,
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, type: 'scroll' },
    ...without(option, ['series']),
    series,
  }
}

function cartesianBase(option: ChartOption): ChartOption {
  const series = seriesList(option)
  const isBar = series.some((s) => s.type === 'bar')
  // 柱图要轴间隙 (boundaryGap: true), 折线要贴刻度 (false): 由系列类型推出, 不接受后端下发
  const axes = {
    xAxis: normalizeCategoryAxis(option.xAxis, isBar),
    yAxis: option.yAxis ?? valueAxis(),
  }
  return {
    color: DEFAULT_PALETTE,
    // 多系列才需要图例, 单系列画出来只会白占顶部留白
    legend: series.length > 1 ? { top: 0, type: 'scroll' } : undefined,
    tooltip: { trigger: 'axis', axisPointer: { type: isBar ? 'shadow' : 'line' } },
    grid: { left: 8, right: 16, top: series.length > 1 ? 36 : 16, bottom: 8, containLabel: true },
    ...without(option, ['xAxis', 'yAxis', 'series']),
    ...axes,
    series,
  }
}

function without(option: ChartOption, keys: string[]): ChartOption {
  const rest: ChartOption = { ...option }
  for (const key of keys) delete rest[key]
  return rest
}

function valueAxis(): ChartOption {
  return {
    type: 'value',
    splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } },
  }
}

/** 后端给裸数组类目时补成 category 轴; 已是对象 (或轴数组) 则原样放行 */
function normalizeCategoryAxis(axis: unknown, boundaryGap: boolean): ChartOption | unknown {
  if (axis == null) return { type: 'category', data: [], boundaryGap }
  if (Array.isArray(axis) && !axis.some((v) => v != null && typeof v === 'object')) {
    return { type: 'category', data: axis.map((v) => (v == null ? '' : String(v))), boundaryGap }
  }
  return axis
}
