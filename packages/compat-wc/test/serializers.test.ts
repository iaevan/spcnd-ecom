import { describe, expect, it } from 'vitest';
import { loadOrderRelations, loadProductRelations } from '../src/loaders.js';
import {
  type SerializerContext,
  serializeCoupon,
  serializeCustomer,
  serializeOrder,
  serializeProduct,
  serializeReview,
} from '../src/serializers.js';
import { createTestCore, US_BILLING } from './helpers.js';

const ctx: SerializerContext = { storeUrl: 'https://shop.test', currency: 'USD', decimals: 2 };

describe('WC v3 serializers', () => {
  it('serializes products with string prices, nested dimensions, categories', async () => {
    const core = await createTestCore();
    const s = core.db.schema;
    await core.db.drizzle
      .insert(s.productCategories)
      .values({ name: 'Hats', slug: 'hats', description: '', displayType: 'default', sortOrder: 0 });
    const cat = (await core.db.drizzle.select().from(s.productCategories))[0]!;
    const product = await core.products.create({
      name: 'Fedora',
      regularPrice: '25.0000',
      salePrice: '19.9900',
      sku: 'FED-1',
      weight: 0.4,
      length: 30,
      width: 25,
      height: 12,
      categoryIds: [cat.id],
    });
    const media = await core.media.addExternal('https://cdn.test/fedora.jpg', 'A fedora');
    await core.products.update(product.id, { imageId: media.id });

    const fresh = await core.products.get(product.id);
    const json = serializeProduct(fresh, await loadProductRelations(core, fresh), ctx);

    expect(json).toMatchObject({
      name: 'Fedora',
      price: '19.99',
      regular_price: '25.00',
      sale_price: '19.99',
      on_sale: true,
      purchasable: true,
      sku: 'FED-1',
      weight: '0.4',
      dimensions: { length: '30', width: '25', height: '12' },
      categories: [{ id: cat.id, name: 'Hats', slug: 'hats' }],
      shipping_required: true,
      parent_id: 0,
    });
    const images = json.images as { src: string; alt: string }[];
    expect(images[0]).toMatchObject({ src: 'https://cdn.test/fedora.jpg', alt: 'A fedora' });
    expect(typeof json.date_created).toBe('string');
    expect(String(json.date_created)).not.toMatch(/Z$/);
    await core.close();
  });

  it('serializes a checkout-produced order with all line types', async () => {
    const core = await createTestCore();
    const product = await core.products.create({ name: 'Widget', regularPrice: '25.0000' });
    await core.coupons.create({ code: 'ten', discountType: 'percent', amount: '10.0000' });
    await core.cart.addToCart('szo', { productId: product.id, quantity: 2 });
    await core.cart.applyCoupon('szo', 'ten');
    const result = await core.checkout.processCheckout('szo', {
      billing: US_BILLING,
      paymentMethod: 'cod',
    });

    const json = serializeOrder(
      result.order,
      await loadOrderRelations(core, result.order),
      ctx,
    );
    expect(json).toMatchObject({
      number: String(result.orderId),
      status: 'processing',
      currency: 'USD',
      total: '45.00',
      discount_total: '5.00',
      prices_include_tax: false,
      billing: { first_name: 'Ada', address_1: '1 Analytical Way', email: US_BILLING.email },
    });
    const lineItems = json.line_items as Record<string, unknown>[];
    expect(lineItems[0]).toMatchObject({
      product_id: product.id,
      quantity: 2,
      subtotal: '50.00',
      total: '45.00',
      price: '22.50',
    });
    const couponLines = json.coupon_lines as Record<string, unknown>[];
    expect(couponLines[0]).toMatchObject({ code: 'ten', discount: '5.00' });
    await core.close();
  });

  it('serializes customers with nested snake_case addresses', async () => {
    const core = await createTestCore();
    const customer = await core.customers.create({
      email: 'c@s.io',
      firstName: 'Cara',
      billing: US_BILLING,
      shipping: { ...US_BILLING, city: 'Oakland' },
    });
    const json = serializeCustomer(
      customer,
      await core.customers.getAddress(customer.id, 'billing'),
      await core.customers.getAddress(customer.id, 'shipping'),
    );
    expect(json).toMatchObject({
      email: 'c@s.io',
      role: 'customer',
      billing: { address_1: '1 Analytical Way', city: 'San Francisco' },
      shipping: { city: 'Oakland' },
    });
    expect(json).not.toHaveProperty('password');
    await core.close();
  });

  it('serializes coupons and reviews', async () => {
    const core = await createTestCore();
    const coupon = await core.coupons.create({
      code: 'ship',
      discountType: 'fixed_cart',
      amount: '7.5000',
      freeShipping: true,
      minimumAmount: '20.0000',
    });
    expect(serializeCoupon(coupon, ctx)).toMatchObject({
      code: 'ship',
      amount: '7.50',
      discount_type: 'fixed_cart',
      free_shipping: true,
      minimum_amount: '20.00',
      used_by: [],
    });

    const product = await core.products.create({ name: 'R', regularPrice: '5.0000' });
    const s = core.db.schema;
    await core.db.drizzle.insert(s.reviews).values({
      productId: product.id,
      rating: 4,
      content: 'Nice',
      status: 'pending',
      authorName: 'Rev',
      authorEmail: 'rev@t.co',
      dateCreated: new Date().toISOString(),
    });
    const review = (await core.db.drizzle.select().from(s.reviews))[0]!;
    expect(serializeReview(review, 'R')).toMatchObject({
      product_id: product.id,
      status: 'hold',
      reviewer: 'Rev',
      rating: 4,
      verified: false,
    });
    await core.close();
  });
});
