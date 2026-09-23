import { Statistic } from 'antd'
import type { WidgetOption } from '../../contract/view'
import { WidgetShell } from '../WidgetShell'

/**
 * option.value 现在是 unknown (RAW 也走这个字段), 而 Statistic 只吃数值/字符串:
 * 保持数字原样以保留千分位与格式化能力, 其余标量降级成字符串, 结构体不显示。
 */
export function toStatisticValue(value: unknown): string | number {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') return Number.isFinite(value) ? value : '-'
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  return '-'
}

export default function KpiWidget({ option }: { option: WidgetOption }) {
  const label = option.label ?? option._title
  const value = option.value
  return (
    <WidgetShell testId="kpi" bodyStyle={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Statistic title={label} value={toStatisticValue(value)} valueStyle={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1 }} />
    </WidgetShell>
  )
}
