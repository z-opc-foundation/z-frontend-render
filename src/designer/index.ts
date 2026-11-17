/**
 * 可视化设计器（共享包入口）
 *
 * 消费方式：
 *   import { DesignerPage } from '@yuku123/z-frontend-render/designer'
 *   import '@yuku123/z-frontend-render/designer.css'
 *
 * 设计器与运行时共用同一份 PageSchema 契约（../tree），物料注册表也来自 tree。
 * 宿主应用只需提供 antd / @ant-design/icons / @dnd-kit/core / zustand 这几个 peer。
 */

import './designer.css';

export { DesignerPage, blankSchema } from './DesignerPage';
export type { DesignerPageProps, DesignerPersistence } from './DesignerPage';
export { MaterialPanel } from './MaterialPanel';
export { OutlinePanel } from './OutlinePanel';
export { Canvas, CANVAS_SCROLL_ID } from './Canvas';
export { PropertyPanel } from './PropertyPanel';
export { LogicDrawer } from './LogicDrawer';
export { DiffDrawer } from './DiffDrawer';
export { SchemaDrawer } from './SchemaDrawer';
export { useDesignerStore, resetDesigner, emptySchema, locateNode } from './store';
export type { DesignerState, DesignerMode, ViewportPreset, NodeLocation } from './store';
export { PluginHost, containerDefaultsPlugin } from './plugins';
export type { DesignerPlugin, EditorHooks, ContextHooks } from './plugins';
export { HOST_MATERIALS, MATERIAL_MAP, GROUP_META, materialTitle, materialIcon, materialAcceptsChildren } from './materials';
export { setterComponents, buildSetterRegistry } from './setters';
export { resolveDrop, resolveCanvasFallback, collectSubtreeIds } from './kernel/dropResolver';
export type { DropRect, DropTarget, DropIndicator, DropKind } from './kernel/dropResolver';
export { snapshotDropRects, rectOf } from './kernel/rects';
