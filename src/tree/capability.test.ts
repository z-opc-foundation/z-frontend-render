import { describe, expect, it, vi } from 'vitest'
import {
  SchemaLoader,
  registrySource,
  moduleSource,
  extractToolDeclarations,
  exposePageTools,
  globalToolHost,
  setterBehaviors,
  CORE_SETTERS,
  createCoreSetterRegistry,
  buildRegistries,
  BUILTIN_MATERIALS,
  getBuiltinMaterial,
} from './index'
import type { PageSchema } from './contract'

const schema: PageSchema = {
  id: 'p1',
  version: '1.0',
  elements: { root: { type: 'container' } },
  layout: { root: 'root', structure: {} },
  meta: { tools: [{ name: 'submit', description: '提交表单', flowId: 'tool-submit', inputSchema: { type: 'object' } }] },
  logic: { flows: { 'tool-reset': {}, normalFlow: {} } },
}

describe('P2 多源加载策略', () => {
  it('内联来源', async () => {
    const loader = new SchemaLoader()
    expect(loader.list()).toEqual(['inline', 'fetch'])
    const r = await loader.load(schema)
    expect(r.schema.id).toBe('p1')
  })

  it('远程来源 + 缓存', async () => {
    const fetcher = vi.fn().mockResolvedValue(schema)
    const loader = new SchemaLoader({ fetcher })
    const a = await loader.load('page/p1.json', 'fetch')
    const b = await loader.load('page/p1.json', 'fetch')
    expect(a.schema.id).toBe('p1')
    expect(b.schema).toBe(a.schema)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('注册表来源与模块来源', async () => {
    const loader = new SchemaLoader()
    loader.register(registrySource({ p2: { ...schema, id: 'p2' } }))
    expect((await loader.load('p2', 'registry')).schema.id).toBe('p2')

    loader.register(moduleSource({ pkg: { Page: { ...schema, id: 'p3' }, materialHints: [{ name: 'x' }] } }))
    const r = await loader.load({ packageName: 'pkg', exportName: 'Page' } as unknown as PageSchema, 'module')
    expect(r.schema.id).toBe('p3')
    expect(r.materialHints).toEqual([{ name: 'x' }])
  })

  it('自动推断来源 + 未注册报错', async () => {
    const loader = new SchemaLoader()
    expect((await loader.load(schema)).schema).toBe(schema)
    await expect(loader.load(schema, 'nope')).rejects.toThrow('未知 schema 来源')
  })
})

describe('P2 前端工具暴露', () => {
  it('声明 + tool- 约定自动提取', () => {
    const decls = extractToolDeclarations(schema)
    expect(decls.length).toBe(2)
    expect(decls[0]?.name).toBe('submit')
    expect(decls[0]?.flowId).toBe('tool-submit')
    expect(decls[1]?.name).toBe('reset')
  })

  it('注册到宿主并可调用', async () => {
    const invoke = vi.fn().mockReturnValue({ ok: true })
    const tools = exposePageTools(schema, invoke, globalToolHost())
    expect(tools.length).toBe(2)
    const res = await tools[0]?.invoke({ a: 1 })
    expect(res).toEqual({ ok: true })
    expect(invoke).toHaveBeenCalledWith('tool-submit', { a: 1 })
    const g = globalThis as unknown as { __pageTools: Record<string, unknown> }
    expect(g.__pageTools.submit).toBeDefined()
  })
})

describe('P3 setter 体系', () => {
  it('核心 setter 清单 14 个', () => {
    expect(CORE_SETTERS.length).toBe(14)
    const reg = createCoreSetterRegistry()
    expect(reg.list().length).toBe(14)
    expect(reg.has('options')).toBe(true)
  })

  it('行为层 normalize/validate', () => {
    expect(setterBehaviors.number.normalize('12')).toBe(12)
    expect(setterBehaviors.number.validate?.(12)).toBe(true)
    expect(setterBehaviors.number.validate?.(NaN)).toBe(false)
    expect(setterBehaviors.boolean.normalize('x')).toBe(true)
    expect(setterBehaviors.options.normalize([{ label: 'A' }])).toEqual([{ label: 'A', value: 'opt_0' }])
    expect(setterBehaviors.color.normalize('nope')).toBe('#1677ff')
    expect(setterBehaviors.dateFormat.defaultValue()).toBe('YYYY-MM-DD')
  })
})

describe('P3 双注册表 + 具名物料库', () => {
  it('物料库 13 个高频物料', () => {
    expect(BUILTIN_MATERIALS.length).toBe(13)
    expect(getBuiltinMaterial('formContainer')?.config.editConfig).toBeDefined()
  })

  it('设计态含 editConfig，运行时轻量', () => {
    const { design, runtime } = buildRegistries(BUILTIN_MATERIALS)
    expect(design.list().length).toBe(13)
    expect(runtime.list().length).toBe(13)
    expect(design.getEditConfig('input')?.length).toBeGreaterThan(0)
    expect(runtime.get('input')?.view).toBeTypeOf('function')
    expect(runtime.get('input')).not.toHaveProperty('config')
    expect(Object.keys(design.byGroup())).toContain('container')
  })
})
