import '@testing-library/jest-dom/vitest'

// jsdom 没有这几样, antd 组件挂载即报错, 全部补成最小可用实现
class ResizeObserverStub {
  constructor(_callback: ResizeObserverCallback) {}
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

class MatchMediaStub {
  readonly matches = false
  readonly media: string
  onchange: ((e: MediaQueryListEvent) => void) | null = null
  constructor(media: string) {
    this.media = media
  }
  addListener(cb: (e: MediaQueryListEvent) => void): void {
    this.onchange = cb
  }
  removeListener(): void {
    this.onchange = null
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return false
  }
}

beforeEach(() => {
  // restoreMocks 只还原不删除: 上一轮的 stub 实现会残留, 每条用例前重新装一遍
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: ResizeObserverStub as unknown as typeof ResizeObserver,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(window, 'matchMedia', {
    value: ((query: string) => new MatchMediaStub(query)) as unknown as typeof window.matchMedia,
    configurable: true,
    writable: true,
  })
  Element.prototype.scrollIntoView = () => {}
  window.scrollTo = () => {}
})
