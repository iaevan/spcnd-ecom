import { createSpcndCore, type SpcndCore } from '@spacendigital/core';
import { migrate, sqlite } from '@spacendigital/db';
import { describe, expect, it } from 'vitest';
import TaxPlugin, { calcExclusiveTax, calcInclusiveTax, DbTaxService } from '../src/index.js';

async function createCore(): Promise<SpcndCore> {
  const db = await sqlite(':memory:').connect();
  await migrate(db);
  return createSpcndCore({ db, plugins: [TaxPlugin] });
}

async function seedRate(
  core: SpcndCore,
  over: Partial<typeof core.db.schema.taxRates.$inferInsert> = {},
  locations: { type: 'postcode' | 'city'; code: string }[] = [],
): Promise<number> {
  const s = core.db.schema;
  await core.db.drizzle.insert(s.taxRates).values({
    country: 'US',
    state: '',
    name: 'Tax',
    rate: '10.0000',
    priority: 1,
    compound: false,
    shipping: true,
    order: 0,
    ...over,
  });
  const rows = await core.db.drizzle.select().from(s.taxRates);
  const id = rows[rows.length - 1]!.id;
  for (const loc of locations) {
    await core.db.drizzle
      .insert(s.taxRateLocations)
      .values({ taxRateId: id, locationCode: loc.code, locationType: loc.type });
  }
  return id;
}

const svc = (core: SpcndCore) => new DbTaxService({ db: core.db, settings: core.settings });

const US_CA = { country: 'US', state: 'CA', postcode: '94103', city: 'San Francisco' };

describe('DbTaxService.findRates (§7.3)', () => {
  it('one rate per priority, most specific wins', async () => {
    const core = await createCore();
    const generic = await seedRate(core, { country: '', name: 'Anywhere', rate: '1.0000' });
    const specific = await seedRate(core, { country: 'US', state: 'CA', name: 'CA', rate: '7.2500' });
    const rates = await svc(core).findRates(US_CA, '');
    expect(rates).toHaveLength(1);
    expect(rates[0]).toMatchObject({ id: specific, rate: 7.25, label: 'CA' });
    // Different priority → both returned.
    const secondPriority = await seedRate(core, { country: 'US', priority: 2, name: 'P2' });
    const both = await svc(core).findRates(US_CA, '');
    expect(both.map((r) => r.id)).toEqual([specific, secondPriority]);
    expect(generic).toBeGreaterThan(0);
    await core.close();
  });

  it('honors wildcard and range postcode locations', async () => {
    const core = await createCore();
    const wildcard = await seedRate(core, { name: 'Wild' }, [{ type: 'postcode', code: '941*' }]);
    await svc(core);
    expect((await svc(core).findRates(US_CA, ''))[0]?.id).toBe(wildcard);
    expect(await svc(core).findRates({ ...US_CA, postcode: '90001' }, '')).toEqual([]);

    const s = core.db.schema;
    await core.db.drizzle.delete(s.taxRateLocations);
    await core.db.drizzle.delete(s.taxRates);
    const range = await seedRate(core, { name: 'Range' }, [
      { type: 'postcode', code: '94000...94200' },
    ]);
    expect((await svc(core).findRates(US_CA, ''))[0]?.id).toBe(range);
    expect(await svc(core).findRates({ ...US_CA, postcode: '95000' }, '')).toEqual([]);
    await core.close();
  });

  it('separates tax classes and filters shipping rates', async () => {
    const core = await createCore();
    const s = core.db.schema;
    await core.db.drizzle.insert(s.taxClasses).values({ name: 'Reduced', slug: 'reduced' });
    const reducedClass = (await core.db.drizzle.select().from(s.taxClasses))[0]!;
    await seedRate(core, { name: 'Standard', rate: '20.0000' });
    await seedRate(core, {
      name: 'Reduced',
      rate: '5.0000',
      taxClassId: reducedClass.id,
      shipping: false,
    });

    const standard = await svc(core).findRates(US_CA, '');
    expect(standard[0]?.label).toBe('Standard');
    const reduced = await svc(core).findRates(US_CA, 'reduced');
    expect(reduced[0]?.label).toBe('Reduced');
    expect(await svc(core).findShippingRates(US_CA, 'reduced')).toEqual([]);
    await core.close();
  });

  it('is registered via TaxPlugin and used by the totals engine end-to-end', async () => {
    const core = await createCore();
    await seedRate(core, { country: 'US', name: 'US TAX', rate: '10.0000' });
    await core.settings.set('calc_taxes', true);
    const product = await core.products.create({ name: 'Taxed', regularPrice: '10.0000' });
    await core.cart.addToCart('t1', { productId: product.id });
    const calculated = await core.cart.calculate('t1', {
      taxLocation: US_CA,
    });
    // 10.00 + 10% = 11.00
    expect(calculated.totals.itemsTaxMinor).toBe(10000);
    expect(calculated.totals.totalMinor).toBe(110000);
    await core.close();
  });
});

describe('calc tax math (§7.2)', () => {
  const rate = (id: number, pct: number, compound = false) => ({
    id,
    rate: pct,
    label: 'T',
    shipping: true,
    compound,
  });

  it('exclusive: regular rates on price, compound on top', () => {
    // 100.00 with GST 5% + compound PST 7%: 5.00 then 7% of 105.00 = 7.35.
    const taxes = calcExclusiveTax(1000000, [rate(1, 5), rate(2, 7, true)]);
    expect(taxes.get(1)).toBeCloseTo(50000, 4);
    expect(taxes.get(2)).toBeCloseTo(73500, 4);
  });

  it('inclusive: extracts tax from gross, compound reverse-first', () => {
    // 112.35 gross with 5% regular + 7% compound reverses the exclusive case.
    const taxes = calcInclusiveTax(1123500, [rate(1, 5), rate(2, 7, true)]);
    expect(taxes.get(2)).toBeCloseTo(73500, 2);
    expect(taxes.get(1)).toBeCloseTo(50000, 2);
  });

  it('inclusive with multiple regular rates splits proportionally', () => {
    // 120.00 gross at 10% + 10%: each extracts 10.00.
    const taxes = calcInclusiveTax(1200000, [rate(1, 10), rate(2, 10)]);
    expect(taxes.get(1)).toBeCloseTo(100000, 4);
    expect(taxes.get(2)).toBeCloseTo(100000, 4);
  });
});
