import type { WidgetOption } from '../../contract/view'
import { useChart } from '../../charts/useChart'
import { WidgetShell } from '../WidgetShell'

/** option 即后端产出的数据形状, 视觉补全与 `_` 元信息剥离都在 useChart → buildChartOption 里做 */
export default function ChartWidget({ option }: { option: WidgetOption }) {
  const containerRef = useChart(option)
  return (
    <WidgetShell title={option._title} testId="chart" bodyStyle={{ padding: 8 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </WidgetShell>
  )
}
