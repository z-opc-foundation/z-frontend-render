import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createWorkspaceContext, resolveEntityFields } from '../index';
import type { EntityDefDTO, FieldDefDTO, FieldServices } from '../../contract/field';

/**
 * REF 选择器的数据入口: 引擎不持传输层, 候选记录只能由消费方注入的
 * `ctx.services.loadReference` 提供。这条用例守的就是这个注入契约 ——
 * 它一旦被改回直接 import 某个 api 模块, 引擎就又变成 z-lc 专属了。
 */

const CUSTOMER: EntityDefDTO = {
  entityCode: 'customer',
  entityName: '客户',
  appCode: 'demo_app',
  tenantCode: 'default',
  fields: [
    { fieldCode: 'id', fieldName: 'ID', fieldType: 'LONG' },
    { fieldCode: 'name', fieldName: '名称', fieldType: 'STRING' },
  ],
} as EntityDefDTO;

function refResolved(services?: FieldServices) {
  const ws = createWorkspaceContext({
    appCode: 'demo_app',
    tenantCode: 'default',
    entities: [CUSTOMER],
    services,
  });
  const order: EntityDefDTO = {
    entityCode: 'order',
    entityName: '订单',
    appCode: 'demo_app',
    tenantCode: 'default',
    fields: [{ fieldCode: 'cust', fieldName: '客户', fieldType: 'REF', refEntity: 'customer' } as FieldDefDTO],
  };
  const [resolved] = resolveEntityFields(order, ws);
  if (!resolved) {
    throw new Error('REF 字段应能解析');
  }
  return resolved;
}

describe('REF 定义', () => {
  it('按注入的 loadReference 拉候选，并用返回的记录渲染标签', async () => {
    const loadReference = vi.fn(async () => [{ id: 7, name: '张三' }]);
    const resolved = refResolved({ loadReference });
    expect(resolved.def.key).toBe('ref');

    render(<>{resolved.def.renderFormInput({ ctx: resolved.ctx, value: 7, onChange: () => {} })}</>);

    await waitFor(() =>
      expect(loadReference).toHaveBeenCalledWith(
        expect.objectContaining({
          entityCode: 'customer',
          appCode: 'demo_app',
          tenantCode: 'default',
          labelField: 'name',
          keyword: '',
          page: 1,
          size: 50,
        }),
      ),
    );
    // 选项到位后，已选中的 7 应显示成人读的"张三"而不是 #7
    expect(await screen.findByText('张三')).toBeInTheDocument();
  });

  it('没注入 loadReference 时不发请求，也不会抛', () => {
    const resolved = refResolved();
    render(<>{resolved.def.renderFormInput({ ctx: resolved.ctx, value: 7, onChange: () => {} })}</>);
    expect(screen.getByText('#7')).toBeInTheDocument();
  });

  it('未配置 refEntity 的 REF 列不参与内联编辑', () => {
    const ws = createWorkspaceContext({ appCode: 'a1', tenantCode: 'default', entities: [] });
    const [resolved] = resolveEntityFields(
      {
        entityCode: 'order',
        entityName: '订单',
        appCode: 'a1',
        tenantCode: 'default',
        fields: [{ fieldCode: 'cust', fieldName: '客户', fieldType: 'REF' } as FieldDefDTO],
      } as EntityDefDTO,
      ws,
    );
    expect(resolved?.inlineEditable).toBe(false);
  });
});
