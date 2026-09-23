# @zifang/render

平台共享的**前端渲染引擎**：把后端产出的 schema 变成能看的界面。z-report（报表看板）与 z-lc（低代码）
共用同一套分发、布局与图表适配，两边不再各写一份 ECharts/antd 拼装代码。

设计前提只有一条：**后端是唯一事实源**。视图形状由 Java 侧的 `z-report-common` schema 决定，
本包只做 `option → 组件` 的分发与视觉补全，不做业务校验，也不含任何报表/低代码的业务语义。

## 包结构

| 目录 | 职责 |
| --- | --- |
| `src/contract/` | Java 契约的 TS 镜像（`ViewSchema` / `WidgetSpec` / `DatasetSchema` / `WidgetOption` …）。**只声明形状，不校验**；改 Java 必须同步改这里，否则分发会静默落到兜底分支 |
| `src/renderer/` | `UniversalRenderer`：按 `_widgetType` 分发 + 12 栏栅格摆放；`WidgetShell` 是部件共用外框 |
| `src/renderer/widgets/` | 内置部件：`ChartWidget`(LINE/BAR/PIE)、`KpiWidget`、`TableWidget`、`RawWidget`(任意结构) |
| `src/charts/` | ECharts 适配：`buildChartOption` 补全裸 `xAxis`/缺省 `yAxis`，并剥掉 `_` 前缀的渲染器元信息；`useChart` 管实例生命周期 |
| `src/layout/` | 12 栏栅格算术（`GRID_COLUMNS` / `ROW_H` / `cellStyle` / `totalRows`），与 z-report 后端的布局单位一致 |
| `playground/` | 独立调试台，不依赖任何后端 |

## 用法

```tsx
import UniversalRenderer from '@zifang/render'

// renderData 就是 GET /api/render/view/{id} 的响应
<UniversalRenderer renderData={renderData} />
```

新图表类型不需要改渲染引擎，注册即可（也可以覆盖内置的）：

```tsx
<UniversalRenderer
  renderData={renderData}
  widgetRenderers={{ SCATTER: MyScatter, RAW: MyDrillDownTree }}
/>
```

分发规则：`_widgetType` 缺失按 `TABLE` 处理；未注册的类型落到 `ChartWidget`（后端先加了类型、
引擎还没跟上时按 echarts 图表渲染，而不是白屏）。

## RAW：任意结构也是一种产出

`RAW` 部件没有约定形状。它承载的是后端**对象整形语言**（`z-util/z-util-expr/z-util-expr-obj`）的产出，
整条链路是：

```
库里拿原始数据  →  内存 SQL 粗糙产出二维表  →  对象 DSL 把二维抬成高维结构  →  RAW 渲染
```

整形程序本身就是一段 JSON（步骤数组），写在 widget 的 `shape` 字段上，例如把订单按区域分组、
组内挂明细、再按城市键索引：

```json
[
  {"op": "group", "by": "region", "items": "lines",
   "agg": {"total": "SUM(amount)"},
   "into": {"region": "${region}", "total": "${total}",
            "lines": {"op": "map", "of": "lines",
                      "into": {"city": "${city}", "amount": "${amount}"}}}},
  {"op": "keyBy", "key": "region"}
]
```

后端 `RawOptionBuilder` 原样透传产出（`{type:"raw", value: <任意结构>}`），内置 `RawWidget`
只负责"看得见"——展开成结构树（上限 `MAX_TREE_NODES`，超出截断并说明）。真正按业务形态渲染
（下钻表、思维导图、表单）由使用方注册部件覆盖 `RAW`，契约上只有 `option.value` 这一件事。

## 开发

```bash
npm install
npm run dev        # playground, http://localhost:5399
npm run typecheck  # tsc --noEmit (strict + noUnusedLocals + noUncheckedIndexedAccess)
npm run test       # vitest (jsdom; echarts 被桩掉, 断言喂给它的 option)
npm run build      # ES 产物 + .d.ts, peer 全部外部化
```

`react` / `react-dom` / `antd` / `echarts` / `@dnd-kit/*` 都是 peerDependency：
`react >= 18`、`antd >= 5.29 || ^6`、`echarts ^5`（可选，只有图表部件需要）。
本地联调先用 `file:../z-render`，稳定后改 git tag，不发 npm。

## 边界与待办

- 不含校验：入参合法性由后端产出时保证（契约镜像文件里也不写校验）。
- 不引 `echarts` 的类型包：`ChartOption` 是宽松形状，避免可选 peer 变成类型上的硬依赖。
- 待办：`LayoutEditor`（dnd-kit 拖动配置，需同时兼容 z-report 的 12 栏 `{x,y,w,h}` 与 z-lc 的两栏
  `{viewId,width}`）、字段类型注册表、z-report / z-lc 前端接入。
