import {
  filterFindRates,
  type MatchedTaxRate,
  postcodeLocationMatches,
  type SettingsService,
  type TaxLocation,
  type TaxService,
} from '@spacendigital/core';
import type { SpcndDb } from '@spacendigital/db';
import type { TypedBus } from '@spacendigital/plugin-system';
import { eq, inArray, or } from 'drizzle-orm';

/**
 * WC_Tax port (woocommerce_comprehensive_report.md §7). Rate matching and the
 * inclusive/exclusive/compound math follow §7.3 and §7.2 exactly; amounts are
 * returned unrounded per rate id — the core TotalsEngine owns rounding
 * (per-line vs at-subtotal).
 */

interface Deps {
  db: SpcndDb;
  settings: SettingsService;
  bus?: TypedBus;
}

interface CandidateRate {
  id: number;
  rate: number;
  label: string;
  shipping: boolean;
  compound: boolean;
  priority: number;
  countrySpecific: boolean;
  stateSpecific: boolean;
  postcodeCount: number;
  cityCount: number;
}

export class DbTaxService implements TaxService {
  private classSlugCache = new Map<string, number | null>();

  constructor(private readonly deps: Deps) {}

  /** §7.3 find_rates: match, specificity-sort, one rate per priority. */
  async findRates(location: TaxLocation, taxClass: string): Promise<MatchedTaxRate[]> {
    const { db, bus } = this.deps;
    const s = db.schema;
    const country = (location.country || '').toUpperCase();
    const state = (location.state || '').toUpperCase();
    const city = (location.city || '').toUpperCase().trim();
    const postcode = location.postcode || '';

    const taxClassId = await this.classIdForSlug(taxClass);

    // Main criteria (ANDed): country/state IN (value, ''), matching class.
    const rows = await db.drizzle
      .select()
      .from(s.taxRates)
      .where(
        taxClassId === null
          ? or(eq(s.taxRates.country, country), eq(s.taxRates.country, ''))
          : eq(s.taxRates.taxClassId, taxClassId),
      );
    const mainMatched = rows.filter((r) => {
      const classOk = taxClassId === null ? r.taxClassId === null : r.taxClassId === taxClassId;
      const countryOk = r.country === country || r.country === '';
      const stateOk = r.state.toUpperCase() === state || r.state === '';
      return classOk && countryOk && stateOk;
    });
    if (mainMatched.length === 0) return this.applyFindRatesFilter([], location, taxClass);

    const locationRows = await db.drizzle
      .select()
      .from(s.taxRateLocations)
      .where(
        inArray(
          s.taxRateLocations.taxRateId,
          mainMatched.map((r) => r.id),
        ),
      );
    const byRate = new Map<number, { postcodes: string[]; cities: string[] }>();
    for (const row of locationRows) {
      const entry = byRate.get(row.taxRateId) ?? { postcodes: [], cities: [] };
      if (row.locationType === 'postcode') entry.postcodes.push(row.locationCode);
      if (row.locationType === 'city') entry.cities.push(row.locationCode.toUpperCase());
      byRate.set(row.taxRateId, entry);
    }

    // Location criteria (ORed, §7.3): everywhere / postcode(+city) / city-only.
    const candidates: CandidateRate[] = [];
    for (const rate of mainMatched) {
      const locs = byRate.get(rate.id) ?? { postcodes: [], cities: [] };
      const postcodeOk =
        locs.postcodes.length === 0 ||
        (postcode !== '' && locs.postcodes.some((code) => postcodeLocationMatches(postcode, code)));
      const cityOk = locs.cities.length === 0 || (city !== '' && locs.cities.includes(city));
      if (!postcodeOk || !cityOk) continue;
      candidates.push({
        id: rate.id,
        rate: Number(rate.rate),
        label: rate.name,
        shipping: rate.shipping,
        compound: rate.compound,
        priority: rate.priority,
        countrySpecific: rate.country !== '',
        stateSpecific: rate.state !== '',
        postcodeCount: locs.postcodes.length,
        cityCount: locs.cities.length,
      });
    }

    // Sort: priority ASC, specific country/state first, more postcodes/cities
    // first, id ASC — then keep only the first rate per priority level.
    candidates.sort(
      (a, b) =>
        a.priority - b.priority ||
        Number(b.countrySpecific) - Number(a.countrySpecific) ||
        Number(b.stateSpecific) - Number(a.stateSpecific) ||
        b.postcodeCount - a.postcodeCount ||
        b.cityCount - a.cityCount ||
        a.id - b.id,
    );
    const seenPriorities = new Set<number>();
    const matched: MatchedTaxRate[] = [];
    for (const candidate of candidates) {
      if (seenPriorities.has(candidate.priority)) continue;
      seenPriorities.add(candidate.priority);
      matched.push({
        id: candidate.id,
        rate: candidate.rate,
        label: candidate.label,
        shipping: candidate.shipping,
        compound: candidate.compound,
      });
    }
    return this.applyFindRatesFilter(matched, location, taxClass);
  }

  private async applyFindRatesFilter(
    rates: MatchedTaxRate[],
    location: TaxLocation,
    taxClass: string,
  ): Promise<MatchedTaxRate[]> {
    if (!this.deps.bus) return rates;
    return (await this.deps.bus.applyFilters(filterFindRates, rates, {
      ...location,
      taxClass,
    })) as MatchedTaxRate[];
  }

  async findShippingRates(location: TaxLocation, taxClass: string): Promise<MatchedTaxRate[]> {
    return (await this.findRates(location, taxClass)).filter((rate) => rate.shipping);
  }

  async getBaseRates(taxClass: string): Promise<MatchedTaxRate[]> {
    return this.findRates(await this.deps.settings.baseLocation(), taxClass);
  }

  /** §7.2 calc_tax over minor units; unrounded amounts per rate id. */
  calcTax(
    priceMinor: number,
    rates: MatchedTaxRate[],
    priceIncludesTax: boolean,
  ): Map<number, number> {
    return priceIncludesTax
      ? calcInclusiveTax(priceMinor, rates)
      : calcExclusiveTax(priceMinor, rates);
  }

  /** '' (standard) maps to NULL tax_class_id; unknown slugs behave as standard. */
  private async classIdForSlug(slug: string): Promise<number | null> {
    const normalized = slug === 'standard' ? '' : slug;
    if (normalized === '') return null;
    const cached = this.classSlugCache.get(normalized);
    if (cached !== undefined) return cached;
    const s = this.deps.db.schema;
    const rows = await this.deps.db.drizzle
      .select({ id: s.taxClasses.id })
      .from(s.taxClasses)
      .where(eq(s.taxClasses.slug, normalized));
    const id = rows[0]?.id ?? null;
    this.classSlugCache.set(normalized, id);
    return id;
  }
}

/** §7.2 calc_inclusive_tax: compound extracted in reverse, then regular rates. */
export function calcInclusiveTax(priceMinor: number, rates: MatchedTaxRate[]): Map<number, number> {
  const taxes = new Map<number, number>();
  const compound = rates.filter((r) => r.compound);
  const regular = rates.filter((r) => !r.compound);

  let nonCompoundPrice = priceMinor;
  for (const rate of [...compound].reverse()) {
    const tax = nonCompoundPrice - nonCompoundPrice / (1 + rate.rate / 100);
    taxes.set(rate.id, (taxes.get(rate.id) ?? 0) + tax);
    nonCompoundPrice -= tax;
  }

  const regularSum = regular.reduce((sum, r) => sum + r.rate, 0);
  const regularTaxRate = 1 + regularSum / 100;
  for (const rate of regular) {
    const theRate = rate.rate / 100 / regularTaxRate;
    const tax = theRate * nonCompoundPrice;
    taxes.set(rate.id, (taxes.get(rate.id) ?? 0) + tax);
  }
  return taxes;
}

/** §7.2 calc_exclusive_tax: regular rates first, compound applied on top. */
export function calcExclusiveTax(priceMinor: number, rates: MatchedTaxRate[]): Map<number, number> {
  const taxes = new Map<number, number>();
  let preCompoundTotal = 0;
  for (const rate of rates) {
    if (rate.compound) continue;
    const tax = priceMinor * (rate.rate / 100);
    taxes.set(rate.id, (taxes.get(rate.id) ?? 0) + tax);
    preCompoundTotal += tax;
  }
  for (const rate of rates) {
    if (!rate.compound) continue;
    const priceIncTax = priceMinor + preCompoundTotal;
    const tax = priceIncTax * (rate.rate / 100);
    taxes.set(rate.id, (taxes.get(rate.id) ?? 0) + tax);
    preCompoundTotal += tax;
  }
  return taxes;
}
