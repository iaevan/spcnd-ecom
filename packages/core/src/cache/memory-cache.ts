import type { CacheAdapter } from '../services/interfaces.js';

interface Entry {
  value: unknown;
  expiresAt: number | null;
}

/**
 * LRU cache (default adapter; works on Node and edge). Scope invalidation
 * uses `scope:rest` key prefixes, mirroring WC's DONOTCACHE* scoped-flush
 * semantics (docs/AGENTS.md §8.1).
 */
export class MemoryCacheAdapter implements CacheAdapter {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly maxEntries = 1000) {}

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // Refresh recency: Map iteration order doubles as the LRU list.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, {
      value,
      expiresAt: ttlSeconds !== undefined ? Date.now() + ttlSeconds * 1000 : null,
    });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async invalidateScope(scope: string): Promise<void> {
    const prefix = `${scope}:`;
    for (const key of [...this.entries.keys()]) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }
}
