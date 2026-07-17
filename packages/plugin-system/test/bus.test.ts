import { describe, expect, it } from 'vitest';
import { TypedBus, defineEvent, defineFilter } from '../src/bus.js';
import { Container, createToken } from '../src/container.js';
import { PluginLoadError, defineSpcndPlugin, setupPlugins } from '../src/plugin.js';

describe('TypedBus', () => {
  it('runs handlers in priority order, ties broken by registration order', async () => {
    const bus = new TypedBus();
    const event = defineEvent<string[]>('test.order');
    const calls: string[] = [];
    bus.on(event, () => void calls.push('b'), 20);
    bus.on(event, () => void calls.push('a'), 5);
    bus.on(event, () => void calls.push('c'), 20);
    await bus.emit(event, calls);
    expect(calls).toEqual(['a', 'b', 'c']);
  });

  it('filters accumulate value transformations', async () => {
    const bus = new TypedBus();
    const filter = defineFilter<number, [string]>('test.price');
    bus.filter(filter, (v) => v + 1);
    bus.filter(filter, (v, label) => (label === 'double' ? v * 2 : v));
    expect(await bus.applyFilters(filter, 10, 'double')).toBe(22);
  });

  it('aliases share one handler chain (compat pipeline)', async () => {
    const bus = new TypedBus();
    bus.alias('woocommerce_product_get_price', 'product.get_price');
    bus.onName('woocommerce_product_get_price', (v) => (v as number) * 2);
    bus.onName('product.get_price', (v) => (v as number) + 1, 5);
    const result = bus.applyFiltersSync('product.get_price', 10);
    expect(result).toBe(22);
    const viaAlias = bus.applyFiltersSync('woocommerce_product_get_price', 10);
    expect(viaAlias).toBe(22);
  });

  it('sync filters reject async handlers', () => {
    const bus = new TypedBus();
    bus.onName('sync.only', async (v) => v);
    expect(() => bus.applyFiltersSync('sync.only', 1)).toThrow(/sync/i);
  });

  it('unsubscribe and once work', async () => {
    const bus = new TypedBus();
    const event = defineEvent<undefined>('test.once');
    let count = 0;
    bus.once(event, () => void count++);
    const off = bus.on(event, () => void count++);
    await bus.emit(event, undefined);
    off();
    await bus.emit(event, undefined);
    expect(count).toBe(2);
  });
});

describe('Container', () => {
  it('registers and resolves typed services, lazily via factories', () => {
    const container = new Container();
    const token = createToken<{ ping(): string }>('ping');
    let built = 0;
    container.registerFactory(token, () => {
      built++;
      return { ping: () => 'pong' };
    });
    expect(built).toBe(0);
    expect(container.resolve(token).ping()).toBe('pong');
    expect(container.resolve(token).ping()).toBe('pong');
    expect(built).toBe(1);
    expect(() => container.resolve(createToken('missing'))).toThrow(/not registered/);
  });
});

describe('setupPlugins', () => {
  const host = () => ({
    bus: new TypedBus(),
    container: new Container(),
    capabilities: new Set(['node:fs']),
    log: () => {},
  });

  it('orders by requires and enforces capabilities', async () => {
    const order: string[] = [];
    const a = defineSpcndPlugin({ id: 'a', version: '1.0.0', requires: ['b'], setup: () => void order.push('a') });
    const b = defineSpcndPlugin({ id: 'b', version: '1.0.0', setup: () => void order.push('b') });
    await setupPlugins([a, b], host());
    expect(order).toEqual(['b', 'a']);

    const needsEdge = defineSpcndPlugin({
      id: 'edge-only',
      version: '1.0.0',
      capabilities: ['edge:kv'],
      setup: () => {},
    });
    await expect(setupPlugins([needsEdge], host())).rejects.toThrow(PluginLoadError);
  });

  it('rejects circular requires', async () => {
    const a = defineSpcndPlugin({ id: 'a', version: '1', requires: ['b'], setup: () => {} });
    const b = defineSpcndPlugin({ id: 'b', version: '1', requires: ['a'], setup: () => {} });
    await expect(setupPlugins([a, b], host())).rejects.toThrow(/circular/);
  });
});
