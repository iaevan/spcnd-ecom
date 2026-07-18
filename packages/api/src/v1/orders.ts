import type { OrderListQuery, OrderStatus } from '@spacendigital/core';
import { createRouter, intParam, pageQuery, setListHeaders } from '../shared.js';

/** /api/v1 orders + notes + refunds + status transitions. */
export function orderRoutes() {
  const app = createRouter();

  app.get('/orders', async (c) => {
    const core = c.get('core');
    const { page, perPage } = pageQuery(c);
    const status = c.req.query('status');
    const query: OrderListQuery = {
      page,
      perPage,
      status: status ? (status.split(',') as OrderStatus[]) : undefined,
      customerId: c.req.query('customer') ? Number(c.req.query('customer')) : undefined,
      orderBy: c.req.query('orderby') as OrderListQuery['orderBy'],
      order: c.req.query('order') as OrderListQuery['order'],
    };
    const result = await core.orders.list(query);
    setListHeaders(c, result.total, result.totalPages, result.page);
    return c.json(result.items);
  });

  app.post('/orders', async (c) => {
    const body = await c.req.json();
    return c.json(await c.get('core').orders.create(body), 201);
  });

  app.get('/orders/:id', async (c) => {
    const core = c.get('core');
    const id = intParam(c, 'id');
    const order = await core.orders.get(id);
    return c.json({ ...order, items: await core.orders.getItems(id) });
  });

  app.put('/orders/:id/status', async (c) => {
    const body = (await c.req.json()) as { status: OrderStatus; note?: string };
    return c.json(
      await c.get('core').orders.setStatus(intParam(c, 'id'), body.status, body.note, true),
    );
  });

  app.post('/orders/:id/payment-complete', async (c) => {
    const core = c.get('core');
    const id = intParam(c, 'id');
    const body = (await c.req.json().catch(() => ({}))) as { transactionId?: string };
    const ok = await core.orders.paymentComplete(id, body.transactionId);
    return c.json({ ok, order: await core.orders.get(id) });
  });

  app.post('/orders/:id/recalculate', async (c) => {
    return c.json(await c.get('core').orders.calculateTotals(intParam(c, 'id')));
  });

  app.delete('/orders/:id', async (c) => {
    const core = c.get('core');
    const id = intParam(c, 'id');
    const order = await core.orders.get(id);
    if (c.req.query('force') === 'true') await core.orders.delete(id);
    else await core.orders.trash(id);
    return c.json(order);
  });

  // --- Notes ----------------------------------------------------------------
  app.get('/orders/:id/notes', async (c) => {
    return c.json(await c.get('core').orders.getNotes(intParam(c, 'id')));
  });

  app.post('/orders/:id/notes', async (c) => {
    const body = (await c.req.json()) as { note: string; type?: 'private' | 'customer' };
    return c.json(
      await c.get('core').orders.addNote(intParam(c, 'id'), body.note, body.type ?? 'private'),
      201,
    );
  });

  app.delete('/orders/:id/notes/:noteId', async (c) => {
    await c.get('core').orders.deleteNote(intParam(c, 'noteId'));
    return c.json({ deleted: true });
  });

  // --- Refunds --------------------------------------------------------------
  app.get('/orders/:id/refunds', async (c) => {
    return c.json(await c.get('core').orders.getRefunds(intParam(c, 'id')));
  });

  app.post('/orders/:id/refunds', async (c) => {
    const body = await c.req.json();
    return c.json(await c.get('core').orders.createRefund(intParam(c, 'id'), body), 201);
  });

  return app;
}
