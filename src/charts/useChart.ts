import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { EChartsType } from 'echarts'
import type { ChartOption } from '../contract/view'
import { buildChartOption } from './option'

/**
 * echarts 实例生命周期: 懒加载 init → 尺寸跟随容器 → 卸载 dispose。
 *
 * `import('echarts')` 而不是顶层 import: echarts 是可选 peer, 只渲染 KPI/表格的接入方
 * (z-lc 目前没有 echarts) 不应该因为这个 hook 而被拖进构建依赖。
 */
export function useChart(option: ChartOption): RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<EChartsType | null>(null)
  const pendingRef = useRef<ChartOption>(option)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined
    let alive = true
    let teardown: (() => void) | null = null

    void import('echarts').then((echarts) => {
      if (!alive) return
      const chart = echarts.init(el)
      chart.setOption(buildChartOption(pendingRef.current), true)
      const onResize = (): void => {
        chart.resize()
      }
      const observer = new ResizeObserver(onResize)
      observer.observe(el)
      window.addEventListener('resize', onResize)
      chartRef.current = chart
      teardown = () => {
        observer.disconnect()
        window.removeEventListener('resize', onResize)
        chart.dispose()
        chartRef.current = null
      }
    })

    return () => {
      alive = false
      teardown?.()
      teardown = null
    }
  }, [])

  useEffect(() => {
    pendingRef.current = option
    chartRef.current?.setOption(buildChartOption(option), true)
  }, [option])

  return containerRef
}
