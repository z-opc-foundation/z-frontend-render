import type { PageSchema } from './contract'

/**
 * 多源加载策略（对应参考引擎 6 种加载源，去品牌化后收敛为 4 类 + 自定义）。
 *
 * 统一返回 LoadResult: { schema, materialHints? }，上层渲染器无差别消费。
 * 新增来源 = 实现一个 SchemaSource 并注册，调用方不改。
 */
export interface LoadResult {
  schema: PageSchema
  /** 该来源附带的物料/模块提示（如按需加载的 UMD 清单），交给宿主解析 */
  materialHints?: Array<Record<string, unknown>>
}

/** 加载上下文：给 source 提供 fetch/缓存等宿主能力 */
export interface LoadContext {
  fetcher?: (url: string) => Promise<unknown>
  cache?: Map<string, Promise<LoadResult>>
  baseUrl?: string
}

export interface SchemaSource {
  name: string
  load(input: string | PageSchema, ctx: LoadContext): Promise<LoadResult>
}

/** ① 内联来源：直接传 schema 对象 */
export const inlineSource: SchemaSource = {
  name: 'inline',
  async load(input) {
    if (typeof input !== 'object' || input === null) {
      throw new Error('[inline] 需要一个 PageSchema 对象')
    }
    return { schema: input as PageSchema }
  },
}

/** ② 远程获取：传 URL，用宿主 fetcher */
export const fetchSource: SchemaSource = {
  name: 'fetch',
  async load(input, ctx) {
    if (typeof input !== 'string') throw new Error('[fetch] 需要一个 URL 字符串')
    const fetcher = ctx.fetcher ?? defaultFetcher
    const data = await fetcher(resolveUrl(input, ctx.baseUrl))
    return normalizeRemote(data)
  },
}

/** ③ 注册表来源：按 name 从宿主的 schema 映射取 */
export function registrySource(schemas: Record<string, PageSchema>): SchemaSource {
  return {
    name: 'registry',
    async load(input) {
      const key = typeof input === 'string' ? input : input.id
      const schema = key ? schemas[key] : undefined
      if (!schema) throw new Error(`[registry] 未找到 schema: ${key}`)
      return { schema }
    },
  }
}

/** ④ 模块来源：传 { packageName, exportName }，从已加载的模块对象取（JSONP/UMD 兼容） */
export function moduleSource(modules: Record<string, unknown>): SchemaSource {
  return {
    name: 'module',
    async load(input) {
      const spec = input as { packageName?: string; exportName?: string }
      const mod = spec.packageName ? modules[spec.packageName] : undefined
      const schema = mod && spec.exportName
        ? (mod as Record<string, unknown>)[spec.exportName]
        : mod
      if (!schema) throw new Error('[module] 未找到模块 schema')
      return { schema: schema as PageSchema, materialHints: (mod as { materialHints?: Array<Record<string, unknown>> })?.materialHints }
    },
  }
}

function defaultFetcher(url: string): Promise<unknown> {
  if (typeof fetch === 'function') return fetch(url).then((r) => r.json())
  throw new Error('[fetch] 当前环境无 fetch，请通过 LoadContext.fetcher 注入')
}

function resolveUrl(url: string, base?: string): string {
  if (!base || /^https?:\/\//i.test(url)) return url
  return `${base.replace(/\/$/, '')}/${url.replace(/^\//, '')}`
}

function normalizeRemote(data: unknown): LoadResult {
  if (data && typeof data === 'object' && 'schema' in (data as object)) {
    const d = data as { schema: PageSchema; materialHints?: Array<Record<string, unknown>> }
    return { schema: d.schema, materialHints: d.materialHints }
  }
  return { schema: data as PageSchema }
}

/** SchemaLoader：持有来源表，按 source 名分发，带 Promise 级缓存 */
export class SchemaLoader {
  private readonly sources = new Map<string, SchemaSource>()
  private readonly cache = new Map<string, Promise<LoadResult>>()
  private readonly ctx: LoadContext

  constructor(ctx: LoadContext = {}) {
    this.ctx = { ...ctx, cache: this.cache }
    this.register(inlineSource).register(fetchSource)
  }

  register(source: SchemaSource): this {
    this.sources.set(source.name, source)
    return this
  }

  has(name: string): boolean {
    return this.sources.has(name)
  }

  list(): string[] {
    return Array.from(this.sources.keys())
  }

  /**
   * 加载：source 可显式指定；未指定时自动推断（对象→inline，字符串→fetch）。
   */
  async load(input: string | PageSchema, source?: string): Promise<LoadResult> {
    const name = source ?? (typeof input === 'string' ? 'fetch' : 'inline')
    const impl = this.sources.get(name)
    if (!impl) throw new Error(`未知 schema 来源: ${name}`)

    const cacheKey = `${name}:${typeof input === 'string' ? input : (input.id ?? 'inline')}`
    const cached = this.cache.get(cacheKey)
    if (cached) return cached

    const task = impl.load(input, this.ctx).catch((err) => {
      this.cache.delete(cacheKey)
      throw err
    })
    this.cache.set(cacheKey, task)
    return task
  }

  clearCache(): void {
    this.cache.clear()
  }
}
