import { createSpcndCore, REVIEWS_SERVICE, type SpcndCore } from '@spacendigital/core';
import { migrate, sqlite } from '@spacendigital/db';
import { describe, expect, it } from 'vitest';
import ReviewsPlugin from '../src/index.js';

async function createCore(): Promise<SpcndCore> {
  const db = await sqlite(':memory:').connect();
  await migrate(db);
  return createSpcndCore({ db, plugins: [ReviewsPlugin] });
}

const BILLING = {
  firstName: 'Ada',
  lastName: 'L',
  address1: '1 Way',
  city: 'SF',
  state: 'CA',
  postcode: '94103',
  country: 'US',
  email: 'buyer@example.com',
  phone: '',
};

describe('DbReviewsService', () => {
  it('creates reviews and syncs product rating aggregates', async () => {
    const core = await createCore();
    const reviews = core.container.resolve(REVIEWS_SERVICE);
    const product = await core.products.create({ name: 'Rated', regularPrice: '10.0000' });

    await reviews.create({
      productId: product.id,
      rating: 5,
      content: 'Great',
      authorName: 'A',
      authorEmail: 'a@t.co',
    });
    await reviews.create({
      productId: product.id,
      rating: 4,
      content: 'Good',
      authorName: 'B',
      authorEmail: 'b@t.co',
    });

    const synced = await core.products.get(product.id);
    expect(synced.reviewCount).toBe(2);
    expect(Number(synced.averageRating)).toBeCloseTo(4.5, 2);
    expect(synced.ratingCounts).toMatchObject({ '4': 1, '5': 1 });
    await core.close();
  });

  it('marks verified owners from paid orders and enforces verification setting', async () => {
    const core = await createCore();
    const reviews = core.container.resolve(REVIEWS_SERVICE);
    const product = await core.products.create({ name: 'Bought', regularPrice: '10.0000' });
    await core.cart.addToCart('rv', { productId: product.id });
    await core.checkout.processCheckout('rv', { billing: BILLING, paymentMethod: 'cod' });

    const id = await reviews.create({
      productId: product.id,
      rating: 5,
      content: 'As a buyer',
      authorName: 'Buyer',
      authorEmail: BILLING.email,
    });
    const s = core.db.schema;
    const row = (await core.db.drizzle.select().from(s.reviews)).find((r) => r.id === id);
    expect(row?.verifiedOwner).toBe(true);

    await core.settings.set('review_rating_verification_required', true);
    await expect(
      reviews.create({
        productId: product.id,
        rating: 1,
        content: 'Never bought',
        authorName: 'Stranger',
        authorEmail: 'stranger@t.co',
      }),
    ).rejects.toThrow(/purchased this product/);
    await core.close();
  });

  it('moderation status changes resync the aggregates', async () => {
    const core = await createCore();
    const reviews = core.container.resolve(REVIEWS_SERVICE);
    const product = await core.products.create({ name: 'Mod', regularPrice: '5.0000' });
    const id = await reviews.create({
      productId: product.id,
      rating: 1,
      content: 'Spammy',
      authorName: 'S',
      authorEmail: 's@t.co',
    });
    expect((await core.products.get(product.id)).reviewCount).toBe(1);
    await reviews.setStatus(id, 'spam');
    const after = await core.products.get(product.id);
    expect(after.reviewCount).toBe(0);
    expect(Number(after.averageRating)).toBe(0);
    await core.close();
  });
});
