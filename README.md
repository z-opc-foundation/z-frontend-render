# @yuku123/render

平台共享的**前端渲染引擎**：把后端产出的 schema 变成能看的界面。z-report（报表看板）与 z-lc（低代码）
共用同一套分发、布局与图表适配，两边不再各写一份 ECharts/antd 拼装代码。

设计前提只有一条：**后端是唯一事实源**。视图形状由 Java 侧的 `z-report-common` schema 决定，
本包只做 `option → 组件` 的分发与视觉补全，不做业务校验，也不含任何报表/低代码的业务语义。

## 包结构

| 目录 | 职责 |
| --- | --- |
| `src/contract/` | Java 契约的 TS 镜像。`view.ts` 对 z-report（`ViewSchema` / `WidgetSpec` / `DatasetSchema` / `WidgetOption` …），`field.ts` 对 z-lc（`FieldDefDTO` / `EntityDefDTO` / `FieldTypeDescriptor` / 算子词表）。**只声明形状，不校验**；改 Java 必须同步改这里，否则分发会静默落到兜底分支 |
| `src/renderer/` | `UniversalRenderer`：按 `_widgetType` 分发 + 12 栏栅格摆放；`WidgetShell` 是部件共用外框 |
| `src/renderer/widgets/` | 内置部件：`ChartWidget`(LINE/BAR/PIE)、`KpiWidget`、`TableWidget`、`RawWidget`(任意结构) |
| `src/charts/` | ECharts 适配：`buildChartOption` 补全裸 `xAxis`/缺省 `yAxis`，并剥掉 `_` 前缀的渲染器元信息；`useChart` 管实例生命周期 |
| `src/layout/` | 12 栏栅格算术（`GRID_COLUMNS` / `ROW_H` / `cellStyle` / `totalRows`），与 z-report 后端的布局单位一致 |
| `src/fields/` | 字段类型注册表（Baserow 式）：一个类型条目 owning 单元格渲染/内联编辑/表单/筛选/导出/ coerc 六件事，视图侧不允许 `switch(fieldType)` |
| `playground/` | 独立调试台，不依赖任何后端 |

## 两个入口

包里有两半，服务两个消费方，**不共用一个 barrel**（两边的 `FieldType` 本来就是两个不相干的域）：

| 入口 | 给谁 | 需要的 peer |
| --- | --- | --- |
| `@yuku123/render` | z-report：schema → 看板/图表渲染 | `react` `react-dom` `antd` `echarts`（布局编辑另需 `@dnd-kit/*`）|
| `@yuku123/render/fields` | z-lc：字段注册表 + 运行时值转换 | `react` `react-dom` `antd` `dayjs` `@ant-design/icons` |

```bash
npm i @yuku123/render            # 报表侧
npm i @yuku123/render dayjs @ant-design/icons   # 低代码侧（用到 ./fields）
```

## 用法

```tsx
import UniversalRenderer from '@yuku123/render'

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

## 字段注册表（`@yuku123/render/fields`）

视图侧只跟解析结果打交道，类型分支全在注册表里：

```tsx
import {
  createWorkspaceContext,
  resolveEntityFields,
  readFieldValue,
} from '@yuku123/render/fields'

const ws = createWorkspaceContext({
  appCode, tenantCode,
  entities, dicts, views, fieldTypes,   // 来自后端的 meta bundle
  services: {
    // 引擎不持传输层：REF 选择器的候选由消费方注入（z-lc 接的是 api/runtime.listRecords）
    loadReference: ({ entityCode, appCode, tenantCode, labelField, keyword, page, size }) =>
      listRecords(entityCode, { appCode, tenantCode }, {
        page, size,
        conditions: keyword && labelField ? [{ fieldCode: labelField, operator: 'like', value: keyword }] : [],
      }).then((p) => p.records ?? []),
  },
})

for (const rf of resolveEntityFields(entity, ws)) {
  const { value, displayValue } = readFieldValue(row, rf)
  rf.def.renderCell({ ctx: rf.ctx, row, value, displayValue })   // 单元格
  rf.def.toFieldValue(formValue, rf.ctx)                          // 写回前按 Java 侧 coerce 口径整形
  rf.operators                                                    // 该列能用的筛选算子
}
```

`toFieldValue` 这一层是必须的：后端 `FieldTypeRegistry.coerceValue` 很硬（`Long.parseLong("")`
直接抛、`Boolean.parseBoolean` 把 anything-but-"true" 判成 false、日期只认 `yyyy-MM-dd[ HH:mm:ss]`
不认 ISO/epoch），所以线格式在这里收口，不在视图里散着写。

自定义/覆盖类型走 `registerFieldDefinition`。

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

`react` / `react-dom` / `antd` / `echarts` / `dayjs` / `@ant-design/icons` / `@dnd-kit/*` 都是 peer：
`react >= 18`、`antd >= 5.29 || ^6`，其余标了 `optional`（只有用到对应那半边时才需要装）。

## 发布

`@yuku123/render` 发到 npmjs（组织唯一的 npm 发布口径，和 `@yuku123/z-*-frontend-component` 同一命名空间）：

```bash
npm login --registry=https://registry.npmjs.org/   # 需要 @yuku123 的发布权限
npm version patch                                   # 生产版本，不用 --tag next
npm publish                                          # publishConfig 已固定走 npmjs
```

`~/.npmrc` 默认 registry 是 npmmirror（只读镜像），发包必须靠 `publishConfig.registry` 这一行；
`prepublishOnly` 会先跑测试再重建 dist，避免把旧产物发出去。发布凭证（`@yuku123` scope 的 Granular Token）
按组织惯例记在 `z-biz-tool-lead/004_重要秘钥/npm-token.md`，口径索引见 `z-opc-foundation-lead/004_重要秘钥/npm-token.md`。

发完还要手动推镜像，否则本机 `npm install` 装不到（默认源是镜像不是 npmjs）：

```bash
curl -X PUT https://registry.npmmirror.com/@yuku123%2Frender/sync
npm view @yuku123/render version --registry=https://registry.npmjs.org/    # 冒烟：npmjs 可见
npm view @yuku123/render version --registry=https://registry.npmmirror.com # 冒烟：镜像已同步
```

已发版本：`1.0.0`（2026-09-24）。z-report / z-lc 均以 registry 依赖 `^1.0.0`，不再用 `file:` 或 workspace 直连。

## 边界与待办

- 不含校验：入参合法性由后端产出时保证（契约镜像文件里也不写校验）。
- 不引 `echarts` 的类型包：`ChartOption` 是宽松形状，避免可选 peer 变成类型上的硬依赖。
- 待办：`LayoutEditor`（dnd-kit 拖动配置，需同时兼容 z-report 的 12 栏 `{x,y,w,h}` 与 z-lc 的两栏
  `{viewId,width}`）。
