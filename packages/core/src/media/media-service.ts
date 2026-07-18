import type { SpcndDb } from '@spacendigital/db';
import type { MediaSource } from '@spacendigital/types';
import { and, asc, eq } from 'drizzle-orm';
import type { Media } from '../entities.js';
import { NotFoundError, SpcndError } from '../errors.js';
import type { MediaAdapter } from '../services/interfaces.js';
import { nowIso, randomString, slugify } from '../utils.js';

export interface UploadMediaInput {
  fileName: string;
  data: Uint8Array;
  contentType: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface AttachMediaInput {
  ownerType: 'product' | 'product_variation' | 'category';
  ownerId: number;
  sortOrder?: number;
}

interface Deps {
  db: SpcndDb;
  /** Byte storage. Absent adapter still allows external-URL media rows. */
  adapter?: MediaAdapter;
}

/**
 * Media rows + ownership links; bytes live behind MediaAdapter
 * (docs/EDGE_V2_HARDENING.md gap 3 — no fs access outside adapter impls).
 */
export class MediaService {
  constructor(private readonly deps: Deps) {}

  async get(id: number): Promise<Media> {
    const { db } = this.deps;
    const rows = await db.drizzle.select().from(db.schema.media).where(eq(db.schema.media.id, id));
    const media = rows[0];
    if (!media) throw new NotFoundError('Media', id);
    return media;
  }

  /** Store bytes via the adapter and create the media row. */
  async upload(input: UploadMediaInput, source: MediaSource = 'local'): Promise<Media> {
    const { db, adapter } = this.deps;
    if (!adapter) {
      throw new SpcndError('No media adapter configured', 'media_adapter_missing', 500);
    }
    const dot = input.fileName.lastIndexOf('.');
    const base = dot > 0 ? input.fileName.slice(0, dot) : input.fileName;
    const ext = dot > 0 ? input.fileName.slice(dot).toLowerCase() : '';
    const key = `${slugify(base)}-${randomString(8)}${ext}`;
    const { url } = await adapter.put(key, input.data, input.contentType);
    const s = db.schema;
    await db.drizzle.insert(s.media).values({
      url,
      alt: input.alt ?? null,
      name: input.fileName,
      mimeType: input.contentType,
      source,
      sourceId: key,
      width: input.width ?? null,
      height: input.height ?? null,
      fileSize: input.data.byteLength,
      dateCreated: nowIso(),
    });
    const rows = await db.drizzle.select().from(s.media).where(eq(s.media.url, url));
    const row = rows[rows.length - 1];
    if (!row) throw new SpcndError('Media insert failed', 'media_insert_failed', 500);
    return row;
  }

  /** Register an external URL without storing bytes. */
  async addExternal(url: string, alt?: string, name?: string): Promise<Media> {
    const { db } = this.deps;
    const s = db.schema;
    await db.drizzle.insert(s.media).values({
      url,
      alt: alt ?? null,
      name: name ?? null,
      source: 'external',
      dateCreated: nowIso(),
    });
    const rows = await db.drizzle.select().from(s.media).where(eq(s.media.url, url));
    const row = rows[rows.length - 1];
    if (!row) throw new SpcndError('Media insert failed', 'media_insert_failed', 500);
    return row;
  }

  async delete(id: number): Promise<void> {
    const { db, adapter } = this.deps;
    const media = await this.get(id);
    if (media.source !== 'external' && media.sourceId && adapter) {
      await adapter.delete(media.sourceId);
    }
    await db.drizzle.delete(db.schema.media).where(eq(db.schema.media.id, id));
  }

  async attach(mediaId: number, link: AttachMediaInput): Promise<void> {
    const { db } = this.deps;
    await this.get(mediaId);
    const s = db.schema;
    const existing = await db.drizzle
      .select()
      .from(s.mediaLinks)
      .where(
        and(
          eq(s.mediaLinks.mediaId, mediaId),
          eq(s.mediaLinks.ownerType, link.ownerType),
          eq(s.mediaLinks.ownerId, link.ownerId),
        ),
      );
    if (existing.length > 0) {
      await db.drizzle
        .update(s.mediaLinks)
        .set({ sortOrder: link.sortOrder ?? 0 })
        .where(
          and(
            eq(s.mediaLinks.mediaId, mediaId),
            eq(s.mediaLinks.ownerType, link.ownerType),
            eq(s.mediaLinks.ownerId, link.ownerId),
          ),
        );
      return;
    }
    await db.drizzle.insert(s.mediaLinks).values({
      mediaId,
      ownerType: link.ownerType,
      ownerId: link.ownerId,
      sortOrder: link.sortOrder ?? 0,
    });
  }

  async detach(mediaId: number, ownerType: string, ownerId: number): Promise<void> {
    const { db } = this.deps;
    const s = db.schema;
    await db.drizzle
      .delete(s.mediaLinks)
      .where(
        and(
          eq(s.mediaLinks.mediaId, mediaId),
          eq(s.mediaLinks.ownerType, ownerType),
          eq(s.mediaLinks.ownerId, ownerId),
        ),
      );
  }

  /** Gallery for an owner, sorted. */
  async forOwner(ownerType: string, ownerId: number): Promise<Media[]> {
    const { db } = this.deps;
    const s = db.schema;
    const rows = await db.drizzle
      .select({ media: s.media, sortOrder: s.mediaLinks.sortOrder })
      .from(s.mediaLinks)
      .innerJoin(s.media, eq(s.media.id, s.mediaLinks.mediaId))
      .where(and(eq(s.mediaLinks.ownerType, ownerType), eq(s.mediaLinks.ownerId, ownerId)))
      .orderBy(asc(s.mediaLinks.sortOrder), asc(s.mediaLinks.mediaId));
    return rows.map((r) => r.media);
  }
}
