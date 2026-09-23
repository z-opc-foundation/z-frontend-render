import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { WidgetOption } from '../../contract/view'
import RawWidget, { MAX_TREE_NODES } from './RawWidget'

const raw = (value: unknown): WidgetOption => ({ _widgetType: 'RAW', type: 'raw', _title: '整形产出', value })

describe('RawWidget 结构树', () => {
  it('任意高维结构按 json 路径展开成可读节点', () => {
    render(
      <RawWidget
        option={raw({
          hangzhou: { total: 150, lines: [{ amount: 100 }, { amount: 50 }] },
          shanghai: { total: 200, lines: [{ amount: 200 }] },
        })}
      />,
    )

    expect(screen.getByText('整形产出')).toBeInTheDocument()
    // 容器节点带基数, 叶子节点直接给值 —— 结构与数据一眼可辨
    expect(screen.getByText(/lines \[2\]/)).toBeInTheDocument()
    expect(screen.getByText('total: 150')).toBeInTheDocument()
    expect(screen.getByText('amount: 50')).toBeInTheDocument()
  })

  it('标量产出也是有效内容, 不能当成空', () => {
    render(<RawWidget option={raw(42)} />)
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.queryByText('整形程序没有产出内容')).not.toBeInTheDocument()
  })

  it('没有产出时给空态而不是白块', () => {
    render(<RawWidget option={raw(null)} />)
    expect(screen.getByText('整形程序没有产出内容')).toBeInTheDocument()
  })

  it('超出节点上限时截断并说明, 不把上万节点塞进 DOM', () => {
    const wide: Record<string, number> = {}
    for (let i = 0; i < MAX_TREE_NODES * 2; i += 1) wide['p' + i] = i
    render(<RawWidget option={raw(wide)} />)

    expect(screen.getByText(`p${MAX_TREE_NODES - 1}: ${MAX_TREE_NODES - 1}`)).toBeInTheDocument()
    expect(screen.queryByText(`p${MAX_TREE_NODES}: ${MAX_TREE_NODES}`)).not.toBeInTheDocument()
    expect(screen.getByText(`仅展示前 ${MAX_TREE_NODES} 个节点`)).toBeInTheDocument()
  })
})
