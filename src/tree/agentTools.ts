import type { PageSchema } from './contract'

/**
 * 前端工具暴露：把页面里的逻辑流包装成宿主/Agent 可调用的工具。
 *
 * 去品牌化设计：不使用任何特定 Agent 产品名，统一挂到宿主的 `tools` 注册表
 * （默认挂 globalThis.__pageTools），宿主可替换挂载目标，天然可对接任意 Agent。
 *
 * 约定：schema.meta.tools 里声明 { name, description, flowId, inputSchema? } 的条目，
 * 或逻辑流 id 以 `tool-` 开头时自动暴露。
 */
export interface PageTool {
  name: string
  description?: string
  flowId: string
  inputSchema?: Record<string, unknown>
  invoke: (args?: Record<string, unknown>) => Promise<unknown>
}

export interface ToolHost {
  register(name: string, tool: PageTool): void
}

/** 默认宿主：挂到全局对象，供前端 Agent 发现 */
export function globalToolHost(): ToolHost {
  const g = globalThis as unknown as { __pageTools?: Record<string, PageTool> }
  if (!g.__pageTools) g.__pageTools = {}
  return {
    register(name, tool) {
      g.__pageTools![name] = tool
    },
  }
}

/**
 * 从 schema 提取工具声明（纯函数，便于测试与 SSR）。
 */
export function extractToolDeclarations(schema: PageSchema): Array<Omit<PageTool, 'invoke'>> {
  const declared = (schema.meta?.tools as Array<Record<string, unknown>> | undefined) ?? []
  const out: Array<Omit<PageTool, 'invoke'>> = []
  for (const d of declared) {
    if (!d.name || !d.flowId) continue
    out.push({
      name: String(d.name),
      description: d.description ? String(d.description) : undefined,
      flowId: String(d.flowId),
      inputSchema: d.inputSchema as Record<string, unknown> | undefined,
    })
  }
  // 约定：id 以 tool- 开头且未被显式声明的逻辑流自动暴露
  const flows = schema.logic?.flows ?? {}
  Object.keys(flows).forEach((flowId) => {
    if (flowId.startsWith('tool-') && !out.some((t) => t.flowId === flowId)) {
      out.push({ name: flowId.slice(5), flowId })
    }
  })
  return out
}

/**
 * 把 schema 里的逻辑流注册为工具。
 *
 * @param invoke 运行器：给定 flowId + 参数执行逻辑流，通常由宿主接到逻辑引擎
 */
export function exposePageTools(
  schema: PageSchema,
  invoke: (flowId: string, args?: Record<string, unknown>) => Promise<unknown> | unknown,
  host: ToolHost = globalToolHost(),
): PageTool[] {
  const tools = extractToolDeclarations(schema).map((decl) => ({
    ...decl,
    invoke: (args?: Record<string, unknown>) => Promise.resolve(invoke(decl.flowId, args)),
  }))
  tools.forEach((t) => host.register(t.name, t))
  return tools
}
