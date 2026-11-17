import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { PageSchema, SchemaNode } from './contract'
import { type MaterialRegistry } from './material'
import {
  type RenderPlugin,
  type RenderEngine,
  applyPlugins,
  createEngine,
  globalContextPlugin,
  injectNodeContext,
} from './plugin'

export interface TreeRendererProps {
  /** 统一页面 Schema (elements 扁平表 + layout 树) */
  schema: PageSchema
  /** 物料注册表: type → view + config */
  materials: MaterialRegistry
  /** 渲染插件 (生命周期注入) */
  plugins?: RenderPlugin[]
  /** 事件回调: 物料 emit 时触发 */
  onEvent?: (nodeId: string, event: string, payload?: unknown) => void
  className?: string
  style?: React.CSSProperties
}

/**
 * 递归组件树渲染器: 消费统一 Schema, 从 layout.root 出发按 structure 递归渲染。
 *
 * 与 UniversalRenderer (扁平 widget + 12 栅格) 并存, 互不破坏:
 * - UniversalRenderer 服务报表 / 坐标式页面
 * - TreeRenderer 服务组件树页面 (父子容器 + 具名插槽 + 逻辑事件)
 *
 * 渲染内核不认识具体业务物料, 全部通过 materials 注册表分发; 物料通过 context
 * 读写上下文、通过 emit 抛出事件 (由宿主接到逻辑引擎)。
 */
export default function TreeRenderer({
  schema,
  materials,
  plugins,
  onEvent,
  className,
  style,
}: TreeRendererProps) {
  const engine = useMemo(() => createEngine(schema), [schema])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    const allPlugins = [globalContextPlugin(), ...(plugins ?? [])]
    applyPlugins(engine, allPlugins).then(() => {
      if (alive) setReady(true)
    })
    return () => { alive = false }
  }, [engine, plugins])

  if (!ready) {
    return <div className={className} style={style} data-tree-renderer="loading" />
  }

  const root = schema.layout?.root
  if (!root) {
    return <div className={className} style={style} data-tree-renderer="empty">无根节点</div>
  }

  return (
    <div className={className} style={style} data-tree-renderer="ready">
      {renderNode(root, schema, materials, engine, onEvent, new Set())}
    </div>
  )
}

function renderNode(
  nodeId: string,
  schema: PageSchema,
  materials: MaterialRegistry,
  engine: RenderEngine,
  onEvent: TreeRendererProps['onEvent'],
  visiting: Set<string>,
): ReactNode {
  const node = schema.elements?.[nodeId]
  if (!node || visiting.has(nodeId)) {
    return null
  }
  const def = materials.get(node.type)
  if (!def) {
    // 未注册物料: 不白屏, 渲染占位提示
    return <div key={nodeId} data-unregistered={node.type} style={{ padding: 8, color: '#999' }}>[未注册物料: {node.type}]</div>
  }

  const nextVisiting = new Set(visiting)
  nextVisiting.add(nodeId)

  // 普通子节点
  const children = (schema.layout?.structure?.[nodeId]?.children ?? [])
    .map((childId) => renderNode(childId, schema, materials, engine, onEvent, nextVisiting))

  // 具名插槽
  const slots: Record<string, ReactNode> = {}
  const namedSlots = schema.layout?.structure?.[nodeId]?.namedSlots ?? {}
  Object.entries(namedSlots).forEach(([slotName, ids]) => {
    slots[slotName] = ids.map((id) => renderNode(id, schema, materials, engine, onEvent, nextVisiting))
  })

  // 注入节点上下文 (约定 key), 供给物料读写
  injectNodeContext(engine, nodeId, {}, {})
  const context = engine.getContextValues()

  return (
    <div key={nodeId} data-node-id={nodeId} data-node-type={node.type}>
      {def.view({
        props: (node as SchemaNode).props ?? {},
        nodeId,
        children,
        slots,
        context,
        emit: (event, payload) => onEvent?.(nodeId, event, payload),
      })}
    </div>
  )
}
