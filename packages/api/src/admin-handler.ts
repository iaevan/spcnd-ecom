import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

/**
 * Static handler for the built admin SPA (apps/admin/dist), served at
 * /spcnd-admin. Node-only (fs) — exported from './admin' so edge bundles
 * importing the package root never pull in node:fs (EDGE gap 3 discipline).
 * The SPA's login screen depends on SECURITY_WORK S4/S7.
 */

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

export function createAdminHandler(distDir: string, basePath = '/spcnd-admin') {
  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(basePath)) return null;
    const rel = url.pathname.slice(basePath.length).replace(/^\/+/, '') || 'index.html';
    const safe = normalize(rel);
    if (safe.startsWith('..') || safe.includes('\0')) {
      return new Response('Forbidden', { status: 403 });
    }
    const filePath = join(distDir, safe);
    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error('not a file');
      const body = await readFile(filePath);
      return new Response(new Uint8Array(body), {
        headers: { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' },
      });
    } catch {
      // SPA fallback: unknown paths render index.html for client routing.
      try {
        const body = await readFile(join(distDir, 'index.html'));
        return new Response(new Uint8Array(body), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      } catch {
        return new Response('Admin bundle not built', { status: 404 });
      }
    }
  };
}
