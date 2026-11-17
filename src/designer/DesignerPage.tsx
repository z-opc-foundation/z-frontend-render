import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Button, Segmented, Select, Space, Tooltip, Typography, message } from 'antd';
import {
  AppstoreOutlined,
  ApartmentOutlined,
  CodeOutlined,
  CompressOutlined,
  DesktopOutlined,
  EyeOutlined,
  FileTextOutlined,
  MobileOutlined,
  RedoOutlined,
  SaveOutlined,
  TabletOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { TreeRenderer, createMaterialRegistry, type PageSchema } from '../tree';
import { MaterialPanel } from './MaterialPanel';
import { Canvas, CANVAS_SCROLL_ID } from './Canvas';
import { OutlinePanel } from './OutlinePanel';
import { PropertyPanel } from './PropertyPanel';
import { LogicDrawer } from './LogicDrawer';
import { DiffDrawer } from './DiffDrawer';
import { SchemaDrawer } from './SchemaDrawer';
import { useDesignerStore, emptySchema, locateNode } from './store';
import { HOST_MATERIALS, materialIcon, materialTitle } from './materials';
import { resolveDrop, resolveCanvasFallback, collectSubtreeIds, type DropTarget } from './kernel/dropResolver';
import { snapshotDropRects, rectOf } from './kernel/rects';
import { markDragEnd } from './kernel/dragState';
import './designer.css';

const { Text } = Typography;

/**
 * 可视化设计器外壳：顶栏 + 左（物料/大纲）+ 中画布 + 右属性 + 底部状态栏。
 *
 * 拖拽由本组件统一编排：
 *   onDragStart → 记录指针原点 + 排除被拖节点子树
 *   onDragMove  → 用 kernel/dropResolver 从「指针坐标 + 矩形快照」解算落点，画指示线
 *   onDragEnd   → 按落点调 store 的 insertAt / moveTo
 *
 * 为什么不用 dnd-kit 的 collisionDetection 直接定落点：容器矩形天然包含子节点矩形，
 * 默认算法会一直命中面积最大的祖先，导致「只能往最外层追加」。自解算才能区分
 * 插到前/后/里面，并算出精确下标。
 */

const runtimeMaterials = createMaterialRegistry(HOST_MATERIALS);

const VIEWPORT_OPTIONS = [
  { label: <DesktopOutlined />, value: 'desktop', title: '桌面' },
  { label: <TabletOutlined />, value: 'tablet', title: '平板 820' },
  { label: <MobileOutlined />, value: 'mobile', title: '手机 390' },
];

interface DragSource {
  kind: 'material' | 'node';
  materialType?: string;
  nodeId?: string;
  label: string;
  icon: React.ReactNode;
}

export interface DesignerPageProps {
  /** 应用编码：草稿与页面归属 */
  appCode?: string;
  /** 页面编码：落库的身份键；不传则只做本地草稿 */
  pageCode?: string;
  /** 页面名称（顶栏展示，保存时一并提交） */
  pageName?: string;
  /**
   * 持久化接缝：宿主注入（z-lc 控制台走 /api/lc/page，主壳走同一套）。
   * 不注入时退化为 localStorage 草稿 —— 设计器本身不认识任何后端接口。
   */
  persistence?: DesignerPersistence;
  /** 「预览运行态」入口：宿主决定跳哪（主壳跳 /lc/app/:app/:page） */
  onPreview?: (payload: { appCode: string; pageCode?: string }) => void;
}

/** 页面读写接缝（由宿主实现，设计器不感知 HTTP/存储细节） */
export interface DesignerPersistence {
  load(ref: { appCode: string; pageCode: string }): Promise<PageSchema | null>;
  save(
    ref: { appCode: string; pageCode: string },
    payload: { pageName: string; schema: PageSchema },
  ): Promise<void>;
}

export function DesignerPage({
  appCode = 'demo',
  pageCode,
  pageName,
  persistence,
  onPreview,
}: DesignerPageProps = {}) {
  const schema = useDesignerStore((s) => s.schema);
  const selectedId = useDesignerStore((s) => s.selectedId);
  const mode = useDesignerStore((s) => s.mode);
  const viewport = useDesignerStore((s) => s.viewport);
  const zoom = useDesignerStore((s) => s.zoom);
  const past = useDesignerStore((s) => s.past);
  const future = useDesignerStore((s) => s.future);
  const clipboard = useDesignerStore((s) => s.clipboard);

  const insertAt = useDesignerStore((s) => s.insertAt);
  const moveTo = useDesignerStore((s) => s.moveTo);
  const removeNode = useDesignerStore((s) => s.removeNode);
  const select = useDesignerStore((s) => s.select);
  const setSchema = useDesignerStore((s) => s.setSchema);
  const setMode = useDesignerStore((s) => s.setMode);
  const setViewport = useDesignerStore((s) => s.setViewport);
  const setZoom = useDesignerStore((s) => s.setZoom);
  const undo = useDesignerStore((s) => s.undo);
  const redo = useDesignerStore((s) => s.redo);
  const copyNode = useDesignerStore((s) => s.copyNode);
  const paste = useDesignerStore((s) => s.paste);
  const duplicate = useDesignerStore((s) => s.duplicate);
  const selectParent = useDesignerStore((s) => s.selectParent);

  const [leftTab, setLeftTab] = useState<'materials' | 'outline'>('materials');
  const [logicOpen, setLogicOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [activeDrag, setActiveDrag] = useState<DragSource | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const excludeRef = useRef<Set<string>>(new Set());

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  /* ---------------- 持久化：后端优先，localStorage 兜底 ---------------- */
  const storageKey = pageCode ? `z-lc:designer:${appCode}:${pageCode}` : `z-lc:designer:${appCode}`;
  const [saving, setSaving] = useState(false);
  // 远端页面读不到时要说清楚：否则用户看到空白画布，一保存就把线上内容覆盖了
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const loadDraft = () => {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.elements && parsed?.layout?.root) setSchema(parsed);
      } catch {
        /* 坏草稿忽略 */
      }
    };

    setLoadError(null);
    if (persistence && pageCode) {
      // 有后端就以后端为准；读不到（未登录/新页面）再回落本地草稿
      persistence
        .load({ appCode, pageCode })
        .then((remote) => {
          if (!alive) return;
          if (remote?.elements && Object.keys(remote.elements).length > 0) {
            setSchema(remote);
          } else {
            loadDraft();
          }
        })
        .catch((e: unknown) => {
          if (!alive) return;
          const reason = e instanceof Error ? e.message : String(e);
          setLoadError(reason);
          message.warning(`${reason}（已回退本地草稿）`);
          loadDraft();
        });
    } else {
      loadDraft();
    }
    return () => {
      alive = false;
    };
    // 只在进入页面/切换应用与页面时加载一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, appCode, pageCode, persistence]);

  const saveDraft = useCallback(
    (silent = false) => {
      window.localStorage.setItem(storageKey, JSON.stringify(schema));
      if (!silent) {
        message.success(`草稿已保存（${Object.keys(schema.elements ?? {}).length} 个节点）`);
      }
    },
    [schema, storageKey],
  );

  /** 保存：先落本地草稿（断网/未登录也不丢），再尝试写服务端 */
  const handleSave = useCallback(async () => {
    saveDraft(true);
    if (!persistence || !pageCode) {
      message.success(`草稿已保存（${Object.keys(schema.elements ?? {}).length} 个节点）`);
      return;
    }
    setSaving(true);
    try {
      await persistence.save(
        { appCode, pageCode },
        { pageName: pageName || String(schema.meta?.title ?? '未命名页面'), schema },
      );
      message.success('已保存到服务端');
    } catch (e) {
      message.error(`保存失败：${e instanceof Error ? e.message : String(e)}（本地草稿已保留）`);
    } finally {
      setSaving(false);
    }
  }, [appCode, pageCode, pageName, persistence, saveDraft, schema]);


  useEffect(() => {
    const timer = window.setTimeout(() => saveDraft(true), 1200);
    return () => window.clearTimeout(timer);
  }, [schema, saveDraft]);

  /* ---------------- 拖拽 ---------------- */
  const computeTarget = useCallback(
    (x: number, y: number): DropTarget | null => {
      const state = useDesignerStore.getState();
      const root = state.schema.layout?.root ?? 'root';
      const rects = snapshotDropRects();
      const hit = resolveDrop(x, y, rects, { excludeIds: excludeRef.current });
      if (hit) return hit;
      const scrollEl = document.getElementById(CANVAS_SCROLL_ID);
      const canvasRect = rectOf(scrollEl);
      if (!canvasRect) return null;
      const rootChildren = state.schema.layout?.structure?.[root]?.children?.length ?? 0;
      return resolveCanvasFallback(x, y, canvasRect, root, rootChildren);
    },
    [],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as { source?: string; materialType?: string; nodeId?: string } | undefined;
    const native = event.activatorEvent as PointerEvent | undefined;
    dragStart.current = { x: native?.clientX ?? 0, y: native?.clientY ?? 0 };

    if (data?.source === 'material' && data.materialType) {
      excludeRef.current = new Set();
      setActiveDrag({
        kind: 'material',
        materialType: data.materialType,
        label: materialTitle(data.materialType),
        icon: materialIcon(data.materialType),
      });
      return;
    }
    if (data?.source === 'node' && data.nodeId) {
      const state = useDesignerStore.getState();
      excludeRef.current = collectSubtreeIds(data.nodeId, state.schema.layout?.structure);
      const node = state.schema.elements?.[data.nodeId];
      setActiveDrag({
        kind: 'node',
        nodeId: data.nodeId,
        label: node ? materialTitle(node.type) : data.nodeId,
        icon: node ? materialIcon(node.type) : null,
      });
    }
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const origin = dragStart.current;
    if (!origin) return;
    const x = origin.x + event.delta.x;
    const y = origin.y + event.delta.y;
    setDropTarget(computeTarget(x, y));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const origin = dragStart.current;
    const target = dropTarget;
    const drag = activeDrag;
    dragStart.current = null;
    setDropTarget(null);
    setActiveDrag(null);
    markDragEnd();

    if (!origin || !target || !drag) return;

    if (drag.kind === 'material' && drag.materialType) {
      insertAt(drag.materialType, target.parentId, target.index, target.slot);
      return;
    }
    if (drag.kind === 'node' && drag.nodeId) {
      moveTo(drag.nodeId, target.parentId, target.index, target.slot);
    }
    void event;
  };

  /* ---------------- 快捷键 ---------------- */
  useEffect(() => {
    const isEditable = (el: EventTarget | null): boolean => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const state = useDesignerStore.getState();
      const sel = state.selectedId;

      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveDraft();
        return;
      }
      if (mod && e.key.toLowerCase() === 'z') {
        if (isEditable(e.target)) return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'c') {
        if (isEditable(e.target) || !sel) return;
        if (copyNode(sel)) message.success('已复制节点');
        return;
      }
      if (mod && e.key.toLowerCase() === 'v') {
        if (isEditable(e.target)) return;
        const container = sel && state.schema.elements?.[sel] ? sel : (state.schema.layout?.root ?? 'root');
        const parent = (() => {
          const node = state.schema.elements?.[container];
          if (!node) return state.schema.layout?.root ?? 'root';
          const loc = locateNode(state.schema, container);
          // 选中原子节点时粘到它的父容器里，符合直觉
          return loc ? loc.parentId : container;
        })();
        if (paste(parent)) message.success('已粘贴');
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        if (isEditable(e.target) || !sel) return;
        e.preventDefault();
        duplicate(sel);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !isEditable(e.target)) {
        e.preventDefault();
        removeNode(sel);
        return;
      }
      if (e.key === 'Escape') {
        select(null);
        return;
      }
      if (e.key === 'ArrowUp' && e.altKey && sel) {
        e.preventDefault();
        selectParent();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveDraft, redo, undo, copyNode, paste, duplicate, removeNode, select, selectParent]);

  /* ---------------- 面包屑 ---------------- */
  const breadcrumb = useMemo(() => {
    if (!selectedId) return [];
    const chain: Array<{ id: string; title: string }> = [];
    let cursor: string | null = selectedId;
    let guard = 0;
    while (cursor && guard < 32) {
      const node = schema.elements?.[cursor];
      if (!node) break;
      chain.unshift({ id: cursor, title: materialTitle(node.type) });
      cursor = locateNode(schema, cursor)?.parentId ?? null;
      guard += 1;
    }
    return chain;
  }, [schema, selectedId]);

  const nodeCount = Object.keys(schema.elements ?? {}).length;

  return (
    <div className="dn-app">
      {/* 顶栏 */}
      <header className="dn-topbar">
        <div className="dn-topbar__left">
          <button type="button" className="dn-topbar__back" title="返回" onClick={() => window.history.back()}>
            <AppstoreOutlined />
          </button>
          <div className="dn-topbar__title">
            <span>{String(schema.meta?.title ?? '未命名页面')}</span>
            <em>{appCode}</em>
          </div>
          <span className="dn-topbar__sep" />
          <Space size={2}>
            <Tooltip title="撤销 ⌘Z">
              <Button size="small" type="text" icon={<UndoOutlined />} disabled={past.length === 0} onClick={undo} />
            </Tooltip>
            <Tooltip title="重做 ⌘⇧Z">
              <Button size="small" type="text" icon={<RedoOutlined />} disabled={future.length === 0} onClick={redo} />
            </Tooltip>
          </Space>
        </div>

        <div className="dn-topbar__center">
          <Segmented
            size="small"
            value={mode}
            onChange={(v) => setMode(v as 'design' | 'preview')}
            options={[
              { label: '设计', value: 'design' },
              { label: '预览', value: 'preview' },
            ]}
          />
        </div>

        <div className="dn-topbar__right">
          <Space size={6}>
            <Tooltip title="Schema / 变量 / 页面信息">
              <Button size="small" icon={<CodeOutlined />} onClick={() => setSchemaOpen(true)}>
                Schema
              </Button>
            </Tooltip>
            <Button size="small" onClick={() => setLogicOpen(true)}>
              逻辑编排
            </Button>
            <Button size="small" onClick={() => setDiffOpen(true)}>
              版本差异
            </Button>
            {onPreview ? (
              <Tooltip title="按已保存/当前草稿打开运行态页面">
                <Button size="small" icon={<EyeOutlined />} onClick={() => onPreview({ appCode, pageCode })}>
                  运行态
                </Button>
              </Tooltip>
            ) : null}
            <Button
              size="small"
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={() => void handleSave()}
            >
              保存
            </Button>
          </Space>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveDrag(null);
          setDropTarget(null);
          dragStart.current = null;
        }}
      >
        <div className="dn-body">
          {/* 左栏 */}
          <aside className="dn-side dn-side--left" data-panel="materials">
            <div className="dn-side__tabs">
              <button
                type="button"
                className={leftTab === 'materials' ? 'is-active' : ''}
                onClick={() => setLeftTab('materials')}
              >
                <AppstoreOutlined /> 组件
              </button>
              <button
                type="button"
                className={leftTab === 'outline' ? 'is-active' : ''}
                onClick={() => setLeftTab('outline')}
              >
                <ApartmentOutlined /> 大纲
              </button>
            </div>
            {leftTab === 'materials' ? <MaterialPanel /> : <OutlinePanel />}
          </aside>

          {/* 画布 */}
          <main className="dn-stage">
            {loadError ? (
              <div className="dn-load-error" data-designer-load-error="1">
                读不到服务端页面：{loadError}。当前显示的是本地草稿/空白页，<b>保存会以当前画布为准</b>。
              </div>
            ) : null}
            <div className="dn-stage__bar">
              <Segmented
                size="small"
                value={viewport}
                onChange={(v) => setViewport(v as 'desktop' | 'tablet' | 'mobile')}
                options={VIEWPORT_OPTIONS.map((o) => ({ label: <span title={o.title}>{o.label}</span>, value: o.value }))}
              />
              <div className="dn-stage__zoom">
                <Tooltip title="缩小">
                  <Button size="small" type="text" icon={<CompressOutlined />} onClick={() => setZoom(zoom - 0.1)} />
                </Tooltip>
                <Select
                  size="small"
                  variant="borderless"
                  value={zoom}
                  style={{ width: 74 }}
                  onChange={(v) => setZoom(v)}
                  options={[0.5, 0.75, 0.9, 1, 1.1, 1.25].map((z) => ({ label: `${Math.round(z * 100)}%`, value: z }))}
                />
              </div>
            </div>

            {mode === 'preview' ? (
              <div className="dn-preview">
                <div className="dn-preview__note">
                  <EyeOutlined /> 预览模式：与运行时同一套 TreeRenderer + 物料注册表，交互已激活
                </div>
                <div className="dn-preview__frame">
                  <TreeRenderer
                    schema={schema}
                    materials={runtimeMaterials}
                    onEvent={(nodeId, event) => {
                      // 预览态把事件转成提示，运行时会接到逻辑引擎
                      // eslint-disable-next-line no-console
                      console.info('[preview] event', nodeId, event);
                    }}
                  />
                </div>
              </div>
            ) : (
              <Canvas />
            )}
          </main>

          {/* 右栏 */}
          <aside className="dn-side dn-side--right" data-panel="properties">
            <PropertyPanel />
          </aside>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDrag ? (
            <div className={`dn-drag-ghost${activeDrag.kind === 'node' ? ' dn-drag-ghost--node' : ''}`}>
              <span className="dn-drag-ghost__icon">{activeDrag.icon}</span>
              <span>{activeDrag.label}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* 落点指示线：fixed 定位，不受画布滚动/缩放影响 */}
      {dropTarget ? (
        <div
          className={`dn-drop-indicator dn-drop-indicator--${dropTarget.kind}`}
          style={{
            top: dropTarget.indicator.top,
            left: dropTarget.indicator.left,
            width: dropTarget.indicator.width,
            height: dropTarget.indicator.height,
          }}
        >
          <span className="dn-drop-indicator__dot" />
        </div>
      ) : null}

      {/* 状态栏 */}
      <footer className="dn-statusbar">
        <div className="dn-statusbar__crumbs">
          {breadcrumb.length === 0 ? (
            <Text type="secondary">未选中</Text>
          ) : (
            breadcrumb.map((item, i) => (
              <span key={item.id}>
                {i > 0 ? <em>/</em> : null}
                <button type="button" onClick={() => select(item.id)}>
                  {item.title}
                </button>
              </span>
            ))
          )}
        </div>
        <div className="dn-statusbar__meta">
          <span>节点 {nodeCount}</span>
          <span>历史 {past.length}</span>
          {clipboard ? <span>剪贴板 1</span> : null}
          <span>
            <FileTextOutlined /> {String(schema.id ?? 'page')}
          </span>
        </div>
      </footer>

      <LogicDrawer open={logicOpen} onClose={() => setLogicOpen(false)} />
      <DiffDrawer open={diffOpen} onClose={() => setDiffOpen(false)} />
      <SchemaDrawer open={schemaOpen} onClose={() => setSchemaOpen(false)} />
    </div>
  );
}

/** 供路由重置用 */
export function blankSchema(pageId = 'page') {
  return emptySchema(pageId);
}
