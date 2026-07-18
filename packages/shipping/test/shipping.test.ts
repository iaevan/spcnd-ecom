import { createSpcndCore, type ShippingPackage, type SpcndCore } from '@spacendigital/core';
import { migrate, sqlite } from '@spacendigital/db';
import { describe, expect, it } from 'vitest';
import { evaluateCost } from '../src/cost-expression.js';
import ShippingPlugin, { DbShippingService } from '../src/index.js';

async function createCore(): Promise<SpcndCore> {
  const db = await sqlite(':memory:').connect();
  await migrate(db);
  return createSpcndCore({ db, plugins: [ShippingPlugin] });
}

async function seedZone(
  core: SpcndCore,
  name: string,
  locations: { type: 'postcode' | 'state' | 'country' | 'continent'; code: string }[],
  methods: { methodId: string; settings?: Record<string, unknown> }[],
  order = 0,
): Promise<number> {
  const s = core.db.schema;
  await core.db.drizzle.insert(s.shippingZones).values({ zoneName: name, zoneOrder: order });
  const zone = (await core.db.drizzle.select().from(s.shippingZones)).find(
    (z) => z.zoneName === name,
  )!;
  for (const loc of locations) {
    await core.db.drizzle
      .insert(s.shippingZoneLocations)
      .values({ zoneId: zone.id, locationCode: loc.code, locationType: loc.type });
  }
  let methodOrder = 0;
  for (const m of methods) {
    await core.db.drizzle.insert(s.shippingZoneMethods).values({
      zoneId: zone.id,
      methodId: m.methodId,
      methodOrder: methodOrder++,
      isEnabled: true,
      settings: m.settings ?? {},
    });
  }
  return zone.id;
}

function pkg(over: Partial<ShippingPackage> = {}): ShippingPackage {
  return {
    items: [
      {
        productId: 1,
        variationId: null,
        quantity: 2,
        lineTotalMinor: 500000,
        weight: null,
        shippingClassId: null,
        needsShipping: true,
      },
    ],
    destination: {
      firstName: '',
      lastName: '',
      company: '',
      address1: '',
      address2: '',
      city: 'SF',
      state: 'CA',
      postcode: '94103',
      country: 'US',
    },
    cartSubtotalMinor: 500000,
    hasCouponFreeShipping: false,
    ...over,
  };
}

describe('cost expressions', () => {
  it('substitutes [qty]/[cost] and evaluates arithmetic', () => {
    expect(evaluateCost('10', { qty: 3, cost: 50 })).toBe(10);
    expect(evaluateCost('5 + (2 * [qty])', { qty: 3, cost: 50 })).toBe(11);
    expect(evaluateCost('[cost] / 10', { qty: 1, cost: 50 })).toBe(5);
    expect(evaluateCost('[fee percent="10" min_fee="4"]', { qty: 1, cost: 20 })).toBe(4);
    expect(evaluateCost('[fee percent="10" max_fee="3"]', { qty: 1, cost: 100 })).toBe(3);
    expect(evaluateCost('nonsense * [qty]', { qty: 2, cost: 0 })).toBe(0);
  });
});

describe('zone resolution (specificity)', () => {
  it('postcode > state > country > rest-of-world', async () => {
    const core = await createCore();
    const svc = new DbShippingService({ db: core.db });
    const world = await seedZone(core, 'World', [], [{ methodId: 'flat_rate', settings: { title: 'World' } }], 9);
    const us = await seedZone(core, 'US', [{ type: 'country', code: 'US' }], [
      { methodId: 'flat_rate', settings: { title: 'US' } },
    ]);
    const ca = await seedZone(core, 'California', [{ type: 'state', code: 'US:CA' }], [
      { methodId: 'flat_rate', settings: { title: 'CA' } },
    ]);
    const sf = await seedZone(
      core,
      'SF',
      [
        { type: 'state', code: 'US:CA' },
        { type: 'postcode', code: '941*' },
      ],
      [{ methodId: 'flat_rate', settings: { title: 'SF' } }],
    );

    expect((await svc.getRatesForPackage(pkg()))[0]?.label).toBe('SF');
    const mission = pkg();
    mission.destination.postcode = '94110';
    expect((await svc.getRatesForPackage(mission))[0]?.label).toBe('SF');
    // Outside the 941* wildcard: the SF zone is excluded, state zone wins.
    const oakland = pkg();
    oakland.destination.postcode = '94601';
    expect((await svc.getRatesForPackage(oakland))[0]?.label).toBe('CA');
    const la = pkg();
    la.destination.postcode = '90001';
    expect((await svc.getRatesForPackage(la))[0]?.label).toBe('CA');
    const ny = pkg();
    ny.destination.state = 'NY';
    ny.destination.postcode = '10001';
    expect((await svc.getRatesForPackage(ny))[0]?.label).toBe('US');
    const de = pkg();
    de.destination.country = 'DE';
    de.destination.state = '';
    de.destination.postcode = '10115';
    expect((await svc.getRatesForPackage(de))[0]?.label).toBe('World');
    expect([world, us, ca, sf].every((id) => id > 0)).toBe(true);
    await core.close();
  });

  it('matches continents', async () => {
    const core = await createCore();
    const svc = new DbShippingService({ db: core.db });
    await seedZone(core, 'Europe', [{ type: 'continent', code: 'EU' }], [
      { methodId: 'flat_rate', settings: { title: 'EU zone' } },
    ]);
    const de = pkg();
    de.destination.country = 'DE';
    expect((await svc.getRatesForPackage(de))[0]?.label).toBe('EU zone');
    await core.close();
  });
});

describe('methods', () => {
  it('flat_rate evaluates expressions and per-class costs', async () => {
    const core = await createCore();
    const svc = new DbShippingService({ db: core.db });
    await seedZone(core, 'US', [{ type: 'country', code: 'US' }], [
      {
        methodId: 'flat_rate',
        settings: {
          title: 'Flat',
          cost: '5 + (1 * [qty])',
          classCosts: { '7': '3' },
          noClassCost: '1',
          calculationType: 'class',
        },
      },
    ]);
    const mixed = pkg({
      items: [
        { productId: 1, variationId: null, quantity: 2, lineTotalMinor: 200000, weight: null, shippingClassId: 7, needsShipping: true },
        { productId: 2, variationId: null, quantity: 1, lineTotalMinor: 100000, weight: null, shippingClassId: null, needsShipping: true },
      ],
    });
    // 5 + 1×3qty = 8, + class 7 cost 3 + no-class cost 1 = 12.00
    const [rate] = await svc.getRatesForPackage(mixed);
    expect(rate?.costMinor).toBe(120000);
    await core.close();
  });

  it('free_shipping honors requirements; local_pickup flags pickup', async () => {
    const core = await createCore();
    const svc = new DbShippingService({ db: core.db });
    await seedZone(core, 'US', [{ type: 'country', code: 'US' }], [
      { methodId: 'free_shipping', settings: { requires: 'min_amount', minAmount: '100' } },
      { methodId: 'local_pickup', settings: { cost: '2.50' } },
    ]);
    const below = await svc.getRatesForPackage(pkg({ cartSubtotalMinor: 500000 }));
    expect(below.map((r) => r.methodId)).toEqual(['local_pickup']);
    expect(below[0]).toMatchObject({ costMinor: 25000, isLocalPickup: true });

    const above = await svc.getRatesForPackage(pkg({ cartSubtotalMinor: 1500000 }));
    expect(above.map((r) => r.methodId)).toEqual(['free_shipping', 'local_pickup']);
    expect(above[0]?.costMinor).toBe(0);

    const coupon = await svc.getRatesForPackage(
      pkg({ cartSubtotalMinor: 500000, hasCouponFreeShipping: true }),
    );
    expect(coupon.map((r) => r.methodId)).toEqual(['local_pickup']);
    await core.close();
  });

  it('is wired through the plugin into checkout shipping lines', async () => {
    const core = await createCore();
    await seedZone(core, 'US', [{ type: 'country', code: 'US' }], [
      { methodId: 'flat_rate', settings: { title: 'Ground', cost: '4' } },
    ]);
    const product = await core.products.create({ name: 'Ship me', regularPrice: '10.0000' });
    await core.cart.addToCart('s1', { productId: product.id });
    const calculated = await core.cart.calculate('s1', {
      destination: {
        firstName: '', lastName: '', company: '', address1: '', address2: '',
        city: 'SF', state: 'CA', postcode: '94103', country: 'US',
      },
    });
    expect(calculated.totals.shippingTotalMinor).toBe(40000);
    expect(calculated.totals.totalMinor).toBe(140000);
    expect(calculated.totals.shipping[0]?.label).toBe('Ground');
    await core.close();
  });
});
