# 项目总览

## 1. 项目简介

z-frontend-render 是组织共享的**前端渲染引擎**（npm 包 `@yuku123/z-frontend-render`）：后端产出 schema，前端只负责把 schema 变成能看的界面。

设计前提只有一条：**后端是唯一事实源**。视图形状由 Java 侧决定（报表侧的 `*OptionBuilder`、低代码侧的 `FieldTypeHandler`），本包只做 `option → 组件` 的分发与视觉补全，不做业务校验，也不含任何报表/低代码的业务语义。

本仓**不产出可部署应用**，只产出被消费的库：报表侧走默认出口拿 `UniversalRenderer` 与四个内置部件，低代码侧走 `/fields` 子路径拿字段类型注册表与线格式转换。

**技术栈：** TypeScript 5.9（`strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`）· React 18+（peer）· antd 5.29/6 双认（peer）· ECharts 5（可选 peer，运行时懒加载）· Vite 6（lib 模式，ESM 单产物）· Vitest 3 + jsdom

## 2. 模块架构

```
z-frontend-render/
├── package.json              # @yuku123/z-frontend-render 1.1.0：exports / files / peerDependencies / scripts
├── src/
│   ├── index.ts              # 根入口 barrel（含 default 出口 = UniversalRenderer）
│   ├── contract/
│   │   ├── view.ts           # 报表侧契约镜像：ViewSchema / WidgetSpec / DatasetSchema / RenderData / ChartType …
│   │   └── field.ts          # 低代码侧契约镜像：FieldDefDTO / EntityDefDTO / FieldTypeDescriptor / FIELD_TYPES(10)
│   ├── renderer/
│   │   ├── UniversalRenderer.tsx   # BUILTIN_WIDGETS 分发 + CSS Grid 摆放
│   │   ├── WidgetShell.tsx         # 部件共用外框
│   │   ├── types.ts                # WidgetComponent / WidgetProps / WidgetRegistry
│   │   └── widgets/                # ChartWidget / KpiWidget / TableWidget / RawWidget
│   ├── charts/
│   │   ├── option.ts         # buildChartOption / stripRenderMeta / isRenderMetaKey / DEFAULT_PALETTE
│   │   └── useChart.ts       # echarts 实例生命周期（懒 import）
│   ├── layout/grid.ts        # 12 栏栅格算术
│   └── fields/
│       ├── index.ts  types.ts  registry.ts  defaults.ts  coerce.ts  columnRules.ts
│       └── definitions/      # textual / numeric / temporal / selection / reference / shared
├── playground/               # 独立调试台：Playground.tsx / main.tsx / index.html（不依赖后端）
├── vite.config.ts            # playground 用：root = playground，port 5399
├── vite.lib.config.ts        # 库构建用：双入口、ES only、peer 全部 external
├── vitest.config.ts          # environment jsdom + setupFiles src/test/setup.ts
├── tsconfig.json             # strict 等编译口径
└── tsconfig.build.json       # emitDeclarationOnly → dist
```

`src/contract/` 只是 Java 契约的 TS 镜像，**只声明形状、不校验**；改 Java 必须同步改这里，否则分发会静默落到兜底分支。

## 3. 核心功能

### 3.1 schema → 视图分发（`renderer/UniversalRenderer.tsx`）

`BUILTIN_WIDGETS` 把 6 个类型映到 4 个部件：`LINE` / `BAR` / `PIE` → `ChartWidget`，`KPI` → `KpiWidget`，`TABLE` → `TableWidget`，`RAW` → `RawWidget`。`layout` 决定摆哪、`options` 决定摆什么，两边用 `widgetId` 对齐。

兜底策略有三级：`_widgetType` 缺失按 `TABLE`；未注册类型落到 `ChartWidget`（后端先加了类型、引擎还没跟上时按 echarts 图表渲染，而不是白屏）；后端渲染失败没产出 option 的 widget 直接跳过，不阻塞整页。

消费方可通过 `widgetRenderers` prop 追加或覆盖按 `ChartType` 的分发，新图表类型不需要改渲染引擎。

### 3.2 12 栏栅格算术（`layout/grid.ts`）

常量 `GRID_COLUMNS = 12`、`ROW_H = 60`、`DEFAULT_W = 4`、`DEFAULT_H = 2`。`normalizeCell` 收敛缺项与越界坐标（x 夹到 `[0, GRID_COLUMNS - w]`、w 夹到 `[1, GRID_COLUMNS]`、h 至少 1），`cellStyle` 把 0-based 栅格坐标换成 1-based grid-line，`totalRows` 由最深的 `y + h` 定行数。

### 3.3 ECharts option 补全与元信息剥离（`charts/option.ts`）

`buildChartOption` 把后端给的**裸 `xAxis` 数组**补成 `{type:'category'}`、缺 `yAxis` 时补 value 轴，再按直角/饼图语义补 tooltip、grid、legend，色板用 `DEFAULT_PALETTE`（8 色，跟 antd 主色系对齐）。`stripRenderMeta` 剥掉 `_` 前缀的渲染器元信息，`isRenderMetaKey` 是它的判定式。`overrides` 最后浅合并。

### 3.4 图表实例生命周期（`charts/useChart.ts`）

**懒加载** `import('echarts')`：只渲染 KPI/表格的接入方不会被这个 hook 拖进构建依赖。ResizeObserver + window resize 跟随容器，卸载时 dispose。

### 3.5 部件共用外框（`renderer/WidgetShell.tsx`）

标题占固定 `HEADER_H = 34px`，内容撑满剩余空间 —— 图表 resize 需要容器有确定高度。

### 3.6 大数据量护栏

`RawWidget` 的结构树 `MAX_TREE_NODES = 400`、`TableWidget` 的表格 `MAX_RENDER_ROWS = 200`，超出都截断并在界面上写明「仅展示前 N …」。

### 3.7 字段类型注册表（`fields/registry.ts` + `definitions/`）

注册表是包里**唯一**允许解释 `fieldType` / `widget` / `dictCode` / `refEntity` 的地方，视图侧不该出现 `switch (fieldType)`。

- **9 个按 `fieldType` 的主键**：`STRING` / `TEXT` / `JSON` / `INT` / `LONG` / `DECIMAL` / `BOOLEAN` / `DATE` / `DATETIME`。
- **3 个按字段配置而非类型的合成键**：`dict`（字典）、`widget:radio`（单选）、`ref`（引用）。
- **7 个 `widget:*` 覆盖**：`widget:textarea` / `widget:switch` / `widget:datePicker` / `widget:ref` / `widget:reference` / `widget:json` / `widget:input` —— 用于把某个类型指到非默认编辑器（如 `STRING` 配 `widget: "radio"`）。

一个注册表条目 owning 渲染与读写的全套动作：四个渲染面（`renderCell` / `renderEditor` / `renderFormInput` / `renderFilterInput`）+ 三个换算面（`toCellText` / `toFormValue` / `toFieldValue`），另有 `descriptor` / `operators` / `configFields` 能力元数据与可选的 `supportsInlineEdit` / `groupValue`。

### 3.8 线格式收口与字段编码校验

- `fields/coerce.ts`：`toWireValue` / `parseDate` / `formatDate` / `asNumber` / `asBoolean` / `asText` / `isBlank` / `valuesEqual`。
- `fields/columnRules.ts`：`FIELD_CODE_RE = /^[A-Za-z][A-Za-z0-9_]*$/` + `SYSTEM_COLUMN_CODES`（`id` / `tenant_code` / `deleted` / `create_time` / `update_time` 五列），与后端同一口径，让用户在点保存前就看到毛病。
- `fields/defaults.ts`：`DEFAULT_FIELD_TYPES` 回退描述符表 + 5 组算子白名单（TEXT 8 / COMPARE 10 / BOOL 4 / DATE 6 / JSON 4），`sanitizeOperators` 把服务端 advertised 的算子夹到前端真实现了的范围。

## 4. 对外集成 / 上下游

**本仓无对外 HTTP 边界** —— 不监听端口、不出网、不提供服务端；只作为 npm 包被消费。

**两个入口（服务两个消费方，不共用一个 barrel）：**

| 入口 | 出口 | 需要的 peer |
|------|------|-------------|
| `@yuku123/z-frontend-render`（`.`） | `UniversalRenderer`（同时是 default 出口）、`BUILTIN_WIDGETS`、四个内置部件、`WidgetShell`、`buildChartOption` / `stripRenderMeta` / `isRenderMetaKey` / `DEFAULT_PALETTE`、`useChart`、栅格工具、`contract/view` 全部类型 | `react` / `react-dom` / `antd`，图表那半另需 `echarts` |
| `@yuku123/z-frontend-render/fields`（`./fields`） | `createWorkspaceContext` / `resolveField` / `resolveEntityFields` / `readFieldValue` / `registerFieldDefinition` / `getFieldDefinition` / `listFieldDefinitions` / `buildDescriptorIndex` / `DEFAULT_DESCRIPTORS` / `systemFieldDefs` / `isSystemField` / `SYSTEM_FIELD_CODES` / `pickLabelField`，`defaults` 7 项、`coerce` 8 项、`columnRules` 3 项、`definitions/shared`（`ClampedText` / `NullCell` / `inlineKeyHandlers` / `editorFillStyle`），`contract/field` 全部类型 | `react` / `react-dom` / `antd` / `dayjs` / `@ant-design/icons` |

**上游契约来源（对到 Java 侧）：**

| 本包镜像 | 后端来源 |
|----------|----------|
| `contract/view.ts` | 报表侧的 `RenderController`（`@RequestMapping("/api/render")`）的 `GET /api/render/view/{viewId}` 与 `POST /api/render/widget`；`options` 由 6 个 `*OptionBuilder` 产出 |
| `contract/field.ts` + `fields/defaults.ts` | 低代码侧 `MetaController` 的 `GET /api/lc/meta/field-types`（payload = 字段类型注册表的 `describe()`），回退表是它的一份镜像 |

**发布形态：** `publishConfig.registry = https://registry.npmjs.org/` + `access: public`；`files: ["dist", "src"]`（契约镜像连源码一起上包）；产物只有 ESM（`formats: ['es']`、`target: es2020` + sourcemap），**无 CJS 产物**。

## 5. 技术特点

1. **双入口而非单 barrel**：报表侧与低代码侧的 `FieldType` 本来就是两个不相干的域，合一个 barrel 只会同名打架；分开也让报表侧不必为字段层装上 `dayjs` / `@ant-design/icons`。
2. **peer 全部 external**：`vite.lib.config.ts` 用 `isPeer(id)` 把 `react/*` 子路径也一并外部化（`id.startsWith('react/')`），消费方用自己的 node_modules 解析，不会出现两份 React。
3. **`emptyOutDir: false`**：dist 里还有 `tsc` 产出的 `.d.ts`，构建时不能整体清空 —— 库构建与声明构建的产物共用一个目录。
4. **echarts 运行时懒加载**：`useChart` 用 `import('echarts')` 而非顶层 import，只渲染 KPI/表格的接入方不被拖进依赖图。
5. **antd 5.29 / 6 双认**：peer 写成 `>=5.29.0 || ^6.0.0`，因为消费方同时跨两代（报表侧 antd 6 + react 19、低代码侧 antd 5.29.3 + react 18）。`Statistic.styles` / `Tag.variant` 只在 6 上有，`valueStyle` / `bordered` 只在 5 上不弃用 ⇒ 包内一律走两端都认的写法，并靠 `src/test/deprecation.test.tsx` 把内置部件与字段定义的每种渲染跑一遍、断言控制台没有 `deprecated`。
6. **`src/contract/` 只镜像不校验**：契约错误不会在编译期暴露，只会静默落到兜底分支 —— 这是本包最需要小心的设计取舍。
7. **不引 echarts 的类型包**：`ChartOption` 是宽松形状，避免可选 peer 变成类型上的硬依赖。

## 6. 目录结构

本仓无 Java 包树，源码按「契约 / 渲染 / 图表 / 布局 / 字段」五段组织：

```
z-frontend-render/
├── src/
│   ├── index.ts              # 根入口 barrel（具名导出 + default 出口）
│   ├── contract/
│   │   ├── view.ts           # 报表侧契约镜像
│   │   └── field.ts          # 低代码侧契约镜像（FIELD_TYPES 10 值）
│   ├── renderer/
│   │   ├── UniversalRenderer.tsx   # BUILTIN_WIDGETS 分发 + 兜底 + CSS Grid 摆放
│   │   ├── WidgetShell.tsx         # 34px 标题外框
│   │   ├── types.ts                # WidgetComponent / WidgetProps / WidgetRegistry
│   │   └── widgets/
│   │       ├── ChartWidget.tsx     # LINE / BAR / PIE
│   │       ├── KpiWidget.tsx       # KPI
│   │       ├── TableWidget.tsx     # MAX_RENDER_ROWS = 200
│   │       └── RawWidget.tsx       # MAX_TREE_NODES = 400
│   ├── charts/
│   │   ├── option.ts         # option 补全 + 元信息剥离 + 8 色色板
│   │   └── useChart.ts       # echarts 实例生命周期（懒 import）
│   ├── layout/grid.ts        # GRID_COLUMNS 12 / ROW_H 60 / DEFAULT_W 4 / DEFAULT_H 2
│   ├── fields/
│   │   ├── index.ts          # /fields 子路径出口
│   │   ├── types.ts          # 字段定义类型
│   │   ├── registry.ts       # 注册表与解析
│   │   ├── defaults.ts       # 回退描述符 + 5 组算子白名单
│   │   ├── coerce.ts         # 线格式转换 8 项
│   │   ├── columnRules.ts    # 字段编码校验
│   │   └── definitions/      # textual / numeric / temporal / selection / reference / shared
│   └── test/                 # setup.ts（jsdom 垫片）+ deprecation.test.tsx（antd 弃用告警守卫）
├── playground/               # Playground.tsx / main.tsx / index.html
├── vite.config.ts            # playground（port 5399）
├── vite.lib.config.ts        # 库构建（双入口、ES only、peer external）
├── vitest.config.ts          # jsdom + setupFiles
├── tsconfig.json  tsconfig.build.json
└── package.json
```

测试共 8 个用例文件，全部与源码同目录（`src/**`）：`entry.test.ts`（出口形状回归）、`renderer/UniversalRenderer.test.tsx`（分发与兜底）、`renderer/widgets/RawWidget.test.tsx`（截断）、`layout/grid.test.ts`（栅格算术）、`charts/option.test.ts`（option 补全与剥元信息）、`fields/registry.test.ts` + `fields/definitions/reference.test.tsx`（解析与 REF 候选）、`test/deprecation.test.tsx`（antd 弃用告警守卫）。
