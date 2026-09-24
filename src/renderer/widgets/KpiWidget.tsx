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

/**
 * 字号写在 valueRender 的 span 上而不是 `valueStyle`: 后者在 antd 6 已弃用
 * (`styles.content` 是替代), 但 `styles` 在包支持的 antd 5.29 上不存在 —— 5.29.3
 * 已是 5 线最后一版, 所以两端都不告警的写法只有 valueRender。
 * antd 把 `.ant-statistic-content` 的字号写在容器上, 内层 span 自带字号即可覆盖。
 */
const VALUE_STYLE = { fontSize: 32, fontWeight: 700, lineHeight: 1.1 } as const

export default function KpiWidget({ option }: { option: WidgetOption }) {
  const label = option.label ?? option._title
  const value = option.value
  return (
    <WidgetShell testId="kpi" bodyStyle={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Statistic
        title={label}
        value={toStatisticValue(value)}
        valueRender={(node) => <span style={VALUE_STYLE}>{node}</span>}
      />
    </WidgetShell>
  )
}
