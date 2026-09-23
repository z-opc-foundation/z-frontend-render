import { Empty, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { WidgetOption } from '../../contract/view'
import { WidgetShell } from '../WidgetShell'

/** 超过这个行数只渲染前 N 行: 后端 rows 可能上万, 全量进 DOM 会直接卡死 (分页待后端切片 API) */
export const MAX_RENDER_ROWS = 200

export default function TableWidget({ option }: { option: WidgetOption }) {
  const columns = option.columns ?? []
  const rows = option.rows ?? []
  const title = option._title
  return (
    <WidgetShell title={title} testId="table" bodyStyle={{ overflow: 'auto', padding: '0 12px 8px' }}>
      {columns.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
      ) : (
        <>
          <Table<Record<string, unknown>>
            size="small"
            pagination={false}
            rowKey={(_, i) => String(i)}
            dataSource={rows.slice(0, MAX_RENDER_ROWS)}
            columns={columns.map<ColumnsType<Record<string, unknown>>[number]>((c) => ({
              title: c.label ?? c.key,
              dataIndex: c.key,
              key: c.key,
              ellipsis: true,
              render: (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v)),
            }))}
            scroll={{ x: 'max-content' }}
          />
          {rows.length > MAX_RENDER_ROWS ? (
            <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12, marginTop: 4 }}>
              仅展示前 {MAX_RENDER_ROWS} 行 (共 {rows.length} 行)
            </div>
          ) : null}
        </>
      )}
    </WidgetShell>
  )
}
