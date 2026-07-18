import {
  NotFoundError,
  REVIEWS_SERVICE,
  type Review,
  reviewCreated,
  reviewUpdated,
  SETTINGS_SERVICE,
  type SettingsService,
  SPCND_DB,
  SpcndError,
  type ReviewsService,
} from '@spacendigital/core';
import type { SpcndDb } from '@spacendigital/db';
import { defineSpcndPlugin, type TypedBus } from '@spacendigital/plugin-system';
import type { ReviewStatus } from '@spacendigital/types';
import { and, desc, eq, inArray, or } from 'drizzle-orm';

/**
 * ReviewsService implementation (RESUME step 7): create with verified-owner
 * detection (customer paid for the product), moderation status changes, and
 * product rating sync (average_rating / rating_counts / review_count on the
 * product row + product_meta_lookup, same transaction).
 */

interface Deps {
  db: SpcndDb;
  bus: TypedBus;
  settings: SettingsService;
}

const PAID_STATUSES = ['processing', 'completed'] as const;

export class DbReviewsService implements ReviewsService {
  constructor(private readonly deps: Deps) {}

  async create(input: {
    productId: number;
    rating: number;
    content: string;
    authorName: string;
    authorEmail: string;
    customerId?: number | null;
  }): Promise<number> {
    const { db, bus, settings } = this.deps;
    const s = db.schema;
    if (!(await settings.getBool('enable_reviews'))) {
      throw new SpcndError('Reviews are disabled.', 'reviews_disabled');
    }
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new SpcndError('Please provide a rating between 1 and 5.', 'invalid_review_rating');
    }
    const product = (
      await db.drizzle.select().from(s.products).where(eq(s.products.id, input.productId))
    )[0];
    if (!product) throw new NotFoundError('Product', input.productId);
    if (!product.reviewsAllowed) {
      throw new SpcndError('Reviews are closed for this product.', 'reviews_closed');
    }

    const verified = await this.customerPaidForProduct(
      input.productId,
      input.customerId ?? null,
      input.authorEmail,
    );
    if ((await settings.getBool('review_rating_verification_required')) && !verified) {
      throw new SpcndError(
        'Only customers who purchased this product may leave a review.',
        'review_verification_required',
      );
    }

    const review = await db.transaction(async (tx) => {
      await tx.drizzle.insert(s.reviews).values({
        productId: input.productId,
        customerId: input.customerId ?? null,
        rating: input.rating,
        content: input.content,
        status: 'approved',
        verifiedOwner: verified,
        authorName: input.authorName,
        authorEmail: input.authorEmail.toLowerCase(),
        dateCreated: new Date().toISOString(),
      });
      const row = (
        await tx.drizzle
          .select()
          .from(s.reviews)
          .where(eq(s.reviews.productId, input.productId))
          .orderBy(desc(s.reviews.id))
          .limit(1)
      )[0] as Review;
      await this.syncRatingTx(tx, input.productId);
      return row;
    });
    await bus.emit(reviewCreated, review);
    return review.id;
  }

  async setStatus(reviewId: number, status: string): Promise<void> {
    const { db, bus } = this.deps;
    const s = db.schema;
    const review = (await db.drizzle.select().from(s.reviews).where(eq(s.reviews.id, reviewId)))[0];
    if (!review) throw new NotFoundError('Review', reviewId);
    const updated = await db.transaction(async (tx) => {
      await tx.drizzle
        .update(s.reviews)
        .set({ status: status as ReviewStatus })
        .where(eq(s.reviews.id, reviewId));
      await this.syncRatingTx(tx, review.productId);
      return (await tx.drizzle.select().from(s.reviews).where(eq(s.reviews.id, reviewId)))[0] as Review;
    });
    await bus.emit(reviewUpdated, updated);
  }

  async syncProductRating(productId: number): Promise<void> {
    await this.deps.db.transaction(async (tx) => this.syncRatingTx(tx, productId));
  }

  /** WC `customer_paid_for_product`: a paid order contains this product. */
  private async customerPaidForProduct(
    productId: number,
    customerId: number | null,
    email: string,
  ): Promise<boolean> {
    const { db } = this.deps;
    const s = db.schema;
    const identity = [];
    if (customerId) identity.push(eq(s.orders.customerId, customerId));
    if (email) identity.push(eq(s.orders.billingEmail, email.toLowerCase()));
    if (identity.length === 0) return false;
    const rows = await db.drizzle
      .select({ id: s.orderItems.id })
      .from(s.orderItems)
      .innerJoin(s.orders, eq(s.orders.id, s.orderItems.orderId))
      .where(
        and(
          eq(s.orderItems.productId, productId),
          eq(s.orderItems.type, 'line_item'),
          inArray(s.orders.status, [...PAID_STATUSES]),
          or(...identity),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  /** Recompute approved-review aggregates on the product + lookup row. */
  private async syncRatingTx(tx: SpcndDb, productId: number): Promise<void> {
    const s = tx.schema;
    const approved = await tx.drizzle
      .select({ rating: s.reviews.rating })
      .from(s.reviews)
      .where(and(eq(s.reviews.productId, productId), eq(s.reviews.status, 'approved')));

    const counts: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    let sum = 0;
    for (const row of approved) {
      counts[String(row.rating)] = (counts[String(row.rating)] ?? 0) + 1;
      sum += row.rating;
    }
    const reviewCount = approved.length;
    const average = reviewCount === 0 ? 0 : Math.round((sum / reviewCount) * 100) / 100;

    await tx.drizzle
      .update(s.products)
      .set({ averageRating: average, ratingCounts: counts, reviewCount })
      .where(eq(s.products.id, productId));
    await tx.drizzle
      .update(s.productMetaLookup)
      .set({ averageRating: average, ratingCount: reviewCount })
      .where(eq(s.productMetaLookup.productId, productId));
  }
}

/** Registers the ReviewsService implementation in the app container. */
export const ReviewsPlugin = defineSpcndPlugin({
  id: 'spacendigital/reviews',
  version: '0.1.0',
  setup({ bus, container }) {
    container.registerFactory(REVIEWS_SERVICE, (c) => {
      return new DbReviewsService({
        db: c.resolve(SPCND_DB),
        bus,
        settings: c.resolve(SETTINGS_SERVICE),
      });
    });
  },
});

export default ReviewsPlugin;
