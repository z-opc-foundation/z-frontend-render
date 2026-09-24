/**
 * 字段契约 (TypeScript 侧镜像): 与 z-lc 后端的 DTO 逐字段对齐。
 *
 * 单一事实源在 Java (`z-lc-common/.../dto/*.java`、`z-lc-web/.../controller/*.java`),
 * 本文件只做形状声明 + 前端注册表需要的算子词表, 不做校验。
 * 消费方 (z-lc) 的 `src/api/types.ts` 从这里再导出, 不要各留一份。
 *
 * 与 `contract/view.ts` (z-report 的渲染契约) 是两个互不相干的域: 这里的 `FieldType`
 * 是 z-lc 的 10 个 `field_*` 类型, 那里的 `FieldType` 是数据集列类型, 故 fields 半边
 * 只从 `@yuku123/render/fields` 出口暴露, 不与渲染半边共用一个 barrel。
 */

/** `FieldDefDTO.fieldType`. Unknown values must be tolerated at runtime. */
export const FIELD_TYPES = [
  'STRING',
  'INT',
  'LONG',
  'DECIMAL',
  'BOOLEAN',
  'DATE',
  'DATETIME',
  'TEXT',
  'JSON',
  'REF',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** How a cell value is physically represented in a grid row. */
export type CellValueType = 'String' | 'Number' | 'Boolean' | 'DateTime';

/** `ViewConfigDTO.viewType`. */
export const VIEW_TYPES = ['LIST', 'FORM', 'DETAIL', 'KANBAN', 'GALLERY', 'CALENDAR', 'CHART'] as const;
export type ViewType = (typeof VIEW_TYPES)[number];

/**
 * Filter operators implemented by the backend.
 *
 * Two dialects exist and the UI must know both:
 *  1. LEGACY `filters` map — operator is encoded in the key suffix and
 *     `DynamicSqlBuilder.appendLegacyFilter` implements only
 *     eq/like/gt/gte/lt/lte/in, silently degrading anything else to `eq`.
 *     Every condition is ANDed.
 *  2. STRUCTURED `conditions` + `conjunction` — implements the full list below
 *     and honours AND/OR. This is what the grid sends.
 */
export const STRUCTURED_OPERATORS = [
  'eq',
  'ne',
  'like',
  'notLike',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'notIn',
  'isNull',
  'isNotNull',
] as const;
export type FilterOperator = (typeof STRUCTURED_OPERATORS)[number];

/** Operators that the legacy `filters` map can express. */
export const LEGACY_OPERATORS: readonly FilterOperator[] = ['eq', 'like', 'gt', 'gte', 'lt', 'lte', 'in'];

/**
 * `/meta/field-types` may advertise aliases (`notNull`) that the query builder
 * spells differently (`isNotNull`). Normalise so the wire never sees a
 * silent-fallback operator.
 */
const OPERATOR_ALIASES: Record<string, FilterOperator> = {
  eq: 'eq', equals: 'eq',
  ne: 'ne', neq: 'ne', notEq: 'ne',
  like: 'like', contains: 'like',
  notLike: 'notLike', notContains: 'notLike',
  gt: 'gt', gte: 'gte', ge: 'gte',
  lt: 'lt', lte: 'lte', le: 'lte',
  in: 'in', notIn: 'notIn',
  isNull: 'isNull', null: 'isNull',
  isNotNull: 'isNotNull', notNull: 'isNotNull', notEmpty: 'isNotNull',
};

export function normalizeOperator(raw: string | null | undefined): FilterOperator | null {
  if (!raw) return null;
  return OPERATOR_ALIASES[raw] ?? OPERATOR_ALIASES[raw.toLowerCase()] ?? null;
}

/** Operators taking no value. */
export const NULL_OPERATORS: readonly FilterOperator[] = ['isNull', 'isNotNull'];

export type Conjunction = 'AND' | 'OR';

export interface QueryCondition {
  fieldCode: string;
  operator: FilterOperator;
  value?: unknown;
}

export interface QuerySort {
  fieldCode: string;
  dir: 'asc' | 'desc';
}

/** A row from `/api/lc/runtime/list`. Keys are snake_case DB columns. */
export type LcRow = Record<string, unknown>;

export interface FieldDefDTO {
  id?: number | null;
  tenantCode?: string | null;
  entityId?: number | null;
  fieldCode: string;
  fieldName: string;
  /** FieldType, but typed as string: the backend accepts anything and defaults to STRING. */
  fieldType: FieldType | string;
  required?: boolean | null;
  defaultValue?: string | null;
  dictCode?: string | null;
  refEntity?: string | null;
  fieldLength?: number | null;
  scale?: number | null;
  sortOrder?: number | null;
  description?: string | null;
}

export interface EntityDefDTO {
  id?: number | null;
  tenantCode?: string | null;
  appCode: string;
  entityCode: string;
  entityName: string;
  tableName?: string | null;
  description?: string | null;
  currentVersion?: number | null;
  fields?: FieldDefDTO[];
}

export interface DictItemDTO {
  id?: number | null;
  tenantCode?: string | null;
  dictCode: string;
  itemCode: string;
  itemLabel: string;
  itemValue: string;
  sortOrder?: number | null;
  description?: string | null;
}

export interface DictDTO {
  id?: number | null;
  tenantCode?: string | null;
  dictCode: string;
  dictName: string;
  description?: string | null;
  status?: string | null;
  createTime?: string | number | null;
  updateTime?: string | number | null;
  items?: DictItemDTO[];
}

export interface ViewConfigDTO {
  id?: number | null;
  entityCode: string;
  appCode: string;
  viewType: ViewType | string;
  /**
   * JSON *string* — must be parsed on read and stringified on write.
   * Nullable because the `config` column is a nullable TEXT and the Java DTO
   * is a plain `String`: a view row saved without config really does come back
   * as `null`, so callers must handle it.
   */
  config: string | null;
  tenantCode?: string | null;
  createTime?: string | number | null;
  updateTime?: string | number | null;
}

/** Payload of `GET /api/lc/meta/field-types`, one row per `FieldTypeHandler`. */
export interface FieldTypeDescriptor {
  fieldType: string;
  cellValueType: CellValueType;
  label: string;
  dbType: string;
  widget: string;
  sortable: boolean;
  groupable: boolean;
  filterable: boolean;
  inlineEditable: boolean;
  operators: string[];
}

/**
 * 引擎不碰任何传输层: 需要问后端拿数据的定义 (只有 REF 选择器) 通过这里反向调用
 * 消费方注入的实现, 参数即运行时查询契约。缺省时选择器只呈现当前 id。
 */
export interface FieldServices {
  loadReference?(args: {
    entityCode: string;
    appCode: string;
    tenantCode: string;
    /** 关联实体里做人读标签的列, 没有则不按关键字过滤。 */
    labelField?: string;
    keyword: string;
    page: number;
    size: number;
  }): Promise<LcRow[]>;
}
