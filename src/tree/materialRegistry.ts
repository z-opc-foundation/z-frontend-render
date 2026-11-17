import type { MaterialDefinition, MaterialConfig } from './material'

/**
 * 双注册表（对应参考引擎 materials 设计态 / components 渲染态分离）：
 *
 * - DesignRegistry：含 editConfig / setter / 事件变量声明，供设计器属性面板使用；
 * - RuntimeRegistry：只保留 type + view + 默认 props，轻量、可 tree-shake，渲染器使用。
 *
 * 两者从同一份 MaterialDefinition 派生，避免协议漂移；渲染侧不打包 editConfig，
 * 也不会把设计器的 setter 依赖带进运行时产物。
 */
export class DesignRegistry {
  private readonly defs = new Map<string, MaterialDefinition>()

  register(def: MaterialDefinition): this {
    this.defs.set(def.config.type, def)
    return this
  }

  get(type: string): MaterialDefinition | undefined {
    return this.defs.get(type)
  }

  /** 供右侧属性面板读取：含 editConfig / 变量 / 事件声明 */
  getEditConfig(type: string): MaterialConfig['editConfig'] | undefined {
    return this.defs.get(type)?.config.editConfig
  }

  list(): MaterialConfig[] {
    return Array.from(this.defs.values()).map((d) => d.config)
  }

  /** 按分组列出物料（left 面板分组展示） */
  byGroup(): Record<string, MaterialConfig[]> {
    const out: Record<string, MaterialConfig[]> = {}
    this.list().forEach((c) => {
      const g = c.group ?? 'default'
      ;(out[g] ??= []).push(c)
    })
    return out
  }

  toRuntime(): RuntimeRegistry {
    const rt = new RuntimeRegistry()
    this.defs.forEach((def) => rt.registerRuntime({
      type: def.config.type,
      view: def.view,
      defaultProps: def.config.defaultProps ?? {},
    }))
    return rt
  }
}

/** 轻量渲染态物料：只有渲染必需的三件事 */
export interface RuntimeMaterial {
  type: string
  view: MaterialDefinition['view']
  defaultProps: Record<string, unknown>
}

export class RuntimeRegistry {
  private readonly defs = new Map<string, RuntimeMaterial>()

  registerRuntime(def: RuntimeMaterial): this {
    this.defs.set(def.type, def)
    return this
  }

  get(type: string): RuntimeMaterial | undefined {
    return this.defs.get(type)
  }

  has(type: string): boolean {
    return this.defs.has(type)
  }

  list(): string[] {
    return Array.from(this.defs.keys())
  }
}

/** 从设计态物料数组一次构建两套注册表 */
export function buildRegistries(defs: MaterialDefinition[]): { design: DesignRegistry; runtime: RuntimeRegistry } {
  const design = new DesignRegistry()
  defs.forEach((d) => design.register(d))
  return { design, runtime: design.toRuntime() }
}
