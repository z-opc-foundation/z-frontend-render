import { version } from 'antd';

/**
 * antd 5 / 6 差异收敛点。
 *
 * 设计器要同时跑在 z-lc 控制台（antd 5）和 z-opc 主壳（antd 6）里，
 * 少数 props 在 6 里被重命名了。与其到处 `as any` 或者接受一堆 deprecation 警告，
 * 不如在这里按版本选一次：
 *   - Drawer 宽度：5 用 width，6 用 size（6 里 width 仍能用但会打弃用警告）
 *   - Divider 方向：5 用 type="vertical"，6 用 orientation —— 所以干脆不用，改用 CSS 分隔符
 */
const major = Number.parseInt(String(version).split('.')[0] ?? '5', 10);
export const isAntdV6 = Number.isFinite(major) && major >= 6;

/** Drawer 宽度：按 antd 大版本给出正确的 prop 名 */
export function drawerSizeProps(px: number): { size: number } | { width: number } {
  return isAntdV6 ? { size: px } : { width: px };
}
