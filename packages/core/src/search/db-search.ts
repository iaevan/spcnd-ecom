import type { SpcndDb } from '@spacendigital/db';
import type { SearchAdapter, SearchQuery } from '../services/interfaces.js';

/**
 * Database-native product search: FTS5 (SQLite) / tsvector (PG) / FULLTEXT
 * (MySQL) from migration 0002_search, falling back to LIKE for tiny catalogs
 * or when the search structures are missing (docs/AGENTS.md §8.2).
 */
export class DbSearchAdapter implements SearchAdapter {
  constructor(private readonly db: SpcndDb) {}

  async searchProducts(query: SearchQuery): Promise<number[]> {
    const term = query.term.trim();
    if (!term) return [];
    const limit = Math.min(200, Math.max(1, query.limit ?? 25));
    try {
      switch (this.db.dialect) {
        case 'sqlite': {
          const rows = await this.db.queryRaw<{ id: number }>(
            `SELECT rowid AS id FROM products_fts WHERE products_fts MATCH ? LIMIT ?`,
            [ftsQuote(term), limit],
          );
          return rows.map((r) => Number(r.id));
        }
        case 'postgres': {
          const rows = await this.db.queryRaw<{ id: number }>(
            `SELECT id FROM products
             WHERE search_vector @@ plainto_tsquery('simple', $1)
             ORDER BY ts_rank(search_vector, plainto_tsquery('simple', $1)) DESC
             LIMIT $2`,
            [term, limit],
          );
          return rows.map((r) => Number(r.id));
        }
        case 'mysql': {
          const rows = await this.db.queryRaw<{ id: number }>(
            `SELECT id FROM products
             WHERE MATCH(name, sku, short_description) AGAINST (? IN NATURAL LANGUAGE MODE)
             LIMIT ?`,
            [term, limit],
          );
          return rows.map((r) => Number(r.id));
        }
      }
    } catch {
      // Search structures absent (migration 0002 not applied) — LIKE below.
    }
    return this.likeFallback(term, limit);
  }

  private async likeFallback(term: string, limit: number): Promise<number[]> {
    const like = `%${term.replace(/[%_]/g, '')}%`;
    const placeholder = this.db.dialect === 'postgres' ? (n: number) => `$${n}` : () => '?';
    const rows = await this.db.queryRaw<{ id: number }>(
      `SELECT id FROM products
       WHERE name LIKE ${placeholder(1)} OR sku LIKE ${placeholder(2)} OR short_description LIKE ${placeholder(3)}
       LIMIT ${this.db.dialect === 'postgres' ? '$4' : '?'}`,
      [like, like, like, limit],
    );
    return rows.map((r) => Number(r.id));
  }
}

/** Quote each token so FTS5 treats user input as literals, not syntax. */
function ftsQuote(term: string): string {
  return term
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replace(/"/g, '""')}"`)
    .join(' ');
}
