/** Edge-safe utilities — no Node imports (docs/AGENTS.md non-negotiable #8). */

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

/** Stable non-cryptographic 32-hex-char hash (FNV-1a based, md5-shaped). */
export function stableHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  let h3 = 0xdeadbeef;
  let h4 = 0xcafebabe;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
    h3 = Math.imul(h3 ^ (c << (i % 8)), 0xc2b2ae35) >>> 0;
    h4 = (Math.imul(h4, 31) + c) >>> 0;
  }
  const hex = (n: number) => n.toString(16).padStart(8, '0');
  return hex(h1) + hex(h2) + hex(h3) + hex(h4);
}

const KEY_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Cryptographically-random string (WebCrypto, edge-safe). */
export function randomString(length: number, alphabet = KEY_ALPHABET): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/** WC order keys look like `wc_order_` + 13 random chars (22 total). */
export function generateOrderKey(): string {
  return `wc_order_${randomString(13)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** HMAC-SHA256, base64 — webhook signatures + session cookies (edge-safe). */
export async function hmacSha256Base64(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * WC wildcard postcode expansion: for '90210' produce ['90210', '9021*',
 * '902*', ...] so stored wildcard rates match (wc_get_wildcard_postcodes).
 */
export function wildcardPostcodes(postcode: string): string[] {
  const clean = normalizePostcode(postcode);
  const results = [clean, '*'];
  for (let i = clean.length - 1; i > 0; i--) {
    results.push(`${clean.slice(0, i)}*`);
  }
  return results;
}

export function normalizePostcode(postcode: string): string {
  return postcode.replace(/[\s-]/g, '').toUpperCase();
}

/** WC postcode range notation: '12345...12400' matches numerically. */
export function postcodeInRange(postcode: string, range: string): boolean {
  const [min, max] = range.split('...');
  if (min === undefined || max === undefined) return false;
  const p = Number.parseInt(postcode.replace(/\D/g, ''), 10);
  const lo = Number.parseInt(min.replace(/\D/g, ''), 10);
  const hi = Number.parseInt(max.replace(/\D/g, ''), 10);
  if (Number.isNaN(p) || Number.isNaN(lo) || Number.isNaN(hi)) return false;
  return p >= lo && p <= hi;
}

/** Match a customer postcode against a stored location code (exact, wildcard or range). */
export function postcodeLocationMatches(postcode: string, locationCode: string): boolean {
  const clean = normalizePostcode(postcode);
  const code = normalizePostcode(locationCode);
  if (locationCode.includes('...')) return postcodeInRange(clean, locationCode);
  if (code.endsWith('*')) return clean.startsWith(code.slice(0, -1));
  return clean === code;
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
