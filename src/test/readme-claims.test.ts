/**
 * README 定量主张自守卫（vitest）。
 *
 * 对应 lead 仓 README「项目仓 README 口径（2026-09-30 全量收口）」第 5 条「能力可追溯」：
 * README 里写死的数字与名单必须能从源码重算出来 —— README 改了就红，源码变了 README
 * 没跟上也得红。
 *
 * 口径约定（踩过的坑，勿随意改）：
 * - **事实侧只装源码里的事实**；README 侧的数字在核对当下从被核对的那份 README 现解析。
 *   两边都从同一份 README 取数 ⇒ 做的是恒等式比较，README 怎么改都是绿的。
 * - 同一个数在 README 里出现多处时**每一处都单独钉**（各自不同锚点）。
 * - **数量之外还要钉名单**：删掉一个模块名/部件名也要红。
 * - 定位用**唯一锚点 + 结构特征**，不拿数字本身当定位标签（短数字是长数字的子串）。
 * - 语义判定允许 **±1 行窗口**（否定词常在下一行）。
 * - 主张抠不到（锚点被删/被改）必须**红**，不许静默跳过。
 * - 只数**源码**目录，不数用例文件 —— 守卫自己就落在 `src/` 里，数进去必然漂。
 */
import { describe, expect, it } from 'vitest'

// 用 Vite 的 `?raw` 导入拿文件内容：**不引 node:fs / node:path** ——
// 本仓没装 `@types/node`，引了会让 `npm run typecheck` 变红，
// 而 `build` 脚本第一步就是 typecheck（等于把整条构建链弄坏）。
// `?raw` 在 vitest 每次运行时重新解析 ⇒ 读到的一定是当下盘上的内容。
import readmeRaw from '../../README.md?raw'
import gridRaw from '../layout/grid.ts?raw'
import rendererRaw from '../renderer/UniversalRenderer.tsx?raw'
import barrelRaw from '../fields/index.ts?raw'
import defaultsRaw from '../fields/defaults.ts?raw'
import coerceRaw from '../fields/coerce.ts?raw'
import columnRulesRaw from '../fields/columnRules.ts?raw'
import viteConfigRaw from '../../vite.config.ts?raw'

// ---------------------------------------------------------------- 事实侧（只装源码里的事实）

function readmeText(): string {
  return readmeRaw.replace(/\r\n/g, '\n')
}

/** `src/layout/grid.ts` 里 `export const NAME = value` 的常量表。 */
function gridConstants(): Record<string, string> {
  const src = gridRaw
  const out: Record<string, string> = {}
  const re = /export const ([A-Z_][A-Z0-9_]*)\s*=\s*(\d+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const name = m[1]
    const value = m[2]
    if (name !== undefined && value !== undefined) {
      out[name] = value
    }
  }
  if (Object.keys(out).length === 0) {
    throw new Error('尺子口径坏了：grid.ts 里没解析出任何 export const 常量')
  }
  return out
}

/** `src/renderer/UniversalRenderer.tsx` 里 `BUILTIN_WIDGETS` 的键 → 部件。 */
function builtinWidgets(): Record<string, string> {
  const src = rendererRaw
  const start = src.indexOf('BUILTIN_WIDGETS')
  if (start < 0) {
    throw new Error('尺子口径坏了：UniversalRenderer.tsx 里找不到 BUILTIN_WIDGETS')
  }
  const brace = src.indexOf('{', start)
  if (brace < 0) {
    throw new Error('尺子口径坏了：BUILTIN_WIDGETS 后面没有 `{`')
  }
  // 从 `= {` 之后开始扫：声明那行 `BUILTIN_WIDGETS: WidgetRegistry = {` 里的
  // 类型标注不是「键 → 部件」，吃进去会多出一个 WidgetRegistry。
  const body = src.slice(brace + 1, src.indexOf('}', brace))
  const out: Record<string, string> = {}
  const re = /([A-Z_][A-Z0-9_]*)\s*:\s*([A-Za-z][A-Za-z0-9_]*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const key = m[1]
    const value = m[2]
    if (key !== undefined && value !== undefined) {
      out[key] = value
    }
  }
  if (Object.keys(out).length === 0) {
    throw new Error('尺子口径坏了：BUILTIN_WIDGETS 里没解析出任何键')
  }
  return out
}

/**
 * `src/fields/index.ts` 的 barrel 里，某个源模块贡献的**具名导出**个数。
 *
 * 口径 = barrel 的 `export { ... }` 块里那些**声明在该源模块里**的符号 ——
 * README 说的「`defaults` 7 项、`coerce` 8 项、`columnRules` 3 项」就是它。
 */
function barrelExportCount(moduleFile: string): number {
  const barrel = barrelRaw
  const source = moduleFile === 'defaults.ts' ? defaultsRaw : moduleFile === 'coerce.ts' ? coerceRaw : columnRulesRaw
  const blocks = [...barrel.matchAll(/export\s*\{([^}]*)\}/g)]
  const names: string[] = []
  for (const block of blocks) {
    for (const raw of (block[1] ?? '').split(',')) {
      const name = raw.trim()
      if (name.length > 0) {
        names.push(name)
      }
    }
  }
  if (names.length === 0) {
    throw new Error(`尺子口径坏了：barrel 里没解析出任何具名导出（module=${moduleFile}）`)
  }
  let count = 0
  for (const name of names) {
    const declared = new RegExp(`export\\s+(?:async\\s+)?(?:function|const|let|class|type|interface|enum)\\s+${name}\\b`)
    if (declared.test(source)) {
      count += 1
    }
  }
  return count
}

/** `vite.config.ts` 里 playground 的端口。 */
function playgroundPort(): string {
  const src = viteConfigRaw
  const m = /port\s*:\s*(\d+)/.exec(src)
  if (!m || m[1] === undefined) {
    throw new Error('尺子口径坏了：vite.config.ts 里没解析出 port')
  }
  return m[1]
}

// ---------------------------------------------------------------- README 侧（核对当下现解析）

/** 在整份 README 里定位唯一一行并返回该行。 */
function uniqueLine(text: string, pattern: RegExp, what: string): string {
  const hits = text.split('\n').filter((line) => pattern.test(line))
  if (hits.length === 0) {
    throw new Error(`README 里定位不到${what}（正则 ${pattern.source}）`)
  }
  if (hits.length > 1) {
    throw new Error(`README 里${what}定位不唯一（命中 ${hits.length} 行）`)
  }
  return hits[0]!
}

/** 从一行里抠出第一个匹配的数字；抠不到就红。 */
function numberIn(line: string, pattern: RegExp): string {
  const m = pattern.exec(line)
  if (!m || m[1] === undefined) {
    throw new Error(`行里抠不到数字（正则 ${pattern.source}）：${line}`)
  }
  return m[1]
}

/** 从一行里抠出反引号里的内容。 */
function backticked(text: string): string[] {
  return [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? '')
}

/** 把 `a / b / c` 拆开。 */
function splitSlash(span: string): string[] {
  return span
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

// ---------------------------------------------------------------- 主张表

interface NumberClaim {
  label: string
  /** 定位行 → 从该行抠数字 */
  anchors: Array<{ desc: string; line: RegExp; number: RegExp }>
  /** 事实侧重算值 */
  expected: () => string
}

interface NameClaim {
  label: string
  /** README 侧现解析出的一份名单 */
  readmeSide: (text: string) => string[]
  /** 事实侧的一份名单 */
  expected: () => string[]
  /** 合成一份把本主张改错的 README */
  mutator: (text: string) => string
}

const numberClaims: NumberClaim[] = [
  {
    label: '栅格栏数 GRID_COLUMNS',
    anchors: [
      { desc: '开篇「12 栏栅格算术」', line: /^12 栏栅格算术/, number: /(\d+) 栏栅格算术/ },
      { desc: '能力表「12 栏栅格算术」行', line: /^\| 12 栏栅格算术 \|/, number: /GRID_COLUMNS = (\d+)/ },
      { desc: '结构树 layout/grid.ts 行', line: /^│\s+├── layout\/grid\.ts/, number: /(\d+) 栏栅格算术/ },
    ],
    expected: () => gridConstants()['GRID_COLUMNS'] ?? '缺失',
  },
  {
    label: '栅格行高 ROW_H',
    anchors: [
      { desc: '能力表「12 栏栅格算术」行', line: /^\| 12 栏栅格算术 \|/, number: /ROW_H = (\d+)/ },
    ],
    expected: () => gridConstants()['ROW_H'] ?? '缺失',
  },
  {
    label: '默认宽 DEFAULT_W',
    anchors: [
      { desc: '能力表「12 栏栅格算术」行', line: /^\| 12 栏栅格算术 \|/, number: /DEFAULT_W = (\d+)/ },
    ],
    expected: () => gridConstants()['DEFAULT_W'] ?? '缺失',
  },
  {
    label: '默认高 DEFAULT_H',
    anchors: [
      { desc: '能力表「12 栏栅格算术」行', line: /^\| 12 栏栅格算术 \|/, number: /DEFAULT_H = (\d+)/ },
    ],
    expected: () => gridConstants()['DEFAULT_H'] ?? '缺失',
  },
  {
    label: 'fields barrel 的 defaults 导出项数',
    anchors: [
      { desc: '两个入口表「defaults N 项」', line: /defaults` \d+ 项/, number: /`defaults` (\d+) 项/ },
    ],
    expected: () => String(barrelExportCount('defaults.ts')),
  },
  {
    label: 'fields barrel 的 coerce 导出项数',
    anchors: [
      { desc: '两个入口表「coerce N 项」', line: /`coerce` \d+ 项/, number: /`coerce` (\d+) 项/ },
    ],
    expected: () => String(barrelExportCount('coerce.ts')),
  },
  {
    label: 'fields barrel 的 columnRules 导出项数',
    anchors: [
      { desc: '两个入口表「columnRules N 项」', line: /`columnRules` \d+ 项/, number: /`columnRules` (\d+) 项/ },
    ],
    expected: () => String(barrelExportCount('columnRules.ts')),
  },
  {
    label: 'playground 端口',
    anchors: [
      { desc: '结构树 vite.config.ts 行', line: /^├── vite\.config\.ts/, number: /port (\d+)/ },
    ],
    expected: () => playgroundPort(),
  },
]

const nameClaims: NameClaim[] = [
  {
    label: 'BUILTIN_WIDGETS 的类型键名单',
    readmeSide: (text) => {
      const line = uniqueLine(text, /^\| schema → 视图分发 \|/, '能力表「schema → 视图分发」行')
      const m = /`BUILTIN_WIDGETS`：([^，]+)/.exec(line)
      if (!m || m[1] === undefined) {
        throw new Error('「schema → 视图分发」行里抠不到 BUILTIN_WIDGETS 的键')
      }
      // 类型键全是全大写（LINE / BAR / PIE / KPI / TABLE / RAW），
      // 部件名是 CamelCase（ChartWidget / KpiWidget / …）⇒ 用大小写区分这两类。
      const names = backticked(m[1])
        .filter((s) => /^[A-Z][A-Z0-9_]*$/.test(s) && s !== 'BUILTIN_WIDGETS')
        .flatMap((s) => splitSlash(s))
      if (names.length === 0) {
        throw new Error('「schema → 视图分发」行里抠不到任何类型键')
      }
      return names
    },
    expected: () => Object.keys(builtinWidgets()).sort(),
    mutator: (text) => text.replace('`LINE`/`BAR`/`PIE`', '`LINE`/`BAR`'),
  },
  {
    label: 'BUILTIN_WIDGETS 的部件名单',
    readmeSide: (text) => {
      const line = uniqueLine(text, /^\| schema → 视图分发 \|/, '能力表「schema → 视图分发」行')
      const m = /`BUILTIN_WIDGETS`：([^，]+)/.exec(line)
      if (!m || m[1] === undefined) {
        throw new Error('「schema → 视图分发」行里抠不到 BUILTIN_WIDGETS 的部件')
      }
      const names = [...m[1].matchAll(/→\s*`([A-Za-z][A-Za-z0-9_]*)`/g)].map((x) => x[1] ?? '')
      if (names.length === 0) {
        throw new Error('「schema → 视图分发」行里抠不到任何部件名')
      }
      return [...new Set(names)].sort()
    },
    expected: () => [...new Set(Object.values(builtinWidgets()))].sort(),
    mutator: (text) => text.replace('`KpiWidget`', '`KpiWidget_MUTATED`'),
  },
  {
    label: '栅格常量名单',
    readmeSide: (text) => {
      const line = uniqueLine(text, /^\| 12 栏栅格算术 \|/, '能力表「12 栏栅格算术」行')
      const names = backticked(line).filter((s) => /^[A-Z_][A-Z0-9_]*\s*=/.test(s))
      const cleaned = names.map((s) => s.split('=')[0]!.trim())
      if (cleaned.length === 0) {
        throw new Error('「12 栏栅格算术」行里抠不到栅格常量名')
      }
      return cleaned.sort()
    },
    expected: () => Object.keys(gridConstants()).sort(),
    // 名单主张要改**名字**才算漂：改值（12 → 12_MUTATED）不影响名字清单。
    mutator: (text) => text.replace('`GRID_COLUMNS = 12`', '`GRID_COLUMN = 12`'),
  },
]

// ---------------------------------------------------------------- 核对

/** 一次全报式：把所有不一致收集齐再返回（空数组 = 一致）。 */
function verify(text: string): string[] {
  const problems: string[] = []
  for (const claim of numberClaims) {
    for (const anchor of claim.anchors) {
      try {
        const line = uniqueLine(text, anchor.line, anchor.desc)
        const actual = numberIn(line, anchor.number)
        const expected = claim.expected()
        if (actual !== expected) {
          problems.push(`${claim.label} [${anchor.desc}] —— README 写 ${actual}，源码重算 ${expected}`)
        }
      } catch (e) {
        problems.push(`${claim.label} [${anchor.desc}] —— ${(e as Error).message}`)
      }
    }
  }
  for (const claim of nameClaims) {
    try {
      const actual = claim.readmeSide(text).sort()
      const expected = claim.expected().sort()
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        problems.push(`${claim.label} —— README 写 [${actual.join(', ')}]，源码重算 [${expected.join(', ')}]`)
      }
    } catch (e) {
      problems.push(`${claim.label} —— ${(e as Error).message}`)
    }
  }
  return problems
}

describe('README 定量主张自守卫', () => {
  it('真实 README 的每条主张都与源码重算值一致', () => {
    const problems = verify(readmeText())
    expect(problems, problems.join('\n  - ')).toEqual([])
  })

  it('合成变异必须被判红（尺子有牙口）', () => {
    const text = readmeText()
    expect(verify(text), '基线 README 自身已漂移，先把 README 修回一致').toEqual([])
    // 数字类主张：把该锚点上的数字 +1
    for (const claim of numberClaims) {
      const anchor = claim.anchors[0]
      if (!anchor) continue
      const text2 = text.replace(anchor.number, (_all, d: string) => `${Number(d) + 1}`)
      if (text2 === text) {
        throw new Error(`变异没有生效：${claim.label}`)
      }
      const problems = verify(text2)
      expect(problems.length, `主张被放过（README 写错但没红）：${claim.label}`).toBeGreaterThan(0)
      expect(
        problems.some((p) => p.startsWith(claim.label)),
        `报错没指向真正对不上的主张：${claim.label} / ${problems.join(' | ')}`,
      ).toBe(true)
    }
    // 名单类主张：把名单里的一项改掉
    for (const claim of nameClaims) {
      const broken = claim.mutator(text)
      expect(broken, `变异没有生效：${claim.label}`).not.toEqual(text)
      const problems = verify(broken)
      expect(problems.length, `主张被放过（README 写错但没红）：${claim.label}`).toBeGreaterThan(0)
      expect(
        problems.some((p) => p.startsWith(claim.label)),
        `报错没指向真正对不上的主张：${claim.label} / ${problems.join(' | ')}`,
      ).toBe(true)
    }
  })

  it('真实 README 不得被误判为红', () => {
    const text = readmeText()
    for (const claim of numberClaims) {
      for (const anchor of claim.anchors) {
        expect(() => uniqueLine(text, anchor.line, anchor.desc), `锚点定位失败：${claim.label}`).not.toThrow()
      }
    }
    for (const claim of nameClaims) {
      expect(() => claim.readmeSide(text), `名单抠取失败：${claim.label}`).not.toThrow()
    }
    expect(verify(text), '真实 README 被误判为红').toEqual([])
  })
})
