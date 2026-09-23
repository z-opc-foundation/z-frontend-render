import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import UniversalRenderer from '../src/renderer/UniversalRenderer'
import type { RenderData } from '../src/contract/view'

/** 与 z-report `GET /api/render/view/{id}` 的响应逐字段同形: 后端只给数据, 视觉全在渲染引擎 */
const salesView: RenderData = {
  viewId: 'view-sales',
  title: '销售总览',
  version: 1,
  layout: [
    { widgetId: 'kpi-amount', x: 0, y: 0, w: 3, h: 2 },
    { widgetId: 'kpi-orders', x: 3, y: 0, w: 3, h: 2 },
    { widgetId: 'pie-region', x: 6, y: 0, w: 6, h: 5 },
    { widgetId: 'bar-city', x: 0, y: 5, w: 12, h: 5 },
    { widgetId: 'table-detail', x: 0, y: 10, w: 12, h: 6 },
    { widgetId: 'raw-region', x: 0, y: 16, w: 12, h: 6 },
  ],
  options: {
    'kpi-amount': { _widgetType: 'KPI', _title: '销售额', type: 'kpi', value: 1284500, label: '销售额 (元)' },
    'kpi-orders': { _widgetType: 'KPI', _title: '订单数', type: 'kpi', value: 3127, label: '订单数' },
    'pie-region': {
      _widgetType: 'PIE',
      _title: '区域占比',
      series: [
        {
          type: 'pie',
          data: [
            { name: '华东', value: 512300 },
            { name: '华南', value: 338100 },
            { name: '华北', value: 246800 },
            { name: '西南', value: 187300 },
          ],
        },
      ],
    },
    // 裸数组 xAxis + 无 yAxis/tooltip/grid: 这些由 charts/option.ts 补全
    'bar-city': {
      _widgetType: 'BAR',
      _title: '各城市销售额',
      xAxis: ['杭州', '上海', '深圳', '北京', '成都', '广州'],
      series: [{ name: 'amount', type: 'bar', data: [312400, 289100, 245600, 198700, 132500, 106200] }],
    },
    'table-detail': {
      _widgetType: 'TABLE',
      _title: '订单明细',
      type: 'table',
      columns: [
        { key: 'orderNo', label: '单号' },
        { key: 'city', label: '城市' },
        { key: 'amount', label: '金额' },
        { key: 'paid', label: '已支付' },
      ],
      rows: [
        { orderNo: 'SO-2026-0001', city: '杭州', amount: 12800, paid: true },
        { orderNo: 'SO-2026-0002', city: '上海', amount: 9600, paid: false },
        { orderNo: 'SO-2026-0003', city: '深圳', amount: 15400, paid: true },
        { orderNo: 'SO-2026-0004', city: '北京', amount: 7300, paid: null },
      ],
    },
    // RAW: 三维聚合后的任意高维结构 —— 后端对象整形语言 (z-util-expr-obj) 把二维结果
    // group/keyBy/map 成"区域 → 汇总 + 明细"的文档, 渲染层不猜形状, 原样展开
    'raw-region': {
      _widgetType: 'RAW',
      _title: '区域汇总 (整形产出)',
      type: 'raw',
      value: {
        华东: { total: 512300, orders: 1284, cities: [{ city: '杭州', amount: 312400 }, { city: '上海', amount: 199900 }] },
        华南: { total: 338100, orders: 842, cities: [{ city: '深圳', amount: 245600 }, { city: '广州', amount: 92500 }] },
      },
    },
  },
}

export function Playground() {
  return (
    <ConfigProvider locale={zhCN}>
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <UniversalRenderer renderData={salesView} />
      </div>
    </ConfigProvider>
  )
}
