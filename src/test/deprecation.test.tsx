import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DictDTO, EntityDefDTO, FieldDefDTO, FieldTypeDescriptor } from '../contract/field'
import { DEFAULT_FIELD_TYPES } from '../fields/defaults'
import { createWorkspaceContext, resolveEntityFields } from '../fields/registry'
import type { ResolvedField } from '../fields/types'
import UniversalRenderer from '../renderer/UniversalRenderer'
import type { RenderData, WidgetOption } from '../contract/view'

/**
 * antd 的弃用告警只在 dev 构建里打, 生产构建会静默 —— 也就是说线上一旦升到
 * antd 6, 这些 prop 直接失效而不是报错。包的 peer 范围是 `antd >=5.29 || ^6`,
 * 所以告警必须在 CI 里就被看见: 这里把内置部件和内置字段定义的每种渲染
 * 全跑一遍, 断言控制台里没有 "deprecated"。
 */

const echarts = vi.hoisted(() => {
  const setOption = vi.fn()
  const init = vi.fn(() => ({ setOption, resize: vi.fn(), dispose: vi.fn() }))
  return { init, setOption }
})
vi.mock('echarts', () => ({ init: echarts.init }))

let warnings: string[] = []
let errorSpy: ReturnType<typeof vi.spyOn>
let warnSpy: ReturnType<typeof vi.spyOn>

function record(args: unknown[]) {
  const text = args
    .map((a) => (typeof a === 'string' ? a : ''))
    .join(' ')
  if (/deprecat/i.test(text)) warnings.push(text)
}

beforeEach(() => {
  warnings = []
  errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => record(args))
  warnSpy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => record(args))
})

afterEach(() => {
  errorSpy.mockRestore()
  warnSpy.mockRestore()
  expect(warnings).toEqual([])
})

const chart = (extra: Partial<WidgetOption>): WidgetOption => ({
  xAxis: ['华东', '华南'],
  series: [{ type: 'bar', data: [1, 2] }],
  ...extra,
})

describe('内置部件无 antd 弃用告警', () => {
  it('KPI / TABLE / RAW / LINE / BAR / PIE 一次全渲染', () => {
    const renderData: RenderData = {
      viewId: 'v1',
      title: '销售总览',
      layout: [
        { widgetId: 'kpi', x: 0, y: 0, w: 3, h: 2 },
        { widgetId: 'table', x: 3, y: 0, w: 9, h: 4 },
        { widgetId: 'raw', x: 0, y: 4, w: 12, h: 3 },
        { widgetId: 'line', x: 0, y: 7, w: 4, h: 4 },
        { widgetId: 'bar', x: 4, y: 7, w: 4, h: 4 },
        { widgetId: 'pie', x: 8, y: 7, w: 4, h: 4 },
      ],
      options: {
        kpi: { _widgetType: 'KPI', type: 'kpi', value: 123456, label: '总销售额' },
        table: {
          _widgetType: 'TABLE',
          type: 'table',
          columns: [
            { key: 'city', label: '城市' },
            { key: 'amount', label: '金额' },
          ],
          rows: Array.from({ length: 5 }, (_, i) => ({ city: `杭州${i}`, amount: i * 100 })),
        },
        raw: { _widgetType: 'RAW', type: 'raw', _title: '区域汇总', value: { 华东: { total: 350, cities: ['杭州'] } } },
        line: { _widgetType: 'LINE', ...chart({}) },
        bar: { _widgetType: 'BAR', ...chart({}) },
        pie: { _widgetType: 'PIE', type: 'pie', series: [{ type: 'pie', data: [{ name: '华东', value: 3 }] }] },
      },
    }
    render(<UniversalRenderer renderData={renderData} />)
  })

  it('加载态与空态 (Spin / Empty) 同样干净', () => {
    const { unmount } = render(<UniversalRenderer renderData={null} />)
    unmount()
    render(<UniversalRenderer renderData={{ layout: [], options: {} }} />)
  })
})

const DICT: DictDTO = {
  dictCode: 'status',
  dictName: '状态',
  items: [
    { itemCode: 'active', itemLabel: '在售', sortOrder: 1 },
    { itemCode: 'off', itemLabel: '下架', sortOrder: 2 },
  ],
} as DictDTO

const REF_ENTITY: EntityDefDTO = {
  entityCode: 'customer',
  entityName: '客户',
  appCode: 'demo_app',
  tenantCode: 'default',
  fields: [
    { fieldCode: 'id', fieldName: 'ID', fieldType: 'LONG' },
    { fieldCode: 'name', fieldName: '名称', fieldType: 'STRING' },
  ],
} as EntityDefDTO

/** descriptor 的 widget 会被注册表用来选定义: 把 TEXT 指到 radio, 才能覆盖到 radioDefinition */
const RADIO_TEXT: FieldTypeDescriptor = {
  ...DEFAULT_FIELD_TYPES.find((item) => item.fieldType === 'TEXT')!,
  widget: 'radio',
}

// 每个 registry key 至少走一遍: STRING/TEXT/JSON/BOOLEAN 会被 widget:* 别名接走
const FIELDS: FieldDefDTO[] = [
  { fieldCode: 'name', fieldName: '名称', fieldType: 'STRING' },
  { fieldCode: 'remark', fieldName: '备注', fieldType: 'TEXT' },
  { fieldCode: 'tags', fieldName: '标签', fieldType: 'TEXT', dictCode: 'status' },
  { fieldCode: 'qty', fieldName: '数量', fieldType: 'INT' },
  { fieldCode: 'code', fieldName: '编码', fieldType: 'LONG' },
  { fieldCode: 'price', fieldName: '单价', fieldType: 'DECIMAL' },
  { fieldCode: 'online', fieldName: '在售', fieldType: 'BOOLEAN' },
  { fieldCode: 'born', fieldName: '日期', fieldType: 'DATE' },
  { fieldCode: 'at', fieldName: '时间', fieldType: 'DATETIME' },
  { fieldCode: 'meta', fieldName: '元数据', fieldType: 'JSON' },
  { fieldCode: 'cust', fieldName: '客户', fieldType: 'REF', refEntity: 'customer' },
  { fieldCode: 'status', fieldName: '状态', fieldType: 'STRING', dictCode: 'status' },
] as FieldDefDTO[]

const VALUES: Record<string, unknown> = {
  name: '微念',
  remark: '一段很长的备注文本',
  tags: 'active',
  qty: 3,
  code: 9_000_000_001,
  price: 3.5,
  online: true,
  born: '2026-09-24',
  at: '2026-09-24 10:20:30',
  meta: { a: 1 },
  cust: 7,
  status: 'active',
}

function resolvedFields(): ResolvedField[] {
  const ws = createWorkspaceContext({
    appCode: 'demo_app',
    tenantCode: 'default',
    entities: [REF_ENTITY],
    dicts: [DICT],
    fieldTypes: [RADIO_TEXT],
    services: { loadReference: async () => [{ id: 7, name: '张三' }] },
  })
  return resolveEntityFields(
    {
      entityCode: 'order',
      entityName: '订单',
      appCode: 'demo_app',
      tenantCode: 'default',
      fields: FIELDS,
    } as EntityDefDTO,
    ws,
  )
}

describe('内置字段定义无 antd 弃用告警', () => {
  it('每种类型的单元格 / 内联编辑器 / 表单控件 / 筛选控件全渲染', async () => {
    const fields = resolvedFields()
    expect(fields).toHaveLength(FIELDS.length)

    const view = render(
      <div>
        {fields.map((f) => {
          const value = VALUES[f.valueKey]
          const base = { ctx: f.ctx, row: { [f.valueKey]: value }, value, displayValue: undefined }
          return (
            <div key={f.valueKey}>
              {f.def.renderCell?.(base)}
              {f.def.renderFilterInput?.({ ctx: f.ctx, operator: 'eq', value, onChange: () => {} })}
              {f.def.renderFilterInput?.({ ctx: f.ctx, operator: 'in', value: [value], onChange: () => {} })}
              {f.def.renderFormInput?.({ ctx: f.ctx, value, onChange: () => {} })}
              {f.def.renderFormInput?.({ ctx: f.ctx, value, onChange: () => {}, preview: true })}
              {f.inlineEditable
                ? f.def.renderEditor?.({
                    ...base,
                    onCommit: () => {},
                    onCancel: () => {},
                  })
                : null}
            </div>
          )
        })}
      </div>,
    )

    // REF 的候选是异步注入的: 等它落地, 免得悬挂的 setState 把下一轮的告警算进这条用例。
    // 这条用例要渲染 12 种类型 × 4 个入口, 并行跑时 antd 挂载本身就几秒, 默认 1s 等不到。
    await view.findAllByText('张三', {}, { timeout: 15000 })
  })
})
