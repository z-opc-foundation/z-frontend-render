import type { CSSProperties, ReactNode } from 'react'

const HEADER_H = 34

/**
 * 部件外框: 标题占固定高度, 内容撑满剩余空间 (图表需要容器有确定高度才能 resize)。
 * 三个内置部件共用一个壳, 标题样式不再各写一遍。
 */
export function WidgetShell({
  title,
  children,
  bodyStyle,
  testId,
}: {
  title?: string
  children: ReactNode
  bodyStyle?: CSSProperties
  testId?: string
}) {
  return (
    <div data-widget={testId} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {title ? (
        <div
          style={{
            height: HEADER_H,
            flex: `0 0 ${HEADER_H}px`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            fontWeight: 600,
            fontSize: 14,
            color: 'rgba(0,0,0,0.88)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </div>
      ) : null}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', ...bodyStyle }}>{children}</div>
    </div>
  )
}
