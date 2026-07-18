/* TODO:security-blocked — see docs/SECURITY_WORK.md item S2 */
// The DB-backed SessionStore over the `sessions` table (issue/validate/destroy
// with the `{customer_id}|{expiration}|{expiring}|{integrity_tag}` cookie shape,
// guest→logged-in migration, batched expiry cleanup) is deferred to S2.

import type { SessionStore } from '../services/interfaces.js';

/**
 * Placeholder store so cart/checkout run and test against the SessionStore
 * interface today. Process-local, no persistence, no cookie integrity —
 * replaced wholesale by the S2 implementation.
 */
export class MemorySessionStore implements SessionStore {
  private readonly store = new Map<string, { value: Record<string, unknown>; expiresAt: number }>();

  async get(key: string): Promise<Record<string, unknown> | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async set(key: string, value: Record<string, unknown>, expirySeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + expirySeconds * 1000 });
  }

  async destroy(key: string): Promise<void> {
    this.store.delete(key);
  }
}
