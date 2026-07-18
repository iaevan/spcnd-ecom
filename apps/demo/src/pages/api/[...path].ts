import type { APIRoute } from 'astro';
import { createApiRoute } from '@spacendigital/astro';
import { getApp } from '../../lib/app.js';

export const prerender = false;

/** Every /api/* request forwards into the Hono app (spec §1 wiring). */
export const ALL: APIRoute = async (context) => {
  const { api } = await getApp();
  return createApiRoute(api)(context);
};
