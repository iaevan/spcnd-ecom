import {
  CONTINENTS,
  filterPackageRates,
  postcodeLocationMatches,
  type ShippingPackage,
  type ShippingRateQuote,
  type ShippingService,
} from '@spacendigital/core';
import type { SpcndDb } from '@spacendigital/db';
import type { TypedBus } from '@spacendigital/plugin-system';
import { Money } from '@spacendigital/types';
import { asc, eq } from 'drizzle-orm';
import { evaluateCost } from './cost-expression.js';

/**
 * ShippingService implementation (docs/AGENTS.md §13 step 11; RESUME step 5).
 * Zone resolution: most specific match wins — postcode > state > country >
 * continent > rest-of-world (a zone with no location rows). Methods:
 * flat_rate (cost expressions + per-class costs), free_shipping
 * (min_amount / coupon requirements), local_pickup.
 */

/** Method settings as stored in shipping_zone_methods.settings. */
export interface FlatRateSettings {
  title?: string;
  taxStatus?: 'taxable' | 'none';
  cost?: string;
  /** Extra cost expression per shipping class id; 'no_class' for classless items. */
  classCosts?: Record<string, string>;
  noClassCost?: string;
  /** 'class' = sum every class cost present; 'order' = only the highest. */
  calculationType?: 'class' | 'order';
}

export interface FreeShippingSettings {
  title?: string;
  requires?: '' | 'min_amount' | 'coupon' | 'either' | 'both';
  minAmount?: string;
}

export interface LocalPickupSettings {
  title?: string;
  taxStatus?: 'taxable' | 'none';
  cost?: string;
}

interface Deps {
  db: SpcndDb;
  bus?: TypedBus;
}

interface ZoneMatch {
  zoneId: number;
  score: number;
  zoneOrder: number;
}

export class DbShippingService implements ShippingService {
  constructor(private readonly deps: Deps) {}

  async getRatesForPackage(pkg: ShippingPackage): Promise<ShippingRateQuote[]> {
    const { db, bus } = this.deps;
    const zoneId = await this.resolveZone(pkg);
    if (zoneId === null) return [];
    const s = db.schema;
    const methods = await db.drizzle
      .select()
      .from(s.shippingZoneMethods)
      .where(eq(s.shippingZoneMethods.zoneId, zoneId))
      .orderBy(asc(s.shippingZoneMethods.methodOrder), asc(s.shippingZoneMethods.id));

    const quotes: ShippingRateQuote[] = [];
    for (const method of methods) {
      if (!method.isEnabled) continue;
      const quote = this.quoteForMethod(method.methodId, method.id, method.settings ?? {}, pkg);
      if (quote) quotes.push(quote);
    }
    if (!bus) return quotes;
    return (await bus.applyFilters(filterPackageRates, quotes as unknown as Record<string, unknown>, pkg)) as unknown as ShippingRateQuote[];
  }

  /**
   * Most-specific-zone resolution. Zones with postcode rules are excluded
   * outright when the destination postcode misses them (WC behavior).
   */
  private async resolveZone(pkg: ShippingPackage): Promise<number | null> {
    const { db } = this.deps;
    const s = db.schema;
    const zones = await db.drizzle
      .select()
      .from(s.shippingZones)
      .orderBy(asc(s.shippingZones.zoneOrder), asc(s.shippingZones.id));
    if (zones.length === 0) return null;
    const locations = await db.drizzle.select().from(s.shippingZoneLocations);

    const country = pkg.destination.country.toUpperCase();
    const stateCode = `${country}:${pkg.destination.state.toUpperCase()}`;
    const continent = continentOf(country);
    const postcode = pkg.destination.postcode;

    let best: ZoneMatch | null = null;
    for (const zone of zones) {
      const zoneLocations = locations.filter((l) => l.zoneId === zone.id);
      const postcodes = zoneLocations.filter((l) => l.locationType === 'postcode');
      const regions = zoneLocations.filter((l) => l.locationType !== 'postcode');

      const postcodeMatched =
        postcodes.length > 0 &&
        postcode !== '' &&
        postcodes.some((l) => postcodeLocationMatches(postcode, l.locationCode));
      if (postcodes.length > 0 && !postcodeMatched) continue;

      let score: number;
      if (regions.some((l) => l.locationType === 'state' && l.locationCode.toUpperCase() === stateCode)) {
        score = 3;
      } else if (
        regions.some((l) => l.locationType === 'country' && l.locationCode.toUpperCase() === country)
      ) {
        score = 2;
      } else if (
        regions.some(
          (l) => l.locationType === 'continent' && l.locationCode.toUpperCase() === continent,
        )
      ) {
        score = 1;
      } else if (zoneLocations.length === 0) {
        score = 0; // Rest of world.
      } else {
        continue;
      }
      if (postcodeMatched) score = 4;

      if (
        best === null ||
        score > best.score ||
        (score === best.score && zone.zoneOrder < best.zoneOrder)
      ) {
        best = { zoneId: zone.id, score, zoneOrder: zone.zoneOrder };
      }
    }
    return best?.zoneId ?? null;
  }

  private quoteForMethod(
    methodId: string,
    instanceId: number,
    settings: Record<string, unknown>,
    pkg: ShippingPackage,
  ): ShippingRateQuote | null {
    switch (methodId) {
      case 'flat_rate':
        return this.flatRate(settings as FlatRateSettings, instanceId, pkg);
      case 'free_shipping':
        return this.freeShipping(settings as FreeShippingSettings, instanceId, pkg);
      case 'local_pickup':
        return this.localPickup(settings as LocalPickupSettings, instanceId);
      default:
        return null;
    }
  }

  private flatRate(
    settings: FlatRateSettings,
    instanceId: number,
    pkg: ShippingPackage,
  ): ShippingRateQuote {
    const shippable = pkg.items.filter((i) => i.needsShipping);
    const totalQty = shippable.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = shippable.reduce((sum, i) => sum + i.lineTotalMinor, 0) / 10000;
    let cost = evaluateCost(settings.cost, { qty: totalQty, cost: subtotal });

    const classCosts = settings.classCosts ?? {};
    const hasClassCosts = Object.keys(classCosts).length > 0 || settings.noClassCost !== undefined;
    if (hasClassCosts && shippable.length > 0) {
      const groups = new Map<string, { qty: number; cost: number }>();
      for (const item of shippable) {
        const key = item.shippingClassId === null ? 'no_class' : String(item.shippingClassId);
        const group = groups.get(key) ?? { qty: 0, cost: 0 };
        group.qty += item.quantity;
        group.cost += item.lineTotalMinor / 10000;
        groups.set(key, group);
      }
      const classAmounts: number[] = [];
      for (const [key, group] of groups) {
        const expr = key === 'no_class' ? (settings.noClassCost ?? classCosts.no_class) : classCosts[key];
        if (expr === undefined || expr === '') continue;
        classAmounts.push(evaluateCost(expr, group));
      }
      if (classAmounts.length > 0) {
        cost +=
          (settings.calculationType ?? 'class') === 'order'
            ? Math.max(...classAmounts)
            : classAmounts.reduce((a, b) => a + b, 0);
      }
    }

    return {
      rateId: `flat_rate:${instanceId}`,
      methodId: 'flat_rate',
      instanceId,
      label: settings.title ?? 'Flat rate',
      costMinor: Money.fromDecimal(cost).minor,
      taxable: (settings.taxStatus ?? 'taxable') === 'taxable',
      isLocalPickup: false,
    };
  }

  /** Hidden (null) when its requirements are not met — WC availability. */
  private freeShipping(
    settings: FreeShippingSettings,
    instanceId: number,
    pkg: ShippingPackage,
  ): ShippingRateQuote | null {
    const requires = settings.requires ?? '';
    const minAmountMinor = Money.fromDecimal(settings.minAmount ?? 0).minor;
    const meetsMin = minAmountMinor > 0 && pkg.cartSubtotalMinor >= minAmountMinor;
    const hasCoupon = pkg.hasCouponFreeShipping;
    let available: boolean;
    switch (requires) {
      case 'min_amount':
        available = meetsMin;
        break;
      case 'coupon':
        available = hasCoupon;
        break;
      case 'either':
        available = meetsMin || hasCoupon;
        break;
      case 'both':
        available = meetsMin && hasCoupon;
        break;
      default:
        available = true;
    }
    if (!available) return null;
    return {
      rateId: `free_shipping:${instanceId}`,
      methodId: 'free_shipping',
      instanceId,
      label: settings.title ?? 'Free shipping',
      costMinor: 0,
      taxable: false,
      isLocalPickup: false,
    };
  }

  private localPickup(settings: LocalPickupSettings, instanceId: number): ShippingRateQuote {
    return {
      rateId: `local_pickup:${instanceId}`,
      methodId: 'local_pickup',
      instanceId,
      label: settings.title ?? 'Local pickup',
      costMinor: Money.fromDecimal(settings.cost ?? 0).minor,
      taxable: (settings.taxStatus ?? 'taxable') === 'taxable',
      isLocalPickup: true,
    };
  }
}

function continentOf(country: string): string {
  for (const [code, continent] of Object.entries(CONTINENTS)) {
    if (continent.countries.includes(country)) return code;
  }
  return '';
}
