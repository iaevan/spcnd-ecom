import { and, eq } from 'drizzle-orm';
import type { SpcndDb } from './types.js';

export interface SeedProduct {
  name: string;
  slug: string;
  type?: string;
  description?: string;
  shortDescription?: string;
  sku?: string;
  regularPrice?: string;
  salePrice?: string;
  status?: string;
  virtual?: boolean;
  downloadable?: boolean;
  featured?: boolean;
  taxStatus?: string;
  taxClass?: string;
  manageStock?: boolean;
  stockQuantity?: number;
  stockStatus?: string;
  weight?: number;
  weightUnit?: string;
  categories?: string[];
  tags?: string[];
  images?: { url: string; alt?: string }[];
}

export interface SeedData {
  settings?: {
    string?: Record<string, string>;
    boolean?: Record<string, boolean>;
    integer?: Record<string, number>;
    json?: Record<string, unknown>;
  };
  users?: {
    email: string;
    password?: string;
    passwordHash?: string;
    role?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  }[];
  categories?: { name: string; slug: string; description?: string; parent?: string }[];
  tags?: { name: string; slug: string }[];
  products?: SeedProduct[];
  coupons?: Record<string, unknown>[];
  taxClasses?: { name: string; slug: string }[];
  taxRates?: {
    country?: string;
    state?: string;
    name?: string;
    rate: string;
    priority?: number;
    compound?: boolean;
    shipping?: boolean;
    taxClass?: string;
    postcodes?: string[];
    cities?: string[];
  }[];
  shippingZones?: {
    name: string;
    order?: number;
    locations?: { type: string; code: string }[];
    methods?: { methodId: string; settings?: Record<string, unknown>; enabled?: boolean }[];
  }[];
}

export interface SeedOptions {
  /** Hash plaintext `password` fields; required when seed users carry passwords. */
  hashPassword?: (password: string) => Promise<string>;
  log?: (message: string) => void;
}

const now = () => new Date().toISOString();

/**
 * Idempotent seed runner: rows are matched on natural keys (slug / email /
 * code) and inserted only when missing, so re-running a seed is safe.
 */
export async function runSeed(db: SpcndDb, seed: SeedData, opts: SeedOptions = {}): Promise<void> {
  const log = opts.log ?? (() => {});
  const s = db.schema;

  await db.transaction(async (tx) => {
    const d = tx.drizzle;

    for (const [key, value] of Object.entries(seed.settings?.string ?? {})) {
      const existing = await d.select().from(s.settingsString).where(eq(s.settingsString.key, key));
      if (existing.length === 0) await d.insert(s.settingsString).values({ key, value });
    }
    for (const [key, value] of Object.entries(seed.settings?.boolean ?? {})) {
      const existing = await d
        .select()
        .from(s.settingsBoolean)
        .where(eq(s.settingsBoolean.key, key));
      if (existing.length === 0) await d.insert(s.settingsBoolean).values({ key, value });
    }
    for (const [key, value] of Object.entries(seed.settings?.integer ?? {})) {
      const existing = await d
        .select()
        .from(s.settingsInteger)
        .where(eq(s.settingsInteger.key, key));
      if (existing.length === 0) await d.insert(s.settingsInteger).values({ key, value });
    }
    for (const [key, value] of Object.entries(seed.settings?.json ?? {})) {
      const existing = await d.select().from(s.settingsJson).where(eq(s.settingsJson.key, key));
      if (existing.length === 0) await d.insert(s.settingsJson).values({ key, value });
    }

    for (const user of seed.users ?? []) {
      const existing = await d.select().from(s.customers).where(eq(s.customers.email, user.email));
      if (existing.length > 0) continue;
      let passwordHash = user.passwordHash;
      if (!passwordHash && user.password) {
        if (!opts.hashPassword) {
          throw new Error(`Seed user ${user.email} has a plaintext password but no hashPassword was provided`);
        }
        passwordHash = await opts.hashPassword(user.password);
      }
      if (!passwordHash) throw new Error(`Seed user ${user.email} needs password or passwordHash`);
      await d.insert(s.customers).values({
        email: user.email,
        passwordHash,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        displayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
        username: user.username ?? user.email.split('@')[0],
        role: (user.role ?? 'customer') as 'customer',
        isPayingCustomer: false,
        totalSpent: '0.0000',
        orderCount: 0,
        dateCreated: now(),
        dateModified: now(),
      });
      log(`seeded user ${user.email}`);
    }

    const categoryIds = new Map<string, number>();
    for (const cat of seed.categories ?? []) {
      const existing = await d
        .select()
        .from(s.productCategories)
        .where(eq(s.productCategories.slug, cat.slug));
      if (existing.length > 0) {
        categoryIds.set(cat.slug, existing[0]!.id);
        continue;
      }
      const parentId = cat.parent ? (categoryIds.get(cat.parent) ?? null) : null;
      await d.insert(s.productCategories).values({
        name: cat.name,
        slug: cat.slug,
        description: cat.description ?? '',
        parentId,
        displayType: 'default',
        sortOrder: 0,
      });
      const inserted = await d
        .select({ id: s.productCategories.id })
        .from(s.productCategories)
        .where(eq(s.productCategories.slug, cat.slug));
      categoryIds.set(cat.slug, inserted[0]!.id);
      log(`seeded category ${cat.slug}`);
    }

    const tagIds = new Map<string, number>();
    for (const tag of seed.tags ?? []) {
      const existing = await d.select().from(s.productTags).where(eq(s.productTags.slug, tag.slug));
      if (existing.length > 0) {
        tagIds.set(tag.slug, existing[0]!.id);
        continue;
      }
      await d.insert(s.productTags).values({ name: tag.name, slug: tag.slug, description: '' });
      const row = await d.select().from(s.productTags).where(eq(s.productTags.slug, tag.slug));
      tagIds.set(tag.slug, row[0]!.id);
    }

    for (const p of seed.products ?? []) {
      const existing = await d.select().from(s.products).where(eq(s.products.slug, p.slug));
      if (existing.length > 0) continue;
      const regular = p.regularPrice ?? '0.0000';
      const sale = p.salePrice ?? null;
      await d.insert(s.products).values({
        type: (p.type ?? 'simple') as 'simple',
        name: p.name,
        slug: p.slug,
        description: p.description ?? '',
        shortDescription: p.shortDescription ?? '',
        sku: p.sku ?? null,
        regularPrice: regular,
        salePrice: sale,
        price: sale ?? regular,
        status: (p.status ?? 'publish') as 'publish',
        catalogVisibility: 'visible',
        featured: p.featured ?? false,
        virtual: p.virtual ?? false,
        downloadable: p.downloadable ?? false,
        taxStatus: (p.taxStatus ?? 'taxable') as 'taxable',
        taxClass: p.taxClass ?? '',
        manageStock: p.manageStock ?? false,
        stockQuantity: p.stockQuantity ?? null,
        stockStatus: (p.stockStatus ?? 'instock') as 'instock',
        backorders: 'no',
        soldIndividually: false,
        weight: p.weight ?? null,
        weightUnit: p.weightUnit ?? null,
        purchaseNote: '',
        menuOrder: 0,
        reviewsAllowed: true,
        galleryImageIds: [],
        downloadLimit: -1,
        downloadExpiry: -1,
        totalSales: 0,
        averageRating: 0,
        reviewCount: 0,
        ratingCounts: {},
        defaultAttributes: [],
        attributes: [],
        downloads: [],
        dateCreated: now(),
        dateModified: now(),
      });
      const prow = (await d.select().from(s.products).where(eq(s.products.slug, p.slug)))[0]!;

      for (const img of p.images ?? []) {
        await d.insert(s.media).values({
          url: img.url,
          alt: img.alt ?? p.name,
          name: p.name,
          source: 'external',
          dateCreated: now(),
        });
        const mrow = await tx.queryRaw<{ id: number }>(
          db.dialect === 'postgres'
            ? 'SELECT id FROM media WHERE url = $1 ORDER BY id DESC LIMIT 1'
            : 'SELECT id FROM media WHERE url = ? ORDER BY id DESC LIMIT 1',
          [img.url],
        );
        const mediaId = Number(mrow[0]?.id);
        if ((p.images ?? []).indexOf(img) === 0) {
          await d.update(s.products).set({ imageId: mediaId }).where(eq(s.products.id, prow.id));
        }
        await d.insert(s.mediaLinks).values({
          mediaId,
          ownerType: 'product',
          ownerId: prow.id,
          sortOrder: (p.images ?? []).indexOf(img),
        });
      }

      for (const slug of p.categories ?? []) {
        const catId = categoryIds.get(slug);
        if (catId) {
          await d.insert(s.productCategoryMap).values({ productId: prow.id, categoryId: catId });
        }
      }
      for (const slug of p.tags ?? []) {
        const tagId = tagIds.get(slug);
        if (tagId) await d.insert(s.productTagMap).values({ productId: prow.id, tagId });
      }

      await d.insert(s.productMetaLookup).values({
        productId: prow.id,
        sku: p.sku ?? null,
        virtual: p.virtual ?? false,
        downloadable: p.downloadable ?? false,
        minPrice: sale ?? regular,
        maxPrice: sale ?? regular,
        onsale: sale !== null,
        stockQuantity: p.stockQuantity ?? null,
        stockStatus: p.stockStatus ?? 'instock',
        ratingCount: 0,
        averageRating: 0,
        totalSales: 0,
        taxStatus: p.taxStatus ?? 'taxable',
        taxClass: p.taxClass ?? '',
      });
      log(`seeded product ${p.slug}`);
    }

    for (const c of seed.coupons ?? []) {
      const code = String(c.code ?? '').toLowerCase();
      if (!code) continue;
      const existing = await d.select().from(s.coupons).where(eq(s.coupons.code, code));
      if (existing.length > 0) continue;
      await d.insert(s.coupons).values({
        code,
        amount: String(c.amount ?? '0'),
        status: 'publish',
        description: String(c.description ?? ''),
        discountType: (c.discountType ?? 'fixed_cart') as 'fixed_cart',
        dateExpires: (c.dateExpires as string) ?? null,
        usageCount: 0,
        individualUse: Boolean(c.individualUse ?? false),
        usageLimit: (c.usageLimit as number) ?? null,
        usageLimitPerUser: (c.usageLimitPerUser as number) ?? null,
        limitUsageToXItems: null,
        freeShipping: Boolean(c.freeShipping ?? false),
        excludeSaleItems: Boolean(c.excludeSaleItems ?? false),
        minimumAmount: (c.minimumAmount as string) ?? null,
        maximumAmount: (c.maximumAmount as string) ?? null,
        emailRestrictions: [],
        productIds: (c.productIds as number[]) ?? [],
        excludedProductIds: [],
        productCategories: [],
        excludedProductCategories: [],
        dateCreated: now(),
        dateModified: now(),
      });
      log(`seeded coupon ${code}`);
    }

    const taxClassIds = new Map<string, number>();
    for (const tc of seed.taxClasses ?? []) {
      const existing = await d.select().from(s.taxClasses).where(eq(s.taxClasses.slug, tc.slug));
      if (existing.length > 0) {
        taxClassIds.set(tc.slug, existing[0]!.id);
        continue;
      }
      await d.insert(s.taxClasses).values({ name: tc.name, slug: tc.slug });
      const row = await d.select().from(s.taxClasses).where(eq(s.taxClasses.slug, tc.slug));
      taxClassIds.set(tc.slug, row[0]!.id);
    }

    for (const rate of seed.taxRates ?? []) {
      const country = rate.country ?? '';
      const state = rate.state ?? '';
      const name = rate.name ?? 'Tax';
      const existing = await d
        .select()
        .from(s.taxRates)
        .where(
          and(
            eq(s.taxRates.country, country),
            eq(s.taxRates.state, state),
            eq(s.taxRates.name, name),
          ),
        );
      if (existing.length > 0) continue;
      const taxClassId = rate.taxClass ? (taxClassIds.get(rate.taxClass) ?? null) : null;
      await d.insert(s.taxRates).values({
        taxClassId,
        country,
        state,
        name,
        rate: rate.rate,
        priority: rate.priority ?? 1,
        compound: rate.compound ?? false,
        shipping: rate.shipping ?? true,
        order: 0,
      });
      const row = await d
        .select()
        .from(s.taxRates)
        .where(
          and(
            eq(s.taxRates.country, country),
            eq(s.taxRates.state, state),
            eq(s.taxRates.name, name),
          ),
        );
      const rateId = row[0]!.id;
      for (const postcode of rate.postcodes ?? []) {
        await d.insert(s.taxRateLocations).values({
          taxRateId: rateId,
          locationCode: postcode,
          locationType: 'postcode',
        });
      }
      for (const city of rate.cities ?? []) {
        await d.insert(s.taxRateLocations).values({
          taxRateId: rateId,
          locationCode: city.toUpperCase(),
          locationType: 'city',
        });
      }
      log(`seeded tax rate ${name}`);
    }

    for (const zone of seed.shippingZones ?? []) {
      const existing = await d
        .select()
        .from(s.shippingZones)
        .where(eq(s.shippingZones.zoneName, zone.name));
      if (existing.length > 0) continue;
      await d
        .insert(s.shippingZones)
        .values({ zoneName: zone.name, zoneOrder: zone.order ?? 0 });
      const zrow = await d
        .select()
        .from(s.shippingZones)
        .where(eq(s.shippingZones.zoneName, zone.name));
      const zoneId = zrow[0]!.id;
      for (const loc of zone.locations ?? []) {
        await d.insert(s.shippingZoneLocations).values({
          zoneId,
          locationCode: loc.code,
          locationType: loc.type as 'country',
        });
      }
      let order = 0;
      for (const method of zone.methods ?? []) {
        await d.insert(s.shippingZoneMethods).values({
          zoneId,
          methodId: method.methodId,
          methodOrder: order++,
          isEnabled: method.enabled ?? true,
          settings: method.settings ?? {},
        });
      }
      log(`seeded shipping zone ${zone.name}`);
    }
  });
}
