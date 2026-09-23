import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ChartType, RenderData, WidgetOption } from '../contract/view'
import UniversalRenderer from './UniversalRenderer'

// jsdom 没有 canvas, echarts 真跑不起来; 桩掉 init 顺带断言"喂给 echarts 的 option 长什么样"
const echarts = vi.hoisted(() => {
  const setOption = vi.fn()
  const init = vi.fn(() => ({ setOption, resize: vi.fn(), dispose: vi.fn() }))
  return { init, setOption }
})
vi.mock('echarts', () => ({ init: echarts.init }))

const barOption: WidgetOption = {
  _widgetType: 'BAR',
  _title: '区域销售额',
  xAxis: ['华东', '华南'],
  series: [{ type: 'bar', data: [1, 2] }],
}

const kpi = (value: number, label?: string): WidgetOption => ({ _widgetType: 'KPI', type: 'kpi', value, label })
const table = (label: string, cell: unknown): WidgetOption => ({
  _widgetType: 'TABLE',
  type: 'table',
  columns: [{ key: 'c', label }],
  rows: [{ c: cell }],
})

describe('UniversalRenderer 分发', () => {
  it('按 _widgetType 分派到 KPI / TABLE / 图表三条分支', async () => {
    const renderData: RenderData = {
      viewId: 'v1',
      title: '销售总览',
      layout: [
        { widgetId: 'k1', x: 0, y: 0, w: 3, h: 2 },
        { widgetId: 't1', x: 3, y: 0, w: 9, h: 4 },
        { widgetId: 'c1', x: 0, y: 4, w: 12, h: 5 },
      ],
      options: { k1: kpi(123456, '总销售额'), t1: table('城市', '杭州'), c1: barOption },
    }
    render(<UniversalRenderer renderData={renderData} />)

    expect(screen.getByText('销售总览')).toBeInTheDocument()
    expect(screen.getByText('总销售额')).toBeInTheDocument()
    expect(screen.getByText('123,456')).toBeInTheDocument()
    const t1 = within(screen.getByTestId('widget-t1'))
    // antd Table 在 scroll.x 下会渲染一份测量用的隐藏表头, 列标题必然出现两次
    expect(t1.getAllByText('城市')).toHaveLength(2)
    expect(t1.getByText('杭州')).toBeInTheDocument()

    await waitFor(() => expect(echarts.init).toHaveBeenCalledTimes(1))
    const [option] = echarts.setOption.mock.calls[0] as [{ xAxis: { data: string[] }; _widgetType?: string }]
    expect(option.xAxis.data).toEqual(['华东', '华南'])
    // 渲染器元信息绝不能漏进 echarts
    expect(option._widgetType).toBeUndefined()
  })

  it('RAW 走结构树分支, 不会被当成 echarts 图表兜底渲染', () => {
    render(
      <UniversalRenderer
        renderData={{
          layout: [{ widgetId: 'r1', x: 0, y: 0, w: 12, h: 4 }],
          options: { r1: { _widgetType: 'RAW', type: 'raw', _title: '区域汇总', value: { 华东: { total: 350 } } } },
        }}
      />,
    )
    const box = screen.getByTestId('widget-r1')
    expect(within(box).getByText('total: 350')).toBeInTheDocument()
    // 落到图表兜底分支的话, 这里会出现 chart 壳 —— 任意结构绝不能喂给 echarts
    expect(box.querySelector('[data-widget="chart"]')).toBeNull()
  })

  it('缺 _widgetType 按 TABLE 兜底, 未注册的类型按图表兜底', async () => {
    const fallback = table('数量', 3)
    delete fallback._widgetType
    render(
      <UniversalRenderer
        renderData={{
          layout: [{ widgetId: 'a', x: 0, y: 0, w: 6, h: 2 }],
          options: { a: fallback },
        }}
      />,
    )
    expect(within(screen.getByTestId('widget-a')).getAllByText('数量')).toHaveLength(2)

    // 后端新增了图表类型、引擎还没跟上时: 按 echarts 图表渲染, 而不是白屏
    const scatter = { _widgetType: 'SCATTER' as unknown as ChartType, xAxis: [1, 2], series: [{ type: 'scatter', data: [[1, 2]] }] }
    render(
      <UniversalRenderer
        renderData={{
          layout: [{ widgetId: 'b', x: 0, y: 0, w: 6, h: 2 }],
          options: { b: scatter },
        }}
      />,
    )
    await waitFor(() => expect(echarts.init).toHaveBeenCalledTimes(1))
  })

  it('widgetRenderers 可以注册或覆盖一种 ChartType', () => {
    function MyKpi({ option }: { option: WidgetOption }) {
      return <div data-testid="custom-kpi">自定义 {String(option.value)}</div>
    }
    render(
      <UniversalRenderer
        widgetRenderers={{ KPI: MyKpi }}
        renderData={{
          layout: [{ widgetId: 'k', x: 0, y: 0, w: 3, h: 2 }],
          options: { k: kpi(42) },
        }}
      />,
    )
    expect(screen.getByTestId('custom-kpi')).toHaveTextContent('自定义 42')
  })
})

describe('UniversalRenderer 布局与缺数据', () => {
  it('后端渲染失败的 widget 跳过, 不阻塞同页其它部件', () => {
    render(
      <UniversalRenderer
        renderData={{
          layout: [
            { widgetId: 'gone', x: 0, y: 0, w: 6, h: 2 },
            { widgetId: 'ok', x: 6, y: 0, w: 6, h: 2 },
          ],
          options: { ok: kpi(1, '还在的') },
        }}
      />,
    )
    expect(screen.getByText('还在的')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-widget-id]')).toHaveLength(1)
  })

  it('grid 行数取最深的 y+h, 列坐标落到 grid-line', () => {
    render(
      <UniversalRenderer
        renderData={{
          layout: [{ widgetId: 'k', x: 4, y: 1, w: 6, h: 3 }],
          options: { k: kpi(1) },
        }}
      />,
    )
    const grid = screen.getByTestId('widget-k')
    expect(grid.style.gridColumn).toBe('5 / span 6')
    expect(grid.style.gridRow).toBe('2 / span 3')
  })

  it('renderData 为空时给加载态, layout 为空时给空态', () => {
    const { unmount } = render(<UniversalRenderer renderData={null} loadingText="稍后" />)
    expect(screen.getByText('稍后')).toBeInTheDocument()
    unmount()

    render(<UniversalRenderer renderData={{ layout: [], options: {} }} />)
    expect(screen.getByText('该视图没有可渲染的部件')).toBeInTheDocument()
  })
})
