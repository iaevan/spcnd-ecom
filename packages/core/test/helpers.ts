import { migrate, sqlite } from '@spacendigital/db';
import { createSpcndCore, type SpcndCore } from '../src/index.js';
import type { CreateProductInput } from '../src/catalog/product-service.js';
import type { Product } from '../src/entities.js';

/** Fresh isolated core over an in-memory SQLite with migrations applied. */
export async function createTestCore(): Promise<SpcndCore> {
  const db = await sqlite(':memory:').connect();
  await migrate(db);
  return createSpcndCore({ db });
}

export async function seedProduct(
  core: SpcndCore,
  overrides: Partial<CreateProductInput> & { name?: string } = {},
): Promise<Product> {
  return core.products.create({
    name: 'Test Product',
    regularPrice: '10.0000',
    ...overrides,
  } as CreateProductInput);
}

export async function seedCategory(core: SpcndCore, name: string, slug: string): Promise<number> {
  const s = core.db.schema;
  await core.db.drizzle
    .insert(s.productCategories)
    .values({ name, slug, description: '', displayType: 'default', sortOrder: 0 });
  const rows = await core.db.drizzle.select().from(s.productCategories);
  const row = rows.find((r) => r.slug === slug);
  if (!row) throw new Error('category seed failed');
  return row.id;
}

export const US_BILLING = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  company: '',
  address1: '1 Analytical Way',
  address2: '',
  city: 'San Francisco',
  state: 'CA',
  postcode: '94103',
  country: 'US',
  email: 'ada@example.com',
  phone: '415 555 0100',
};
