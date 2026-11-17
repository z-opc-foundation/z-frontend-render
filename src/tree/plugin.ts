import type { ReactNode } from 'react'

/**
 * 渲染生命周期上下文: 插件在渲染前拿到整棵 schema 与可变上下文, 注入能力。
 */
export interface RenderEngine {
  /** 当前 schema 的只读快照 */
  getSchema(): unknown
  /** 写入上下文变量 (key 约定 `${nodeId}-variable` / `${nodeId}-methods`) */
  setContextValue(key: string, value: unknown): void
  getContextValue(key: string): unknown
  getContextValues(): Record<string, unknown>
}

/**
 * 渲染插件: 在渲染初始化阶段 (callRenderLogic 等价) 注入 SPI/上下文/方法。
 * 与参考引擎 callRendererLogic(engine) 生命周期对齐。
 */
export interface RenderPlugin {
  name: string
  callRenderLogic?: (engine: RenderEngine) => void | Promise<void>
}

export function createEngine(schema: unknown): RenderEngine {
  const values: Record<string, unknown> = {}
  return {
    getSchema: () => schema,
    setContextValue: (key, value) => { values[key] = value },
    getContextValue: (key) => values[key],
    getContextValues: () => ({ ...values }),
  }
}

/** 依次执行插件的 callRenderLogic 钩子 */
export async function applyPlugins(engine: RenderEngine, plugins: RenderPlugin[]): Promise<void> {
  for (const p of plugins) {
    await p.callRenderLogic?.(engine)
  }
}

/**
 * 一个基础插件: 把 schema.context.global 里的全局配置注入上下文,
 * 让物料渲染时能读到页面级变量 (对应参考引擎的全局上下文注入)。
 */
export function globalContextPlugin(): RenderPlugin {
  return {
    name: 'global-context',
    callRenderLogic: (engine) => {
      const schema = engine.getSchema() as { context?: { global?: Record<string, unknown> } }
      const global = schema?.context?.global
      if (global) {
        Object.entries(global).forEach(([k, v]) => engine.setContextValue(k, v))
      }
    },
  }
}

/** 供物料包装使用的上下文注入辅助: 把 nodeId 的变量/方法挂到约定 key */
export function injectNodeContext(engine: RenderEngine, nodeId: string, vars: Record<string, unknown>, methods: Record<string, unknown>): void {
  engine.setContextValue(`${nodeId}-variable`, vars)
  engine.setContextValue(`${nodeId}-methods`, methods)
}

export type RenderNode = ReactNode
