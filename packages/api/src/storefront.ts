import type { CheckoutData } from '@spacendigital/core';
import { randomString } from '@spacendigital/core';
import type { Context } from 'hono';
import { createRouter } from './shared.js';

/**
 * Session-cookie storefront routes for the Astro demo (RESUME step 10).
 *
 * TODO:security-blocked — see docs/SECURITY_WORK.md item S2: the cookie is a
 * bare random session key (`spcnd_session`) with no integrity tag. S2
 * replaces this with the `{customer_id}|{expiration}|{expiring}|{tag}` shape
 * verified against the app secret.
 */

const COOKIE = 'spcnd_session';

function cartIdFrom(c: Context): { cartId: string; isNew: boolean } {
  const cookie = c.req.header('Cookie') ?? '';
  const match = new RegExp(`${COOKIE}=([A-Za-z0-9]+)`).exec(cookie);
  if (match?.[1]) return { cartId: match[1], isNew: false };
  return { cartId: randomString(32), isNew: true };
}

function attachCookie(c: Context, cartId: string, isNew: boolean): void {
  if (!isNew) return;
  c.header(
    'Set-Cookie',
    `${COOKIE}=${cartId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 48}`,
  );
}

export function storefrontRoutes() {
  const app = createRouter();

  app.get('/cart', async (c) => {
    const { cartId, isNew } = cartIdFrom(c);
    attachCookie(c, cartId, isNew);
    const calculated = await c.get('core').cart.calculate(cartId);
    return c.json(serializeCart(calculated));
  });

  app.post('/cart/items', async (c) => {
    const core = c.get('core');
    const { cartId, isNew } = cartIdFrom(c);
    attachCookie(c, cartId, isNew);
    const body = (await c.req.json()) as {
      productId: number;
      quantity?: number;
      variationId?: number;
      variation?: Record<string, string>;
    };
    const key = await core.cart.addToCart(cartId, body);
    const calculated = await core.cart.calculate(cartId);
    return c.json({ key, cart: serializeCart(calculated) }, 201);
  });

  app.patch('/cart/items/:key', async (c) => {
    const core = c.get('core');
    const { cartId, isNew } = cartIdFrom(c);
    attachCookie(c, cartId, isNew);
    const body = (await c.req.json()) as { quantity: number };
    await core.cart.setQuantity(cartId, c.req.param('key'), body.quantity);
    return c.json(serializeCart(await core.cart.calculate(cartId)));
  });

  app.delete('/cart/items/:key', async (c) => {
    const core = c.get('core');
    const { cartId, isNew } = cartIdFrom(c);
    attachCookie(c, cartId, isNew);
    await core.cart.removeItem(cartId, c.req.param('key'));
    return c.json(serializeCart(await core.cart.calculate(cartId)));
  });

  app.post('/cart/coupons', async (c) => {
    const core = c.get('core');
    const { cartId, isNew } = cartIdFrom(c);
    attachCookie(c, cartId, isNew);
    const body = (await c.req.json()) as { code: string };
    await core.cart.applyCoupon(cartId, body.code);
    return c.json(serializeCart(await core.cart.calculate(cartId)), 201);
  });

  app.delete('/cart/coupons/:code', async (c) => {
    const core = c.get('core');
    const { cartId, isNew } = cartIdFrom(c);
    attachCookie(c, cartId, isNew);
    await core.cart.removeCoupon(cartId, c.req.param('code'));
    return c.json(serializeCart(await core.cart.calculate(cartId)));
  });

  app.post('/checkout', async (c) => {
    const core = c.get('core');
    const { cartId, isNew } = cartIdFrom(c);
    attachCookie(c, cartId, isNew);
    const data = (await c.req.json()) as CheckoutData;
    data.customerIpAddress =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? data.customerIpAddress;
    data.customerUserAgent = c.req.header('user-agent') ?? data.customerUserAgent;
    const result = await core.checkout.processCheckout(cartId, data);
    return c.json({
      result: result.result,
      orderId: result.orderId,
      orderKey: result.orderKey,
      redirect: result.redirect,
      removedCoupons: result.removedCoupons,
    });
  });

  app.get('/order-received/:id', async (c) => {
    const core = c.get('core');
    const order = await core.orders.get(Number(c.req.param('id')));
    if (order.orderKey !== c.req.query('key')) {
      return c.json({ code: 'invalid_order_key', message: 'Invalid order key' }, 403);
    }
    return c.json({ ...order, items: await core.orders.getItems(order.id) });
  });

  return app;
}

function serializeCart(calculated: Awaited<ReturnType<import('@spacendigital/core').CartService['calculate']>>) {
  return {
    items: calculated.lines.map((line) => ({
      key: line.key,
      productId: line.productId,
      variationId: line.variationId,
      name: line.product.name,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
      totalMinor: line.totalMinor,
    })),
    coupons: calculated.coupons.map((coupon) => coupon.code),
    removedCoupons: calculated.removedCoupons,
    totals: {
      subtotalMinor: calculated.totals.subtotalMinor,
      discountTotalMinor: calculated.totals.discountTotalMinor,
      shippingTotalMinor: calculated.totals.shippingTotalMinor,
      totalTaxMinor: calculated.totals.totalTaxMinor,
      totalMinor: calculated.totals.totalMinor,
    },
    needsShipping: calculated.needsShipping,
    needsPayment: calculated.needsPayment,
  };
}
