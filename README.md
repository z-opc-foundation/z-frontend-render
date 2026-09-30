# z-render

> 平台共享的**前端渲染引擎** —— 后端产出 schema，前端只负责把它变成能看的界面（npm 包 `@yuku123/render`）

一人公司基座里"渲染"这件事只做一遍：z-report（报表看板）与 z-lc（低代码）共用同一套部件分发、
12 栏栅格算术、ECharts 适配与字段类型注册表，两边不再各写一份 antd / echarts 拼装代码。

设计前提只有一条：**后端是唯一事实源**。视图形状由 Java 侧决定（`z-report` 的 `z-report-render`
里那 6 个 `*OptionBuilder`、`z-lc` 的 `FieldTypeHandler`），本包只做 `option → 组件` 的分发与
视觉补全，不做业务校验，也不含任何报表/低代码的业务语义。

---

## 📋 基本信息（全部实测）

| 字段 | 值 |
|------|-----|
| **仓库** | `z-render`（TypeScript + npm 仓，不走 Maven） |
| **npm 包** | `@yuku123/render`，`type: module` |
| **当前版本** | `1.0.1`（见 [`package.json`](package.json) 的 `version`） |
| **registry 实测** | npmjs latest `1.0.1`，已发版本 `1.0.0` / `1.0.1`（均 2026-09-24 发布）；**本地 `package.json` 与线上一致** |
| **发布口径** | `publishConfig.registry = https://registry.npmjs.org/` + `access: public`；`files: ["dist", "src"]`（契约镜像连源码一起上包） |
| **入口（exports）** | `.` → `dist/index.js` / `dist/index.d.ts`；`./fields` → `dist/fields.js`（types 落 `dist/fields/index.d.ts`） |
| **产物形态** | 只有 ESM：`vite build --config vite.lib.config.ts`（`formats: ['es']`、`target: es2020`、sourcemap）+ `tsc -p tsconfig.build.json` 出声明；**无 CJS 产物** |
| **peer 口径** | `react` / `react-dom` `>=18.0.0`、`antd` `>=5.29.0 || ^6.0.0` 三者**必需**；`echarts ^5.0.0`、`dayjs >=1.11.0`、`@ant-design/icons >=5.0.0`、`@dnd-kit/*` 标 `optional` |
| **实测消费方** | `z-report/_frontend` 依赖 `^1.0.1`（antd `^6.3.3` · react `^19.2.0`）；`z-lc/z-lc-admin-ui` 依赖 `^1.0.1`（antd `5.29.3` · react `^18.3.1`）—— 两端确实同时在跑 |
| **本地预览** | `playground/`（不依赖任何后端），`npm run dev` → `http://localhost:5399` |
| **许可证** | MIT（见 [`LICENSE`](LICENSE)） |
| **最近更新** | 2026-09-30 |

---

## 🧩 能力清单（逐条对得上代码）

| 能力 | 实现 | 实测细节 |
|------|------|----------|
| schema → 视图分发 | [`src/renderer/UniversalRenderer.tsx`](src/renderer/UniversalRenderer.tsx) | `BUILTIN_WIDGETS`：`LINE`/`BAR`/`PIE` → `ChartWidget`、`KPI` → `KpiWidget`、`TABLE` → `TableWidget`、`RAW` → `RawWidget`，与后端 6 个 `*OptionBuilder` 一一对应；`layout` 决定摆哪、`options` 决定摆什么，两边用 `widgetId` 对齐 |
| 分发兜底 | 同上 | `_widgetType` 缺失按 `TABLE`；未注册类型落到 `ChartWidget`（后端先加了类型、引擎还没跟上时按 echarts 图表渲染，而不是白屏）；后端渲染失败没产出 option 的 widget 直接跳过，不阻塞整页 |
| 12 栏栅格算术 | [`src/layout/grid.ts`](src/layout/grid.ts) | `GRID_COLUMNS = 12`、`ROW_H = 60`、`DEFAULT_W = 4`、`DEFAULT_H = 2`，`normalizeCell` 收敛缺项/越界坐标，`cellStyle` 把 0-based 栅格坐标换成 1-based grid-line，`totalRows` 由最深的 `y+h` 定行数 |
| ECharts option 补全 | [`src/charts/option.ts`](src/charts/option.ts) | `buildChartOption` 把后端给的**裸 `xAxis` 数组**补成 `{type:'category'}`、缺 `yAxis` 补 value 轴，再按直角/饼图语义给 tooltip、grid、legend、`DEFAULT_PALETTE`（8 色，跟 antd 主色系对齐）；`stripRenderMeta` 剥掉 `_` 前缀的渲染器元信息，`overrides` 最后浅合并 |
| 图表实例生命周期 | [`src/charts/useChart.ts`](src/charts/useChart.ts) | **懒加载** `import('echarts')`：只渲染 KPI/表格的接入方（z-lc 目前就没装 echarts）不会被这个 hook 拖进构建依赖；ResizeObserver + window resize 跟随容器，卸载时 dispose |
| 部件共用外框 | [`src/renderer/WidgetShell.tsx`](src/renderer/WidgetShell.tsx) | 标题占固定 `HEADER_H = 34px`、内容撑满剩余空间（图表 resize 需要容器有确定高度） |
| 大数据量护栏 | [`RawWidget`](src/renderer/widgets/RawWidget.tsx) / [`TableWidget`](src/renderer/widgets/TableWidget.tsx) | 结构树 `MAX_TREE_NODES = 400`、表格 `MAX_RENDER_ROWS = 200`，超出都截断并在界面上写明"仅展示前 N …" |
| 字段类型注册表 | [`src/fields/registry.ts`](src/fields/registry.ts) + `definitions/` | 见下面「字段注册表」 |
| 线格式收口 | [`src/fields/coerce.ts`](src/fields/coerce.ts) | `toWireValue` / `parseDate` / `formatDate` / `asNumber` / `asBoolean` / `asText` / `isBlank` / `valuesEqual` |
| 字段编码校验口径 | [`src/fields/columnRules.ts`](src/fields/columnRules.ts) | `FIELD_CODE_RE = /^[A-Za-z][A-Za-z0-9_]*$/` + `SYSTEM_COLUMN_CODES`（`id`/`tenant_code`/`deleted`/`create_time`/`update_time` 五列），与后端 `SchemaAdminBizService` 同一口径，让用户在点保存前就看到毛病 |
| 描述符回退表 | [`src/fields/defaults.ts`](src/fields/defaults.ts) | 10 行 `DEFAULT_FIELD_TYPES` + 5 组算子白名单（TEXT 8 / COMPARE 10 / BOOL 4 / DATE 6 / JSON 4），`sanitizeOperators` 把服务端 advertised 的算子夹到前端真实现了的范围 |

---

## 📦 两个入口（服务两个消费方，不共用一个 barrel）

两边的 `FieldType` 本来就是两个不相干的域（报表侧是 `STRING/INT/DOUBLE/BOOL/DATE`，
低代码侧是 10 个 Java `FieldTypeHandler`），合一个 barrel 只会同名打架：

| 入口 | 给谁 | 出口 | 需要的 peer |
|------|------|------|-------------|
| `@yuku123/render` | z-report：schema → 看板/图表 | `UniversalRenderer`（同时是 default 出口）、`BUILTIN_WIDGETS`、四个内置部件、`WidgetShell`、`buildChartOption` / `stripRenderMeta` / `isRenderMetaKey` / `DEFAULT_PALETTE`、`useChart`、栅格工具、`contract/view` 全部类型 | `react` `react-dom` `antd`，图表那半另需 `echarts` |
| `@yuku123/render/fields` | z-lc：字段注册表 + 运行时值转换 | `createWorkspaceContext` / `resolveField` / `resolveEntityFields` / `readFieldValue` / `registerFieldDefinition` / `getFieldDefinition` / `listFieldDefinitions` / `buildDescriptorIndex` / `DEFAULT_DESCRIPTORS` / `systemFieldDefs` / `isSystemField` / `SYSTEM_FIELD_CODES` / `pickLabelField`、`defaults` 7 项、`coerce` 8 项、`columnRules` 3 项、`definitions/shared`（`ClampedText` / `NullCell` / `inlineKeyHandlers` / `editorFillStyle`）、`contract/field` 全部类型 | `react` `react-dom` `antd` `dayjs` `@ant-design/icons` |

`@dnd-kit/*` 目前是**预留**：peer 里声明了、`vite.lib.config.ts` 也把它们外部化了，但 `src/` 里
零引用 —— 拖动配置（`LayoutEditor`）还没落地，见文末待办。

```bash
npm i @yuku123/render                              # 报表侧
npm i @yuku123/render dayjs @ant-design/icons      # 低代码侧（用到 ./fields）
```

实测接入点：`z-report/_frontend/src/pages/ViewPage.jsx` 与 `SharePage.jsx` 走 default 出口；
`z-lc/z-lc-admin-ui/src/views/**`（grid / designer / workspace）走 `/fields`。

---

## 🚀 快速开始

### 用法：报表侧

```tsx
import UniversalRenderer from '@yuku123/render'

// renderData 就是 GET /api/render/view/{viewId} 的响应
<UniversalRenderer renderData={renderData} />
```

新图表类型不需要改渲染引擎，注册即可（也可以覆盖内置的）：

```tsx
<UniversalRenderer
  renderData={renderData}
  widgetRenderers={{ SCATTER: MyScatter, RAW: MyDrillDownTree }}
/>
```

`UniversalRendererProps` 另有 `rowHeight`（默认 `ROW_H = 60`）、`gap`（默认 12）、`loadingText`、
`className`、`style`；`renderData` 为空时渲染 Spin 占位，`layout` 里没有可渲染部件时渲染 antd `Empty`。

### 用法：字段注册表（`@yuku123/render/fields`）

视图侧只跟解析结果（`ResolvedField`）打交道，类型分支全在注册表里 —— 注册表是包里**唯一**允许解释
`fieldType` / `widget` / `dictCode` / `refEntity` 的地方，视图侧不该出现 `switch (fieldType)`：

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

一个注册表条目 owning 渲染与读写的全套动作：`renderCell` / `renderEditor` / `renderFormInput` /
`renderFilterInput` 四个渲染面，加 `toCellText`（CSV 导出、剪贴板）、`toFormValue`（行值 → 受控组件值）、
`toFieldValue`（受控组件值 → 请求载荷）三个换算面，另有 `descriptor` / `operators` / `configFields`
能力元数据和可选的 `supportsInlineEdit` / `groupValue`。

内置条目（`registry.ts` 实测注册顺序）：9 个按 `fieldType` 的主键
`STRING` / `TEXT` / `JSON` / `INT` / `LONG` / `DECIMAL` / `BOOLEAN` / `DATE` / `DATETIME`，
2 个按字段配置而非类型的合成键 `dict` / `ref`（`getFieldDefinition('REF')` 这类大写别名也在这里收口），
再加 8 个 `widget:*` 覆盖（`radio` / `textarea` / `switch` / `datePicker` / `ref` / `reference` / `json` / `input`），
用于 `/meta/field-types` 把某个类型指到非默认编辑器的场景。自定义或覆盖类型走 `registerFieldDefinition`。

`toFieldValue` 这一层是必须的：后端 `FieldTypeRegistry.coerceValue` 只认它自己那套写法 ——
空白串必须先归一成 `null`（否则 `LongBackedTypeHandler` / `AbstractDateTimeTypeHandler` 抛
`IllegalArgumentException`），`DATE` / `DATETIME` 走 `SimpleDateFormat("yyyy-MM-dd"[, " HH:mm:ss"])`，
ISO-8601 与 epoch 毫秒都不认。所以线格式在这里收口，不在视图里散着写。

---

## 🏗️ 项目结构

```
z-render/
├── package.json              # @yuku123/render 1.0.1：exports / files / scripts / peerDependencies
├── src/
│   ├── index.ts              # 根入口 barrel（含 default 出口 = UniversalRenderer）
│   ├── contract/
│   │   ├── view.ts           # z-report 契约镜像：ViewSchema / WidgetSpec / DatasetSchema / WidgetOption / RenderData / ChartType …
│   │   └── field.ts          # z-lc 契约镜像：FieldDefDTO / EntityDefDTO / FieldTypeDescriptor / FIELD_TYPES(10) / 算子词表
│   ├── renderer/
│   │   ├── UniversalRenderer.tsx   # BUILTIN_WIDGETS 分发 + CSS Grid 摆放
│   │   ├── WidgetShell.tsx         # 部件共用外框
│   │   ├── types.ts                # WidgetComponent / WidgetProps / WidgetRegistry
│   │   └── widgets/                # ChartWidget / KpiWidget / TableWidget / RawWidget
│   ├── charts/
│   │   ├── option.ts         # buildChartOption / stripRenderMeta / isRenderMetaKey / DEFAULT_PALETTE
│   │   └── useChart.ts       # echarts 实例生命周期（懒 import）
│   ├── layout/grid.ts        # 12 栏栅格算术，与 z-report 后端的布局单位一致
│   ├── fields/
│   │   ├── index.ts  types.ts  registry.ts  defaults.ts  coerce.ts  columnRules.ts
│   │   └── definitions/      # textual / numeric / temporal / selection / reference / shared
│   └── test/                 # setup.ts（jsdom 垫片）+ deprecation.test.tsx（antd 弃用告警守卫）
├── playground/               # 独立调试台：Playground.tsx / main.tsx / index.html，不依赖后端
├── vite.config.ts            # playground 用：root = playground, port 5399
├── vite.lib.config.ts        # 库构建用：两入口、ES only、peer 全部 external
├── vitest.config.ts          # environment jsdom + setupFiles src/test/setup.ts
├── tsconfig.json             # strict + noUnusedLocals + noUncheckedIndexedAccess + verbatimModuleSyntax
├── tsconfig.build.json       # emitDeclarationOnly → dist
└── dist/                     # 构建产物（.gitignore 已忽略，不是源码）
```

`src/contract/` 只是 Java 契约的 TS 镜像，**只声明形状、不校验**；改 Java 必须同步改这里，
否则分发会静默落到兜底分支。

---

## 🔧 技术栈

| 层级 | 技术（均来自 `package.json` 实测） |
|------|------|
| 语言 | TypeScript `^5.9.3`，`strict` + `noUncheckedIndexedAccess` + `noUnusedLocals`/`noUnusedParameters` + `verbatimModuleSyntax` |
| UI | antd（peer `>=5.29.0 \|\| ^6.0.0`，devDep `^6.3.3`）· `@ant-design/icons >=5.0.0`（可选 peer） |
| 图表 | ECharts `^5.0.0`（可选 peer，运行时懒 import；不引类型包，`ChartOption` 是宽松形状） |
| 运行时 | React `>=18.0.0`（devDep `^19.2.0`） |
| 日期 | dayjs `>=1.11.0`（可选 peer，只在 `/fields` 侧用到） |
| 构建 | Vite `^6.2.0`（`build.lib` 双入口，ES only）+ `tsc` 出声明；`type: module` |
| 测试 | Vitest `^3.2.4` + jsdom `^25` + Testing Library（`@testing-library/react` `^16.3.3`） |

---

## 🛠️ 开发

```bash
npm install
npm run dev        # playground（vite，root=playground），http://localhost:5399
npm run typecheck  # tsc -p tsconfig.json --noEmit
npm test           # vitest run
npm run test:watch # vitest（watch）
npm run build      # typecheck → clean → vite build --config vite.lib.config.ts → tsc -p tsconfig.build.json
```

另有 `npm run preview`（vite preview）与 `npm run clean`（删 `dist`）。`playground/` 是本地预览台，
不依赖 z-report / z-lc 后端；`dist/` 是构建产物、`node_modules/` 是依赖，都不是源码。

### 契约来源（对到 Java 侧）

| 本包镜像 | 后端来源 |
|----------|----------|
| `contract/view.ts` | z-report `RenderController`（`@RequestMapping("/api/render")`）的 `GET /api/render/view/{viewId}` 与 `POST /api/render/widget`；`options` 由 `z-report-render` 的 `LineOptionBuilder` / `BarOptionBuilder` / `PieOptionBuilder` / `KpiOptionBuilder` / `TableOptionBuilder` / `RawOptionBuilder` 产出 |
| `contract/field.ts` + `fields/defaults.ts` | z-lc `MetaController` 的 `GET /api/lc/meta/field-types`（payload = `FieldTypeRegistry.describe()`），回退表就是它的一份镜像 |

### antd 5.29 / 6 双认（组织级约束，实测成立）

引擎被多个仓共用，而消费方**同时**跨 antd 两代：`z-lc/z-lc-admin-ui` 钉 `5.29.3`（react 18.3.1），
`z-report/_frontend` 跑 `^6.3.3`（react 19.2.0）。所以包口径写成 `antd >=5.29.0 || ^6.0.0`，
**碰 antd 的 API 必须两端都存在**。

`5.29.3` 是 antd 5 的最后一版，`Statistic.styles` / `Tag.variant` 这类新 API 只在 6 上有，
`valueStyle` / `bordered` 只在 5 上不弃用 —— 用哪一头都会在另一头静默失效（生产构建不打弃用告警，
坏掉的样式不会报错）。包内一律走两端都认的写法：KPI 字号写在 `Statistic.valueRender` 的 span 上
（见 `src/renderer/widgets/KpiWidget.tsx`），无框观感直接写 `style.borderColor`
（见 `src/fields/definitions/selection.tsx`）。`src/test/deprecation.test.tsx` 会把内置部件与内置字段
定义的每种渲染全跑一遍，并断言控制台没有 `deprecated`。本仓 devDeps 装的是 antd 6，5.29 那一头由
z-lc 自己的用例与页面守住。

---

## 🧪 测试

```bash
npm test           # vitest run（8 个用例文件，全在 src/**，与源码同目录）
```

- 环境是 jsdom；`src/test/setup.ts` 补 `ResizeObserver` / `matchMedia` / `scrollIntoView` / `scrollTo`
  四个 jsdom 缺的最小实现（antd 组件挂载即需要），并在每条用例前重装，因为 `restoreMocks` 只还原不删除。
- echarts 在 `UniversalRenderer.test.tsx` 与 `deprecation.test.tsx` 里被 `vi.mock` 桩掉，
  断言的是**喂给它的 option**（懒 import 的那条路径也照样能被拦下）；
  `src/charts/option.test.ts` 则直接单测 `buildChartOption` 的补全与剥元信息。
- 其余：`src/entry.test.ts`（出口形状回归，守住 default 出口）、`renderer/UniversalRenderer.test.tsx`
  （分发与兜底）、`widgets/RawWidget.test.tsx`（截断）、`layout/grid.test.ts`（栅格算术）、
  `fields/registry.test.ts` + `fields/definitions/reference.test.tsx`（解析与 REF 候选）。
- 这些用例不需要外部服务（不起后端、不连库），但需要先 `npm install`。

---

## 🚢 发布

`@yuku123/render` 发到 npmjs（组织唯一的 npm 发布口径，和 `@yuku123/z-*-frontend-component` 同一命名空间）：

```bash
npm login --registry=https://registry.npmjs.org/   # 需要 @yuku123 的发布权限
npm version patch                                  # 生产版本，不用 --tag next
npm publish                                        # publishConfig 已固定走 npmjs
```

`prepublishOnly` 会先跑测试再重建 dist，避免把旧产物发出去。发布凭证用 `@yuku123` scope 的
Granular Access Token（环境变量名 `NPM_TOKEN`），**值不进 README、不进仓**；
口径索引见 `z-opc-foundation-lead/004_重要秘钥/README.md`。

本机默认 registry 是只读镜像，发完还要手动推镜像，否则 `npm install` 装不到新版本：

```bash
curl -X PUT https://registry.npmmirror.com/@yuku123%2Frender/sync
npm view @yuku123/render version --registry=https://registry.npmjs.org/    # 冒烟：npmjs 可见
npm view @yuku123/render version --registry=https://registry.npmmirror.com # 冒烟：镜像已同步
```

已发版本：`1.0.0`、`1.0.1`（均 2026-09-24，latest = `1.0.1`，1.0.1 那次改的就是上面的 antd 双认写法）。
两个下游均已按 registry 依赖 `^1.0.1`，不再用 `file:` 或 workspace 直连。

---

## 📄 License

MIT，见 [`LICENSE`](LICENSE)（`package.json` 的 `license` 字段同为 MIT）。

---

## 边界与待办

- 不含校验：入参合法性由后端产出时保证（契约镜像文件里也不写校验）。
- 不引 `echarts` 的类型包：`ChartOption` 是宽松形状，避免可选 peer 变成类型上的硬依赖。
- 只出 ESM：没有 CJS 产物，接入方需走 `type: module` / bundler 解析。
- 待办：`LayoutEditor`（dnd-kit 拖动配置，需同时兼容 z-report 的 12 栏 `{x,y,w,h}` 与 z-lc 的两栏
  `{viewId,width}`）；`TableWidget` 的分页要等后端给出切片 API，目前只截前 200 行。

_Maintained by the z-opc-foundation organization._
