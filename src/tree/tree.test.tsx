import { Fragment } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TreeRenderer from './TreeRenderer'
import { createMaterialRegistry, type MaterialDefinition } from './material'
import { createEngine, applyPlugins, globalContextPlugin, injectNodeContext } from './plugin'
import type { PageSchema } from './contract'

const divView: MaterialDefinition = {
  config: { type: 'div', title: '容器', group: 'container' },
  view: ({ props, children, slots }) => (
    <div data-testid="div">
      {String(props.text ?? '')}{children}
      {slots ? Object.values(slots).map((node, i) => <Fragment key={i}>{node}</Fragment>) : null}
    </div>
  ),
}
const textView: MaterialDefinition = {
  config: { type: 'text', title: '文本', isAtomic: true, group: 'atom' },
  view: ({ props }) => <span>{String(props.value ?? '')}</span>,
}

const schema: PageSchema = {
  id: 'p1',
  version: '1.0',
  elements: {
    root: { type: 'div', props: { text: 'ROOT' } },
    a: { type: 'text', props: { value: 'A' } },
    b: { type: 'text', props: { value: 'B' } },
    head: { type: 'text', props: { value: 'HEAD' } },
  },
  layout: {
    root: 'root',
    structure: {
      root: { children: ['a', 'b'], namedSlots: { header: ['head'] } },
    },
  },
  context: { global: { theme: 'light' } },
}

describe('TreeRenderer 组件树递归', () => {
  it('递归渲染普通子节点', async () => {
    const reg = createMaterialRegistry([divView, textView])
    render(<TreeRenderer schema={schema} materials={reg} />)
    expect(await screen.findByText('A')).toBeTruthy()
    expect(screen.getByText('B')).toBeTruthy()
    expect(screen.getByText('ROOT')).toBeTruthy()
  })

  it('渲染具名插槽', async () => {
    const reg = createMaterialRegistry([divView, textView])
    render(<TreeRenderer schema={schema} materials={reg} />)
    expect(await screen.findByText('HEAD')).toBeTruthy()
  })

  it('未注册物料降级为占位而非白屏', async () => {
    const broken: PageSchema = {
      ...schema,
      elements: { root: { type: 'unknown-x' } },
      layout: { root: 'root', structure: {} },
    }
    const { container } = render(<TreeRenderer schema={broken} materials={createMaterialRegistry()} />)
    await vi.waitFor(() => expect(container.querySelector('[data-unregistered="unknown-x"]')).toBeTruthy())
  })

  it('emit 事件回调到宿主', async () => {
    const clickable: MaterialDefinition = {
      config: { type: 'button', title: '按钮', eventList: [{ name: 'onClick' }] },
      view: ({ emit }) => <button onClick={() => emit?.('onClick', { x: 1 })}>GO</button>,
    }
    const btnSchema: PageSchema = {
      elements: { root: { type: 'button' } },
      layout: { root: 'root', structure: {} },
    }
    const onEvent = vi.fn()
    const reg = createMaterialRegistry([clickable])
    render(<TreeRenderer schema={btnSchema} materials={reg} onEvent={onEvent} />)
    const btn = await screen.findByText('GO')
    btn.click()
    expect(onEvent).toHaveBeenCalledWith('root', 'onClick', { x: 1 })
  })
})

describe('RenderPlugin 生命周期', () => {
  it('globalContextPlugin 注入全局上下文', async () => {
    const engine = createEngine(schema)
    await applyPlugins(engine, [globalContextPlugin()])
    expect(engine.getContextValue('theme')).toBe('light')
  })

  it('插件按序执行并可覆盖上下文', async () => {
    const engine = createEngine(schema)
    await applyPlugins(engine, [
      { name: 'a', callRenderLogic: (e) => { e.setContextValue('k', 'a') } },
      { name: 'b', callRenderLogic: (e) => { e.setContextValue('k', 'b') } },
    ])
    expect(engine.getContextValue('k')).toBe('b')
  })

  it('injectNodeContext 使用约定 key', () => {
    const engine = createEngine(schema)
    injectNodeContext(engine, 'btn', { value: 1 }, { focus: () => {} })
    expect(engine.getContextValue('btn-variable')).toEqual({ value: 1 })
    expect(typeof (engine.getContextValue('btn-methods') as Record<string, unknown>).focus).toBe('function')
  })
})

describe('MaterialRegistry 物料协议', () => {
  it('注册/覆盖/匹配物料', () => {
    const reg = createMaterialRegistry([textView])
    expect(reg.has('text')).toBe(true)
    expect(reg.list().length).toBe(1)
    const stringMat: MaterialDefinition = {
      config: {
        type: 'input',
        matchInfo: { weight: 5, match: (s) => (s as { type: string })?.type === 'string' },
      },
      view: () => null,
    }
    reg.register(stringMat)
    expect(reg.match({ type: 'string' })?.type).toBe('input')
    expect(reg.match({ type: 'int' })).toBeUndefined()
  })
})
