import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DesignerPage } from './DesignerPage';
import { resetDesigner, useDesignerStore } from './store';

/**
 * 设计器壳集成测试：三栏装配、物料面板、画布契约属性、属性面板写回、抽屉入口。
 * 真实指针拖拽在 jsdom 里不可靠（getBoundingClientRect 恒为 0），
 * 因此落点算法的正确性由 kernel/dropResolver.test.ts 覆盖，
 * 端到端拖拽由 e2e/designer-dnd.mjs 用真浏览器验证。
 */

function renderDesigner() {
  return render(<DesignerPage appCode="demo" />);
}

describe('designer2 设计器壳', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetDesigner();
  });

  it('渲染顶栏 + 三栏 + 状态栏', () => {
    renderDesigner();
    expect(screen.getByText('未命名页面')).toBeTruthy();
    expect(document.querySelector('[data-panel="materials"]')).toBeTruthy();
    expect(document.querySelector('[data-panel="canvas"]')).toBeTruthy();
    expect(document.querySelector('[data-panel="properties"]')).toBeTruthy();
    expect(document.querySelector('.dn-statusbar')).toBeTruthy();
  });

  it('物料面板按分组展示，且带 data-material-type 供拖拽识别', () => {
    renderDesigner();
    const panel = document.querySelector('[data-panel="materials"]') as HTMLElement;
    expect(within(panel).getByText('布局容器')).toBeTruthy();
    expect(within(panel).getByText('表单控件')).toBeTruthy();
    expect(panel.querySelector('[data-material-type="input"]')).toBeTruthy();
    expect(panel.querySelector('[data-material-type="container"]')).toBeTruthy();
    // 22 个物料全部渲染
    expect(panel.querySelectorAll('[data-material-type]').length).toBeGreaterThanOrEqual(20);
  });

  it('画布按契约输出 data-dnode 属性（落点解算的输入）', () => {
    renderDesigner();
    const canvas = document.querySelector('[data-panel="canvas"]') as HTMLElement;
    const root = canvas.querySelector('[data-dnode="root"]');
    expect(root).toBeTruthy();
    expect(root?.getAttribute('data-dnode-accepts')).toBe('1');
    expect(root?.getAttribute('data-dnode-parent')).toBe('');
    expect(canvas.querySelector('[data-tree-renderer="design"]')).toBeTruthy();
  });

  it('画布节点带父级/下标属性，可直接驱动排序', () => {
    const a = useDesignerStore.getState().insertNode('input', 'root')!;
    const b = useDesignerStore.getState().insertNode('button', 'root')!;
    renderDesigner();
    const nodeA = document.querySelector(`[data-dnode="${a}"]`)!;
    const nodeB = document.querySelector(`[data-dnode="${b}"]`)!;
    expect(nodeA.getAttribute('data-dnode-parent')).toBe('root');
    expect(nodeA.getAttribute('data-dnode-index')).toBe('0');
    expect(nodeB.getAttribute('data-dnode-index')).toBe('1');
    expect(nodeA.getAttribute('data-dnode-accepts')).toBe('0');
  });

  it('选中节点后属性面板显示组件名与页签', () => {
    const id = useDesignerStore.getState().insertNode('input', 'root')!;
    renderDesigner();
    useDesignerStore.getState().select(id);
    const props = document.querySelector('[data-panel="properties"]') as HTMLElement;
    return waitFor(() => {
      expect(within(props).getByText('输入框')).toBeTruthy();
      expect(within(props).getByText('属性')).toBeTruthy();
      expect(within(props).getByText('样式')).toBeTruthy();
      expect(within(props).getByText('事件')).toBeTruthy();
      expect(props.querySelector('input')).toBeTruthy();
    });
  });

  it('大纲树渲染节点行并可选中', () => {
    const id = useDesignerStore.getState().insertNode('card', 'root')!;
    renderDesigner();
    fireEvent.click(screen.getByText('大纲'));
    const row = document.querySelector(`[data-outline-row="${id}"]`)!;
    expect(row).toBeTruthy();
    fireEvent.click(row);
    expect(useDesignerStore.getState().selectedId).toBe(id);
  });

  it('逻辑编排抽屉可打开并显示流程编辑器', () => {
    renderDesigner();
    fireEvent.click(screen.getByText('逻辑编排'));
    return waitFor(() => {
      expect(screen.getByText('事件绑定（0）')).toBeTruthy();
    });
  });

  it('Schema 抽屉展示契约快照', () => {
    renderDesigner();
    fireEvent.click(screen.getByText('Schema'));
    return waitFor(() => {
      expect(screen.getByText('页面 Schema')).toBeTruthy();
    });
  });

  it('拖拽时画布不再有「未注册物料」占位', () => {
    useDesignerStore.getState().insertNode('card', 'root');
    renderDesigner();
    expect(document.body.textContent ?? '').not.toContain('未注册物料');
  });
});
