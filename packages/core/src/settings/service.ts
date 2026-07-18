import type { SpcndDb } from '@spacendigital/db';
import { eq } from 'drizzle-orm';
import { SETTING_DEFINITIONS, type SettingKind } from './defaults.js';

/**
 * Typed settings over the settings_boolean / settings_integer /
 * settings_string / settings_json tables, with settings_general as the escape
 * hatch for unregistered plugin keys. Values are cached in-memory per app
 * instance and invalidated on write.
 */
export class SettingsService {
  private cache = new Map<string, unknown>();
  private loaded = false;

  constructor(private readonly db: SpcndDb) {}

  private async loadAll(): Promise<void> {
    if (this.loaded) return;
    const s = this.db.schema;
    const [bools, ints, strs, jsons, general] = await Promise.all([
      this.db.drizzle.select().from(s.settingsBoolean),
      this.db.drizzle.select().from(s.settingsInteger),
      this.db.drizzle.select().from(s.settingsString),
      this.db.drizzle.select().from(s.settingsJson),
      this.db.drizzle.select().from(s.settingsGeneral),
    ]);
    for (const row of bools) this.cache.set(row.key, row.value);
    for (const row of ints) this.cache.set(row.key, row.value);
    for (const row of strs) this.cache.set(row.key, row.value);
    for (const row of jsons) this.cache.set(row.key, row.value);
    for (const row of general) {
      if (!this.cache.has(row.key)) this.cache.set(row.key, row.value);
    }
    this.loaded = true;
  }

  async get<T = unknown>(key: string): Promise<T> {
    await this.loadAll();
    if (this.cache.has(key)) return this.cache.get(key) as T;
    return SETTING_DEFINITIONS[key]?.default as T;
  }

  async getString(key: string): Promise<string> {
    return String((await this.get(key)) ?? '');
  }

  async getBool(key: string): Promise<boolean> {
    const value = await this.get(key);
    if (typeof value === 'boolean') return value;
    if (value === 'yes' || value === '1' || value === 1) return true;
    if (value === 'no' || value === '0' || value === 0) return false;
    return Boolean(value);
  }

  async getInt(key: string): Promise<number> {
    const value = await this.get(key);
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }

  async getJson<T = unknown>(key: string): Promise<T> {
    return (await this.get(key)) as T;
  }

  /**
   * Write a setting to its typed table; unregistered keys go to
   * settings_general as strings.
   */
  async set(key: string, value: unknown): Promise<void> {
    const kind: SettingKind | 'general' = SETTING_DEFINITIONS[key]?.kind ?? 'general';
    const s = this.db.schema;
    const d = this.db.drizzle;
    switch (kind) {
      case 'boolean': {
        const v = value === true || value === 'yes' || value === '1' || value === 1;
        const existing = await d.select().from(s.settingsBoolean).where(eq(s.settingsBoolean.key, key));
        if (existing.length > 0) {
          await d.update(s.settingsBoolean).set({ value: v }).where(eq(s.settingsBoolean.key, key));
        } else {
          await d.insert(s.settingsBoolean).values({ key, value: v });
        }
        this.cache.set(key, v);
        break;
      }
      case 'integer': {
        const v = Math.trunc(Number(value)) || 0;
        const existing = await d.select().from(s.settingsInteger).where(eq(s.settingsInteger.key, key));
        if (existing.length > 0) {
          await d.update(s.settingsInteger).set({ value: v }).where(eq(s.settingsInteger.key, key));
        } else {
          await d.insert(s.settingsInteger).values({ key, value: v });
        }
        this.cache.set(key, v);
        break;
      }
      case 'json': {
        const existing = await d.select().from(s.settingsJson).where(eq(s.settingsJson.key, key));
        if (existing.length > 0) {
          await d.update(s.settingsJson).set({ value }).where(eq(s.settingsJson.key, key));
        } else {
          await d.insert(s.settingsJson).values({ key, value });
        }
        this.cache.set(key, value);
        break;
      }
      case 'string': {
        const v = String(value ?? '');
        const existing = await d.select().from(s.settingsString).where(eq(s.settingsString.key, key));
        if (existing.length > 0) {
          await d.update(s.settingsString).set({ value: v }).where(eq(s.settingsString.key, key));
        } else {
          await d.insert(s.settingsString).values({ key, value: v });
        }
        this.cache.set(key, v);
        break;
      }
      case 'general': {
        const v = typeof value === 'string' ? value : JSON.stringify(value);
        const existing = await d.select().from(s.settingsGeneral).where(eq(s.settingsGeneral.key, key));
        if (existing.length > 0) {
          await d.update(s.settingsGeneral).set({ value: v }).where(eq(s.settingsGeneral.key, key));
        } else {
          await d.insert(s.settingsGeneral).values({ key, value: v });
        }
        this.cache.set(key, v);
        break;
      }
    }
  }

  /** Shop base location from the default_country `COUNTRY[:STATE]` setting. */
  async baseLocation(): Promise<{ country: string; state: string; postcode: string; city: string }> {
    const raw = await this.getString('default_country');
    const [country = '', state = ''] = raw.split(':');
    return {
      country,
      state,
      postcode: await this.getString('store_postcode'),
      city: await this.getString('store_city'),
    };
  }

  invalidate(): void {
    this.cache.clear();
    this.loaded = false;
  }
}
