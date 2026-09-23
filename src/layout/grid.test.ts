import { describe, expect, it } from 'vitest'
import { cellStyle, normalizeCell, totalRows } from './grid'

describe('normalizeCell', () => {
  it('补齐缺省占宽占高', () => {
    expect(normalizeCell({ widgetId: 'w1', x: 0, y: 0, w: 0, h: 0 })).toEqual({
      widgetId: 'w1',
      x: 0,
      y: 0,
      w: 4,
      h: 2,
    })
  })

  it('把越界坐标夹回 12 栅格内', () => {
    // w 超过 12 会被压到 12, 于是 x 必须跟着退到 0, 否则 span 会掉出网格
    expect(normalizeCell({ widgetId: 'w2', x: 9, y: -3, w: 20, h: 1 })).toMatchObject({ x: 0, y: 0, w: 12 })
    expect(normalizeCell({ widgetId: 'w3', x: 10, y: 1, w: 6, h: 2 })).toMatchObject({ x: 6, w: 6 })
  })

  it('小数坐标取整', () => {
    expect(normalizeCell({ widgetId: 'w4', x: 1.6, y: 2.2, w: 3.4, h: 1.8 })).toMatchObject({
      x: 2,
      y: 2,
      w: 3,
      h: 2,
    })
  })
})

describe('cellStyle', () => {
  it('栅格坐标 0-based, grid-line 1-based', () => {
    expect(cellStyle({ widgetId: 'w', x: 2, y: 1, w: 6, h: 3 })).toEqual({
      gridColumn: '3 / span 6',
      gridRow: '2 / span 3',
    })
  })
})

describe('totalRows', () => {
  it('取最深的 y+h, 空布局为 0', () => {
    expect(totalRows([])).toBe(0)
    expect(
      totalRows([
        { widgetId: 'a', x: 0, y: 0, w: 6, h: 2 },
        { widgetId: 'b', x: 6, y: 3, w: 6, h: 4 },
      ]),
    ).toBe(7)
  })

  it('缺省 h 按 2 行算, 不会把布局压成 0 高', () => {
    expect(totalRows([{ widgetId: 'a', x: 0, y: 2, w: 6, h: 0 }])).toBe(4)
  })
})
