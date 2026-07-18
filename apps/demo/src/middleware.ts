import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createAdminHandler } from '@spacendigital/api/admin';
import { defineMiddleware } from 'astro:middleware';

/** Serve the built admin SPA at /spcnd-admin when apps/admin/dist exists. */
const adminDist = process.env.SPCND_ADMIN_DIST ?? resolve(process.cwd(), '../admin/dist');
const admin = existsSync(adminDist) ? createAdminHandler(adminDist) : null;

export const onRequest = defineMiddleware(async (context, next) => {
  if (admin && context.url.pathname.startsWith('/spcnd-admin')) {
    const response = await admin(context.request);
    if (response) return response;
  }
  return next();
});
