import type { CSSProperties } from 'react'
import type { WidgetLayout } from '../contract/view'

/** 12 栅格布局协议: 渲染 (UniversalRenderer) 与编辑 (LayoutEditor) 共用同一套坐标语义 */
export const GRID_COLUMNS = 12

/** layout 的 `h` 单位对应的像素行高 */
export const ROW_H = 60

/** layout 缺省占宽 (栅格数) */
export const DEFAULT_W = 4

/** layout 缺省占高 (行高单位) */
export const DEFAULT_H = 2

/** 后端可能给出缺项或越界坐标, 统一在渲染前收敛一次, 组件内不再各自 clamp */
export function normalizeCell(cell: WidgetLayout): Required<WidgetLayout> {
  const w = clamp(Math.round(cell.w || DEFAULT_W), 1, GRID_COLUMNS)
  const h = Math.max(1, Math.round(cell.h || DEFAULT_H))
  return {
    widgetId: cell.widgetId,
    x: clamp(Math.round(cell.x || 0), 0, GRID_COLUMNS - w),
    y: Math.max(0, Math.round(cell.y || 0)),
    w,
    h,
  }
}

/** CSS Grid 定位: 栅格坐标 0-based, grid-line 1-based */
export function cellStyle(cell: WidgetLayout): CSSProperties {
  const c = normalizeCell(cell)
  return {
    gridColumn: `${c.x + 1} / span ${c.w}`,
    gridRow: `${c.y + 1} / span ${c.h}`,
  }
}

/** 行数由最深的 y+h 决定: 显式 grid-template-rows 才能让空行保持高度 */
export function totalRows(layout: readonly WidgetLayout[]): number {
  return layout.reduce((m, l) => Math.max(m, (l.y || 0) + (l.h || DEFAULT_H)), 0)
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}
