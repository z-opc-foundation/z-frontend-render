# z-frontend-render

> 平台共享的**前端渲染引擎** —— 后端产出 schema，前端只负责把它变成能看的界面（npm 包 `@yuku123/z-frontend-render`）

一人公司基座里"渲染"这件事只做一遍：z-report（报表看板）与 z-lc（低代码）共用同一套部件分发、
12 栏栅格算术、ECharts 适配与字段类型注册表，两边不再各写一份 antd / echarts 拼装代码。

设计前提只有一条：**后端是唯一事实源**。视图形状由 Java 侧决定（`z-report` 的 `z-report-render`
里那 6 个 `*OptionBuilder`、`z-lc` 的 `FieldTypeHandler`），本包只做 `option → 组件` 的分发与
视觉补全，不做业务校验，也不含任何报表/低代码的业务语义。

---

## 📋 基本信息（全部实测）

| 字段 | 值 |
|------|-----|
| **仓库** | `z-frontend-render`（TypeScript + npm 仓，不走 Maven；2026-10-11 自 z-render 更名，npm 包同步 @yuku123/render → @yuku123/z-frontend-render） |
| **npm 包** | `@yuku123/z-frontend-render`，`type: module` |
| **当前版本** | `1.1.0`（见 [`package.json`](package.json) 的 `version`） |
| **registry 实测** | npmjs latest `1.1.0`，已发版本 `0.0.0-stage` / `1.1.0`（2026-10-19 实测）；**本地 `package.json` 与线上一致**。⚠️ 旧包名 `@yuku123/render` 停在 `1.0.1` —— 那是**另一个包**（2026-10-11 仓与包同日更名，见「仓库」行），别再拿它的版本号当本包的读数 |
| **发布口径** | `publishConfig.registry = https://registry.npmjs.org/` + `access: public`；`files: ["dist", "src"]`（契约镜像连源码一起上包） |
| **入口（exports）** | `.` → `dist/index.js` / `dist/index.d.ts`；`./fields` → `dist/fields.js`（types 落 `dist/fields/index.d.ts`） |
| **产物形态** | 只有 ESM：`vite build --config vite.lib.config.ts`（`formats: ['es']`、`target: es2020`、sourcemap）+ `tsc -p tsconfig.build.json` 出声明；**无 CJS 产物** |
| **peer 口径** | `react` / `react-dom` `>=18.0.0`、`antd` `>=5.29.0 || ^6.0.0` 三者**必需**；`echarts ^5.0.0`、`dayjs >=1.11.0`、`@ant-design/icons >=5.0.0`、`@dnd-kit/*` 标 `optional` |
| **实测消费方** | `z-lc/z-lc-admin-ui` 与 `z-lc/_frontend/z-lc-suit` 依赖 `^1.1.0`（antd `5.29.3` / `18.3.1` 与 `^6.3.3` / `^19.2.0` 两套并存）；`z-opc/bootstraps/z-opc-main-starter-frontend` 依赖 `^1.1.0` —— 三处均已按新包名走 registry。⚠️ `z-report/_frontend`（旧 README 提到的第四个消费方）**不在本工作区、manifest 里也没有**，本机无法核实 |
| **本地预览** | `playground/`（不依赖任何后端），`npm run dev` → `http://localhost:5399` |
| **许可证** | MIT（见 [`LICENSE`](LICENSE)） |
| **最近更新** | 2026-10-11（仓内最后一次提交 `chore: npm pack 产物 *.tgz 不入库`） |

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
| `@yuku123/z-frontend-render` | z-report：schema → 看板/图表 | `UniversalRenderer`（同时是 default 出口）、`BUILTIN_WIDGETS`、四个内置部件、`WidgetShell`、`buildChartOption` / `stripRenderMeta` / `isRenderMetaKey` / `DEFAULT_PALETTE`、`useChart`、栅格工具、`contract/view` 全部类型 | `react` `react-dom` `antd`，图表那半另需 `echarts` |
| `@yuku123/z-frontend-render/fields` | z-lc：字段注册表 + 运行时值转换 | `createWorkspaceContext` / `resolveField` / `resolveEntityFields` / `readFieldValue` / `registerFieldDefinition` / `getFieldDefinition` / `listFieldDefinitions` / `buildDescriptorIndex` / `DEFAULT_DESCRIPTORS` / `systemFieldDefs` / `isSystemField` / `SYSTEM_FIELD_CODES` / `pickLabelField`、`defaults` 7 项、`coerce` 8 项、`columnRules` 3 项、`definitions/shared`（`ClampedText` / `NullCell` / `inlineKeyHandlers` / `editorFillStyle`）、`contract/field` 全部类型 | `react` `react-dom` `antd` `dayjs` `@ant-design/icons` |

`@dnd-kit/*` 目前是**预留**：peer 里声明了、`vite.lib.config.ts` 也把它们外部化了，但 `src/` 里
零引用 —— 拖动配置（`LayoutEditor`）还没落地，见文末待办。

```bash
npm i @yuku123/z-frontend-render                              # 报表侧
npm i @yuku123/z-frontend-render dayjs @ant-design/icons      # 低代码侧（用到 ./fields）
```

实测接入点：`z-report/_frontend/src/pages/ViewPage.jsx` 与 `SharePage.jsx` 走 default 出口；
`z-lc/z-lc-admin-ui/src/views/**`（grid / designer / workspace）走 `/fields`。

---

## 🚀 快速开始

### 用法：报表侧

```tsx
import UniversalRenderer from '@yuku123/z-frontend-render'

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

### 用法：字段注册表（`@yuku123/z-frontend-render/fields`）

视图侧只跟解析结果（`ResolvedField`）打交道，类型分支全在注册表里 —— 注册表是包里**唯一**允许解释
`fieldType` / `widget` / `dictCode` / `refEntity` 的地方，视图侧不该出现 `switch (fieldType)`：

```tsx
import {
  createWorkspaceContext,
  resolveEntityFields,
  readFieldValue,
} from '@yuku123/z-frontend-render/fields'

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
z-frontend-render/
├── package.json              # @yuku123/z-frontend-render 1.1.0：exports / files / scripts / peerDependencies
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
│                              # + readme-claims.test.ts（README 定量主张自守卫）
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
npm test           # vitest run（用例文件全在 src/**，与源码同目录；数量会随新增用例漂移，故只点名不计数）
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

`@yuku123/z-frontend-render` 发到 npmjs（组织唯一的 npm 发布口径，和 `@yuku123/z-*-frontend-component` 同一命名空间）：

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
npm view @yuku123/z-frontend-render version --registry=https://registry.npmjs.org/    # 冒烟：npmjs 可见
npm view @yuku123/z-frontend-render version --registry=https://registry.npmmirror.com # 冒烟：镜像已同步
```

已发版本：`0.0.0-stage`、`1.1.0`（latest = `1.1.0`，2026-10-19 实测）。旧包名 `@yuku123/render` 停在 `1.0.0` / `1.0.1`
（2026-09-24 发布，2026-10-11 随仓更名停更）—— 那两个版本属于**另一个包**，消费方现在一律走 `@yuku123/z-frontend-render@^1.1.0`。
三个消费方（`z-lc/z-lc-admin-ui`、`z-lc/_frontend/z-lc-suit`、`z-opc/bootstraps/z-opc-main-starter-frontend`）
均已按 registry 依赖 `^1.1.0`，不再用 `file:` 或 workspace 直连。

---

## 文档目录

本项目文档统一收口在 `_doc/` 下（八类固定编号表，桶按需存在）:

- [`_doc/001_arch/`](_doc/001_arch/) — 架构、接口、DB schema、协议、路线图

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

---

<!-- z-opc-foundation-sibling-registry:v1 -->
## 🔗 兄弟仓全景（z-opc-foundation 组织）

本仓隶属于 [z-opc-foundation](https://github.com/orgs/z-opc-foundation/repositories) 组织——一人公司基座的全部自研件（现存 61 仓，含私有仓；口径 2026-11-24 GitHub org API 实读）。

| 仓 | 一句话说明 |
|---|---|
| [z-agent](https://github.com/z-opc-foundation/z-agent) | 云端 Agent 平台的库与 starter——ReAct/Plan 实现 + 注册中心 + REST 网关 + 只读控制面 |
| [z-agent-kernel](https://github.com/z-opc-foundation/z-agent-kernel) | Agent 框架基座——消息/工具/记忆/provider/会话 SPI + 轻量默认实现（纯 POJO 无 Spring） |
| [z-asset](https://github.com/z-opc-foundation/z-asset) | 企业资产台账——实物设备全生命周期 + 域名/证书/许可到期提醒 |
| [z-audit](https://github.com/z-opc-foundation/z-audit) | 审计与合规留痕——事件模型 + 哈希链 + 事件出口 SPI + 留存期策略 |
| [z-biz](https://github.com/z-opc-foundation/z-biz) | 商务外壳域——客户/合同/票据/对账四聚合 |
| [z-biz-erp](https://github.com/z-opc-foundation/z-biz-erp) | 进销存 ERP——商品/客商/采购/销售/库存流水/应收应付核销（z-biz 业务线） |
| [z-biz-security](https://github.com/z-opc-foundation/z-biz-security) | 业务数据安全防护入口——场景化策略注册 + 安全线四段流水线对外编排 |
| [z-boot](https://github.com/z-opc-foundation/z-boot) | Spring Boot Starter 聚合仓 + 版本权威（火车制）——唯一消费入口 z-boot-parent |
| [z-bot](https://github.com/z-opc-foundation/z-bot) | 本地 agent 应用——终端 CLI + HTTP/SSE web 控制台 + 多通道 gateway（飞书/钉钉/webhook） |
| [z-cache](https://github.com/z-opc-foundation/z-cache) | RESP2 协议兼容的分布式内存缓存——Java 8 + Netty，Redis 客户端零修改直连 |
| [z-camuda](https://github.com/z-opc-foundation/z-camuda) | 【已退役·归档】基于 Camunda 的工作流封装层（原 z-wf 改名，与现行 z-wf 无共同历史） |
| [z-cognition](https://github.com/z-opc-foundation/z-cognition) | 业务认知域/认知舱——术语/概念/证据链 + memory/kb/ontology 渐进式模块 |
| [z-config](https://github.com/z-opc-foundation/z-config) | 分布式配置中心 + 服务注册中心（类 Nacos）——Netty 长连接推送 + React 控制台 |
| [z-ctc](https://github.com/z-opc-foundation/z-ctc) | 4A 中心——认证/授权/账户/审计，多租户 JWT + SSO 跨子域 |
| [z-dms](https://github.com/z-opc-foundation/z-dms) | 数据源管控底座——统一登记、统一建池、统一探活、变更统一推送 |
| [z-env](https://github.com/z-opc-foundation/z-env) | 本地中间件与基础设施环境——31 个 docker-compose 场景 + make 一键运维 |
| [z-etl](https://github.com/z-opc-foundation/z-etl) | ETL 引擎——DataX 式线性作业 + Flink 式 DAG 流管道（键控状态/水位/窗口） |
| [z-ext](https://github.com/z-opc-foundation/z-ext) | Java 扩展点框架——@ExtPoint/@ExtImpl 运行期选实现，五档侵入方式 |
| [z-frontend-common](https://github.com/z-opc-foundation/z-frontend-common) | 全仓共享前端基座——AppLayout/LoginPage 等前端规范的唯一承载 |
| [z-frontend-markdown](https://github.com/z-opc-foundation/z-frontend-markdown) | Markdown 通用共享组件包（npm）——MarkdownLiveEditor/NoteMarkdown/MermaidBlock 单一真源 |
| [z-frontend-render](https://github.com/z-opc-foundation/z-frontend-render) | 平台共享前端渲染引擎——后端 schema 是唯一事实源，报表与低代码共用 **（本仓）** |
| [z-graph](https://github.com/z-opc-foundation/z-graph) | 独立图数据库——MVCC 版本链存储 + OpenCypher 子集 + Bolt 风格协议 + React 控制台 |
| [z-gw](https://github.com/z-opc-foundation/z-gw) | 自研高性能 API 网关——Netty 手写运行时，Route/Predicate/Filter 模型可嵌 Spring Boot |
| [z-indexer](https://github.com/z-opc-foundation/z-indexer) | 代码索引服务——仓库注册表 + 定时重建索引 + 符号/调用链查询 |
| [z-introduce](https://github.com/z-opc-foundation/z-introduce) | 组织仓库展示站——全仓实测元数据汇总成可搜索静态站点 |
| [z-lc](https://github.com/z-opc-foundation/z-lc) | 低代码平台——DB 驱动通用 CRUD 引擎 + 报表/模型设计框架 |
| [z-llm-agent](https://github.com/z-opc-foundation/z-llm-agent) | CLI Agent 服务化——把本机 CLI agent（CC/Hermes/Qoder 等）暴露成 OpenAI 兼容对话 API |
| [z-llm-gateway](https://github.com/z-opc-foundation/z-llm-gateway) | LLM 网关——OpenAI/Anthropic 双协议面 + 多 vendor 凭据池、限流与 token 记账 |
| [z-llm-msghub](https://github.com/z-opc-foundation/z-llm-msghub) | msgHub 中心消息路由——WebSocket 中心枢纽 + Agent 侧客户端 SDK |
| [z-mask](https://github.com/z-opc-foundation/z-mask) | 脱敏与遮蔽引擎——按敏感命中位置遮蔽，策略即数据 |
| [z-mcp](https://github.com/z-opc-foundation/z-mcp) | MCP 服务端 + 上游聚合网关——Java 8 手写协议层，Spring Boot 自动装配 |
| [z-meta](https://github.com/z-opc-foundation/z-meta) | 元数据管理平台——租户/应用/接口清单登记 + @BizModel 业务模型采集 |
| [z-mill](https://github.com/z-opc-foundation/z-mill) | 资料磨坊——全格式文档转 Markdown/JSON/纯文本/HTML（对标 MinerU） |
| [z-mist](https://github.com/z-opc-foundation/z-mist) | KMS 分布式密钥/秘密管理平台——集中加密存储 + Netty 协议 + starter 嵌入 |
| [z-mq](https://github.com/z-opc-foundation/z-mq) | 自研分布式消息队列——NameServer+Broker+Store，形状对标 RocketMQ、自有 Netty 协议 |
| [z-msg](https://github.com/z-opc-foundation/z-msg) | 多通道消息 + WebSocket 实时下发基础设施——短信/邮件/站内信/Webhook/IM 平台 |
| [z-observer](https://github.com/z-opc-foundation/z-observer) | 可观测性域——指标/日志/链路 + 告警引擎 |
| [z-opc](https://github.com/z-opc-foundation/z-opc) | 一人公司统一后端+统一前端——单 JVM all-in-one 承载协作/Agent/RPA/交易/资产等业务域与自研中间件 |
| [z-opc-foundation-lead](https://github.com/z-opc-foundation/z-opc-foundation-lead) | 组织治理大脑——事实表、强制规范、跨仓工具集、新机器恢复钥匙（本清单权威持有处） |
| [z-opcs](https://github.com/z-opc-foundation/z-opcs) | 任务撮合/服务市场——用户付费发布诉求，持有者接单完成，金额自动瓜分 |
| [z-ops](https://github.com/z-opc-foundation/z-ops) | 个人公司运维平台——部署单元/镜像构建/WebShell/K8s 巡检 + Ops Agent 执行器 |
| [z-oss](https://github.com/z-opc-foundation/z-oss) | 对象存储服务——自持 local 后端 + aliyun/s3 对接层，starter 注入 OssTemplate |
| [z-product](https://github.com/z-opc-foundation/z-product) | 产品设计信息汇总仓（开发域 PM 工件） |
| [z-qa](https://github.com/z-opc-foundation/z-qa) | 步骤式 API 链路测试平台——用例/计划/执行/报告/质量看板（对标 TestRail·MeterSphere） |
| [z-rpa](https://github.com/z-opc-foundation/z-rpa) | RPA 产品皮——应用市场/需求中心（执行归 z-script，触发归 z-schedule） |
| [z-rpc](https://github.com/z-opc-foundation/z-rpc) | Java 8 + Netty RPC 框架——微内核 + SPI 插件化，形状参照 Dubbo/gRPC |
| [z-schedule](https://github.com/z-opc-foundation/z-schedule) | 分布式任务调度中枢（对标 XXL-Job）——选主 + 时间环排期，starter 嵌入宿主 |
| [z-script](https://github.com/z-opc-foundation/z-script) | 多 DSL 脚本平台 + Mock 平台——沙箱执行/版本灰度/可注册 MCP Tool，starter 内嵌 |
| [z-security](https://github.com/z-opc-foundation/z-security) | 数据安全域编排层——场景→策略→识别→脱敏→水印→审计 四段流水线编排 |
| [z-sense](https://github.com/z-opc-foundation/z-sense) | 敏感识别与分类分级引擎——数据安全线底座（规则目录 + 可插拔识别器 + 分类分级） |
| [z-skill](https://github.com/z-opc-foundation/z-skill) | Skill 平台聚合器——归一化各家 Skill 形状，再按各家 API 形状发回 |
| [z-surl](https://github.com/z-opc-foundation/z-surl) | 短网址服务——短码生成/解析/命中统计，starter 一行集成 |
| [z-task](https://github.com/z-opc-foundation/z-task) | 任务协作平台——项目空间/看板/任务卡片（看板范式，对标 Trello·Teambition） |
| [z-team](https://github.com/z-opc-foundation/z-team) | 数字员工协同域——全栈独立仓，自 z-opc 毕业 |
| [z-trade](https://github.com/z-opc-foundation/z-trade) | 交易域独立仓——自 z-opc reactor 迁出 |
| [z-util](https://github.com/z-opc-foundation/z-util) | 底层 Java 工具库——89 个模块 POM，Java 8/17 口径，按需引用按需升级 |
| [z-vector](https://github.com/z-opc-foundation/z-vector) | 自研 Java 向量数据库——嵌入式+可独立部署，ANN+Payload 过滤，兼容 Qdrant REST |
| [z-voice-demo](https://github.com/z-opc-foundation/z-voice-demo) | 语音链路 demo——流式识别→kernel LLM→流式 TTS→可打断 的契约验证实现 |
| [z-watermark](https://github.com/z-opc-foundation/z-watermark) | 水印引擎——显式文字/图片隐写/盲水印，三种技术成对「打+验」 |
| [z-webide](https://github.com/z-opc-foundation/z-webide) | 企业级 WebIDE 后端——Git 仓/共享目录秒变 code-server 实例，全生命周期管理 |
| [z-wf](https://github.com/z-opc-foundation/z-wf) | 自研流程引擎——不依赖 Camunda/Flowable，定义层与运行时全自研 |

**已退役仓**（迁至 [z-trash](https://github.com/z-trash) 组织，archived 只读）：

| 仓 | 说明 |
|---|---|
| [z-agent-proxy](https://github.com/z-trash/z-agent-proxy) | 三方 coding agent 适配代理（Aider/Cursor → kernel Agent SPI），2026-10-26 退役 |
| [z-kb](https://github.com/z-trash/z-kb) | 自研知识库系统（对标 LightRAG/RAGFlow），2026-11 并入 z-cognition 认知舱后退役 |
| [z-ontology](https://github.com/z-trash/z-ontology) | 本体层（TBox/ABox/RDFS 推理），并入 z-cognition 后退役 |

另有 [z-report](https://github.com/z-opc-foundation/z-report)（报表域，2026-10-11 撤销并入 z-lc（远端已删除））。

总清单权威持有处在 [z-opc-foundation-lead](https://github.com/z-opc-foundation/z-opc-foundation-lead) `008_组织规范/005_兄弟仓清单.md`。
