import { Empty, Tree } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { useMemo } from 'react'
import type { WidgetOption } from '../../contract/view'
import { WidgetShell } from '../WidgetShell'

/** 结构树节点上限: 整形程序产出上万节点时, 全进 DOM 会把整页卡死 */
export const MAX_TREE_NODES = 400

interface Budget {
  left: number
  truncated: boolean
}

function isScalar(value: unknown): boolean {
  return value === null || typeof value !== 'object'
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  return typeof value === 'string' ? value : String(value)
}

/** 任意 JSON 结构 → antd Tree 数据; key 用 json 路径, 天然唯一且可定位 */
function toNodes(value: unknown, path: string, budget: Budget): DataNode[] {
  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((item, i) => [`[${i}]`, item])
    : value && typeof value === 'object'
      ? Object.entries(value as Record<string, unknown>)
      : []
  const nodes: DataNode[] = []
  for (const [name, child] of entries) {
    if (budget.left <= 0) {
      budget.truncated = true
      break
    }
    budget.left -= 1
    const key = `${path}.${name}`
    if (isScalar(child)) {
      nodes.push({ key, title: `${name}: ${text(child)}`, isLeaf: true })
      continue
    }
    const children = toNodes(child, key, budget)
    const open = Array.isArray(child) ? '[' : '{'
    const close = Array.isArray(child) ? ']' : '}'
    nodes.push({ key, title: `${name} ${open}${children.length}${close}`, children })
  }
  return nodes
}

/**
 * RAW 部件: 数据是对象整形语言产出的任意结构, 没有固定形状可假设。
 * 内置实现只负责"看得见" —— 展开成结构树; 真正按业务形态渲染 (表单、思维导图、下钻表)
 * 由使用方注册自己的部件覆盖 RAW 分发, 契约上只有 option.value 这一件事。
 */
export default function RawWidget({ option }: { option: WidgetOption }) {
  const value = option.value
  const nodes = useMemo<DataNode[]>(() => {
    if (value === null || value === undefined) return []
    if (isScalar(value)) return [{ key: 'root', title: text(value), isLeaf: true }]
    const budget: Budget = { left: MAX_TREE_NODES, truncated: false }
    const root = toNodes(value, 'root', budget)
    if (budget.truncated) {
      root.push({
        key: 'root.__truncated',
        title: `仅展示前 ${MAX_TREE_NODES} 个节点`,
        selectable: false,
        disableCheckbox: true,
      })
    }
    return root
  }, [value])

  return (
    <WidgetShell title={option._title} testId="raw" bodyStyle={{ overflow: 'auto', padding: '4px 8px' }}>
      {nodes.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="整形程序没有产出内容" />
      ) : (
        <Tree treeData={nodes} selectable={false} showLine defaultExpandAll />
      )}
    </WidgetShell>
  )
}
