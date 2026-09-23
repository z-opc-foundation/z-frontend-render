import { describe, expect, it } from 'vitest'
import { DEFAULT_PALETTE, buildChartOption, isRenderMetaKey, stripRenderMeta } from './option'
import type { ChartOption } from '../contract/view'

describe('stripRenderMeta', () => {
  it('只剥掉 `_` 前缀的渲染器元信息', () => {
    const clean = stripRenderMeta({ _widgetType: 'BAR', _title: '销售额', xAxis: ['华东'], series: [] })
    expect(clean).toEqual({ xAxis: ['华东'], series: [] })
    expect(isRenderMetaKey('_widgetType')).toBe(true)
    expect(isRenderMetaKey('type')).toBe(false)
  })
})

describe('buildChartOption 直角坐标', () => {
  it('后端给的裸 xAxis 数组补成 category 轴', () => {
    // 这是 z-report 现状的真 bug: xAxis: ["华东","华南"] 直接喂 echarts, 轴不显示
    const option = buildChartOption({
      _widgetType: 'LINE',
      xAxis: ['华东', '华南'],
      series: [{ type: 'line', name: 'amount', data: [10, 20] }],
    })
    expect(option.xAxis).toEqual({ type: 'category', data: ['华东', '华南'], boundaryGap: false })
    expect(option.yAxis).toMatchObject({ type: 'value' })
    expect(option.tooltip).toEqual({ trigger: 'axis', axisPointer: { type: 'line' } })
  })

  it('柱图需要轴间隙, 折线不需要', () => {
    const bar = buildChartOption({ xAxis: ['a'], series: [{ type: 'bar', data: [1] }] })
    const line = buildChartOption({ xAxis: ['a'], series: [{ type: 'line', data: [1] }] })
    expect((bar.xAxis as ChartOption).boundaryGap).toBe(true)
    expect((line.xAxis as ChartOption).boundaryGap).toBe(false)
    expect(bar.tooltip).toEqual({ trigger: 'axis', axisPointer: { type: 'shadow' } })
  })

  it('已经是对象轴的 option 原样放行', () => {
    const axis = { type: 'time', data: ['2026-01-01'] }
    const option = buildChartOption({ xAxis: axis, series: [{ type: 'line', data: [1] }] })
    expect(option.xAxis).toBe(axis)
  })

  it('单系列不画图例, 多系列才画', () => {
    const single = buildChartOption({ xAxis: ['a'], series: [{ type: 'bar', data: [1] }] })
    const multi = buildChartOption({
      xAxis: ['a'],
      series: [
        { type: 'bar', name: 'x', data: [1] },
        { type: 'line', name: 'y', data: [2] },
      ],
    })
    expect(single.legend).toBeUndefined()
    expect(multi.legend).toMatchObject({ top: 0, type: 'scroll' })
    expect(multi.grid).toMatchObject({ top: 36 })
  })

  it('缺 xAxis 时给空类目轴, 不抛异常', () => {
    const option = buildChartOption({ series: [{ type: 'bar', data: [] }] })
    expect(option.xAxis).toMatchObject({ type: 'category', data: [] })
  })

  it('配色与网格由前端定, 后端不下发', () => {
    const option = buildChartOption({ series: [{ type: 'bar', data: [1] }] })
    expect(option.color).toBe(DEFAULT_PALETTE)
    expect(option.grid).toMatchObject({ containLabel: true, left: 8 })
  })
})

describe('buildChartOption 饼图', () => {
  it('饼图不配坐标轴, 补环形的半径与标签', () => {
    const option = buildChartOption({
      _widgetType: 'PIE',
      series: [{ type: 'pie', data: [{ name: '华东', value: 10 }] }],
    })
    expect(option.xAxis).toBeUndefined()
    expect(option.tooltip).toEqual({ trigger: 'item' })
    expect(option.legend).toMatchObject({ bottom: 0 })
    expect(option.series).toMatchObject([{ radius: ['45%', '68%'], data: [{ name: '华东', value: 10 }] }])
  })
})

describe('overrides', () => {
  it('覆盖项最后浅合并, 接入方可以按 widget 微调', () => {
    const option = buildChartOption(
      { xAxis: ['a'], series: [{ type: 'bar', data: [1] }] },
      { grid: { left: 100 }, toolbox: { feature: { saveAsImage: {} } } },
    )
    expect(option.grid).toEqual({ left: 100 })
    expect(option.toolbox).toEqual({ feature: { saveAsImage: {} } })
  })
})
