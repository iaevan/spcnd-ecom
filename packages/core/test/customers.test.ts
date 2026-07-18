import { describe, expect, it } from 'vitest';
import { createTestCore } from './helpers.js';

describe('CustomerService', () => {
  it('creates customers, rejects duplicate emails, stores addresses', async () => {
    const core = await createTestCore();
    const customer = await core.customers.create({
      email: 'Jo@Example.com',
      firstName: 'Jo',
      lastName: 'Doe',
      billing: { firstName: 'Jo', country: 'US', city: 'NYC' },
    });
    expect(customer.email).toBe('jo@example.com');
    expect(customer.displayName).toBe('Jo Doe');
    await expect(core.customers.create({ email: 'jo@example.com' })).rejects.toThrow(
      /already registered/,
    );
    const billing = await core.customers.getAddress(customer.id, 'billing');
    expect(billing.country).toBe('US');
    // Upsert, not duplicate (unique per customer+type).
    await core.customers.setAddress(customer.id, 'billing', { country: 'DE', city: 'Berlin' });
    const updated = await core.customers.getAddress(customer.id, 'billing');
    expect(updated.country).toBe('DE');
    await core.close();
  });

  it('guest conversion persists the row without a credential', async () => {
    const core = await createTestCore();
    const customer = await core.customers.registerFromGuest({
      email: 'guest@example.com',
      firstName: 'G',
    });
    expect(customer.passwordHash).toBe('');
    expect(customer.role).toBe('customer');
    await core.close();
  });

  it('updates and deletes', async () => {
    const core = await createTestCore();
    const customer = await core.customers.create({ email: 'a@b.co' });
    const updated = await core.customers.update(customer.id, { firstName: 'New' });
    expect(updated.firstName).toBe('New');
    await core.customers.delete(customer.id);
    expect(await core.customers.find(customer.id)).toBeUndefined();
    await core.close();
  });
});
