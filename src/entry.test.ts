import { describe, expect, it } from 'vitest'
import DefaultRenderer, { BUILTIN_WIDGETS, UniversalRenderer } from './index'
import * as fields from './fields'

/**
 * 出口形状本身就是契约: 消费方是按 `import X from '@yuku123/render'` 写的,
 * 根入口少一个 default 会等到别人打包时才炸, 所以在这里先守住。
 */
describe('包出口', () => {
  it('根入口同时给 default 与具名的 UniversalRenderer', () => {
    expect(DefaultRenderer).toBe(UniversalRenderer)
    expect(BUILTIN_WIDGETS.RAW).toBeDefined()
  })

  it('字段半边从 ./fields 出口给全注册表与契约', () => {
    expect(typeof fields.createWorkspaceContext).toBe('function')
    expect(typeof fields.getFieldDefinition('STRING')).toBe('object')
    expect(fields.STRUCTURED_OPERATORS).toContain('isNotNull')
    // 引擎不持传输层: 没有注入 services 时 REF 定义依然可用, 只是不发请求
    expect(fields.getFieldDefinition('ref')?.key).toBe('ref')
  })
})
