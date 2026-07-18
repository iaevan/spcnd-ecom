import { productCreated, productGetterFilter } from '@spacendigital/core';
import { describe, expect, it } from 'vitest';
import { resolveWcHookName } from '../src/aliases.js';
import { createWcCompat } from '../src/compat.js';
import { createMetaShims } from '../src/meta.js';
import { createOptionsShim } from '../src/options.js';
import { createTestCore } from './helpers.js';

describe('hook aliasing (one pipeline)', () => {
  it('resolves static, dynamic, and unknown hook names', () => {
    expect(resolveWcHookName('woocommerce_new_product')).toBe('product.created');
    expect(resolveWcHookName('woocommerce_order_status_changed')).toBe('order.status.changed');
    expect(resolveWcHookName('woocommerce_order_status_processing')).toBe(
      'order.status.processing',
    );
    expect(resolveWcHookName('woocommerce_order_status_pending_to_processing')).toBe(
      'order.status.pending_to_processing',
    );
    expect(resolveWcHookName('woocommerce_payment_complete_order_status_on-hold')).toBe(
      'order.payment_complete.status.on-hold',
    );
    expect(resolveWcHookName('woocommerce_product_get_price')).toBe('product.get_price');
    expect(resolveWcHookName('my_plugin_custom_hook')).toBe('my_plugin_custom_hook');
  });

  it('WC-named listeners fire on typed core events, sharing one priority chain', async () => {
    const core = await createTestCore();
    const compat = createWcCompat(core.bus);
    const calls: string[] = [];
    compat.on('woocommerce_new_product', () => {
      calls.push('wc-p20');
    }, 20);
    core.bus.on(productCreated, () => {
      calls.push('typed-p10');
    }, 10);
    compat.on('woocommerce_new_product', () => {
      calls.push('wc-p5');
    }, 5);
    await core.products.create({ name: 'Hooked', regularPrice: '1.0000' });
    expect(calls).toEqual(['wc-p5', 'typed-p10', 'wc-p20']);
    await core.close();
  });

  it('dynamic order-status hooks fire through the state machine', async () => {
    const core = await createTestCore();
    const compat = createWcCompat(core.bus);
    const calls: string[] = [];
    compat.on('woocommerce_order_status_processing', () => {
      calls.push('to-processing');
    });
    compat.on('woocommerce_order_status_pending_to_processing', () => {
      calls.push('pending-to-processing');
    });
    const order = await core.orders.create({});
    await core.orders.setStatus(order.id, 'processing');
    expect(calls).toEqual(['to-processing', 'pending-to-processing']);
    await core.close();
  });

  it('bridges sync {prop} getter filters into applyFiltersSync chains', async () => {
    const core = await createTestCore();
    const compat = createWcCompat(core.bus);
    compat.addFilter('woocommerce_product_get_price', (value) => `${value as string}!`);
    const result = core.bus.applyFiltersSync(productGetterFilter('price'), '9.99');
    expect(result).toBe('9.99!');
    await core.close();
  });

  it('doAction/applyFilters work for unknown (custom) hook names symmetrically', async () => {
    const core = await createTestCore();
    const compat = createWcCompat(core.bus);
    const seen: unknown[] = [];
    core.bus.onName('my_plugin_hook', (arg) => {
      seen.push(arg);
    });
    await compat.doAction('my_plugin_hook', 42);
    expect(seen).toEqual([42]);
    compat.addFilter('my_plugin_filter', (v) => (v as number) + 1);
    expect(await compat.applyFilters('my_plugin_filter', 1)).toBe(2);
    expect(compat.hasHook('my_plugin_filter')).toBe(true);
    await core.close();
  });
});

describe('meta shims (EAV tables)', () => {
  it('round-trips product meta with WP semantics', async () => {
    const core = await createTestCore();
    const product = await core.products.create({ name: 'M', regularPrice: '1.0000' });
    const meta = createMetaShims(core.db);

    expect(await meta.product.get(product.id, '_custom')).toBe('');
    await meta.product.update(product.id, '_custom', 'hello');
    expect(await meta.product.get(product.id, '_custom')).toBe('hello');

    // add appends; update collapses back to a single row.
    await meta.product.add(product.id, '_custom', { nested: true });
    expect((await meta.product.getAll(product.id, '_custom'))._custom).toEqual([
      'hello',
      { nested: true },
    ]);
    await meta.product.update(product.id, '_custom', '42');
    expect((await meta.product.getAll(product.id, '_custom'))._custom).toEqual([42]);

    await meta.product.delete(product.id, '_custom');
    expect(await meta.product.get(product.id, '_custom')).toBe('');
    await core.close();
  });

  it('covers order, customer and order-item tables', async () => {
    const core = await createTestCore();
    const meta = createMetaShims(core.db);
    const order = await core.orders.create({});
    const customer = await core.customers.create({ email: 'meta@t.co' });
    await meta.order.update(order.id, 'is_vat_exempt', 'yes');
    expect(await meta.order.get(order.id, 'is_vat_exempt')).toBe('yes');
    await meta.customer.update(customer.id, 'loyalty_tier', 'gold');
    expect(await meta.customer.get(customer.id, 'loyalty_tier')).toBe('gold');
    await core.close();
  });
});

describe('options shim', () => {
  it('strips the prefix and shapes booleans as yes/no', async () => {
    const core = await createTestCore();
    const options = createOptionsShim(core.settings);
    expect(await options.getOption('woocommerce_currency')).toBe('USD');
    expect(await options.getOption('woocommerce_calc_taxes')).toBe('no');
    await options.updateOption('woocommerce_calc_taxes', 'yes');
    expect(await core.settings.getBool('calc_taxes')).toBe(true);
    expect(await options.getOption('woocommerce_calc_taxes')).toBe('yes');
    expect(await options.getOption('woocommerce_missing_option', false)).toBe(false);
    await core.close();
  });

  it('exposes currency helpers and wc_price formatting', async () => {
    const core = await createTestCore();
    const options = createOptionsShim(core.settings);
    expect(await options.getWoocommerceCurrency()).toBe('USD');
    expect(await options.getWoocommerceCurrencySymbol()).toBe('$');
    expect(await options.wcPrice('1234.5000')).toBe('$1,234.50');
    await core.settings.set('currency_pos', 'right_space');
    expect(await options.wcPrice('5.0000')).toBe('5.00 $');
    await core.close();
  });
});
