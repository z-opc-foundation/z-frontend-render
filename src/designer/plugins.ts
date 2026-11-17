import type { EditField, PageSchema, SchemaNode } from '../tree';

/**
 * 设计器插件双钩子（去品牌化自研）。
 *
 * 参考低代码引擎的 IPlugin 把「编辑动作」与「上下文供给」拆成两组切面：
 * - EditorHooks：拦在 schema 变更前后，做校验、自动补属性、联动清理（beforeInsert/afterInsert/beforeRemove/afterPropChange）
 * - ContextHooks：给物料/属性面板注入动态上下文（getEditConfig 可按节点改写属性面板）
 *
 * 渲染侧插件（RenderPlugin.callRenderLogic）在 z-render/tree 里，二者职责不同、互不混淆。
 */

/** 一次插入动作的上下文，钩子可读写 node.props */
export interface InsertHookContext {
  nodeId: string;
  node: SchemaNode;
  parentId: string;
  slot?: string;
  schema: PageSchema;
}

export interface EditorHooks {
  /** 插入前：可改写 node.props 或返回 false 阻止插入 */
  beforeInsert?: (ctx: InsertHookContext) => InsertHookContext | false;
  /** 插入后：做副作用（如自动绑定事件流、选中） */
  afterInsert?: (ctx: InsertHookContext) => void;
  /** 删除前：返回 false 阻止删除 */
  beforeRemove?: (nodeId: string, schema: PageSchema) => boolean;
  /** 属性变更：可改写即将写入的属性 */
  afterPropChange?: (nodeId: string, props: Record<string, unknown>, schema: PageSchema) => Record<string, unknown>;
}

export interface ContextHooks {
  /** 按节点动态改写属性面板字段（如容器才显 slots 字段） */
  getEditConfig?: (node: SchemaNode, base: EditField[] | undefined) => EditField[] | undefined;
}

export interface DesignerPlugin {
  name: string;
  editorHooks?: EditorHooks;
  contextHooks?: ContextHooks;
}

/** 插件宿主：按顺序分发钩子，任一 before 钩子返回 false 即中止 */
export class PluginHost {
  private readonly plugins: DesignerPlugin[] = [];

  use(plugin: DesignerPlugin): this {
    this.plugins.push(plugin);
    return this;
  }

  list(): string[] {
    return this.plugins.map((p) => p.name);
  }

  beforeInsert(ctx: InsertHookContext): InsertHookContext | false {
    let current = ctx;
    for (const p of this.plugins) {
      const next = p.editorHooks?.beforeInsert?.(current);
      if (next === false) return false;
      if (next) current = next;
    }
    return current;
  }

  afterInsert(ctx: InsertHookContext): void {
    this.plugins.forEach((p) => p.editorHooks?.afterInsert?.(ctx));
  }

  beforeRemove(nodeId: string, schema: PageSchema): boolean {
    return this.plugins.every((p) => p.editorHooks?.beforeRemove?.(nodeId, schema) !== false);
  }

  afterPropChange(nodeId: string, props: Record<string, unknown>, schema: PageSchema): Record<string, unknown> {
    let current = props;
    for (const p of this.plugins) {
      const next = p.editorHooks?.afterPropChange?.(nodeId, current, schema);
      if (next) current = next;
    }
    return current;
  }

  getEditConfig(node: SchemaNode, base: EditField[] | undefined): EditField[] | undefined {
    let current = base;
    for (const p of this.plugins) {
      const next = p.contextHooks?.getEditConfig?.(node, current);
      if (next !== undefined) current = next;
    }
    return current;
  }
}

/** 内置插件：插入容器类物料时自动补 padding，删除节点不拦（示例性扩展点） */
export function containerDefaultsPlugin(): DesignerPlugin {
  return {
    name: 'container-defaults',
    editorHooks: {
      beforeInsert: (ctx) => {
        const containerTypes = new Set(['container', 'formContainer']);
        if (containerTypes.has(ctx.node.type) && ctx.node.props?.padding === undefined) {
          return {
            ...ctx,
            node: { ...ctx.node, props: { ...ctx.node.props, padding: 16 } },
          };
        }
        return ctx;
      },
    },
  };
}
