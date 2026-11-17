/** 拖拽刚结束的时间戳：用于抑制「拖完顺手选中」的误点击 */
let lastDragEndAt = 0;

export function markDragEnd(): void {
  lastDragEndAt = Date.now();
}

export function recentlyDragged(withinMs = 160): boolean {
  return Date.now() - lastDragEndAt < withinMs;
}
