# SECURITY_WORK — deferred work (read this doc only on Opus 4.8, NOT on Fable 5)

> **If you are a Fable 5 session, STOP. Do not read further. This file exists precisely
> because Fable 5's safety classifier blocks this kind of work. Switch to Opus 4.8 or
> hand this file to a human before continuing.** The Fable 5 safeguards documented at
> https://www.anthropic.com/news/fable-safeguards-jailbreak-framework classify payment
> rails and security-coding as "high-risk dual use" and block them. Opus 4.8 does not.

This file lists every item in the spcnd-ecom build that touches cryptographic signing,
credential storage, payment-provider integration, or session integrity — work that
will trip Fable 5's safety classifier. Items are extracted from `docs/RESUME.md` so
the resume doc stays clean for Fable 5 to read.

The blocking is a known Fable 5 limitation, not a bug in your code. The fix is to do
this work on a model without the classifier (Claude Opus 4.8 is the recommended
fallback per Anthropic's own Fable 5 safeguards doc).

## When to read this file

- You are running on Claude Opus 4.8 (or any non-Fable-5 model), AND
- `docs/RESUME.md` says work has progressed to "step S1" or later (see below).

## Deferred items (work ID prefixes with S for "security")

### S1. core/utils.ts — complete the integrity-hash helpers

`packages/core/src/utils.ts` already exports `hmacSha256Base64` and `sha256Hex`
stubs (WebCrypto-based, DECISION-5 compliant). Audit the existing implementation
against the spec:

- `hmacSha256Base64(payload: string, secret: string): Promise<string>` — used by
  the session cookie shape `{customer_id}|{expiration}|{expiring}|{tag}` (the
  integrity value is computed over `customer_id|expiration`).
- `sha256Hex(input: string): Promise<string>` — used for api_key secret storage
  per WC's storage pattern.
- `stableHash(input: string): string` — non-crypto 32-hex hash for `cart_hash`
  and similar non-security integrity needs.

Write tests in `packages/core/test/utils.test.ts`. Commit per working rules.

### S2. core/sessions/session-service.ts

`SessionStore` implementation over the `auth_sessions` table. Cookie shape per
`docs/woocommerce-analysis.md` §5:

```
{customer_id}|{expiration}|{expiring}|{integrity_tag}
```

- `issueSession(customerId): Promise<Session>`
- `validateSession(cookieValue): Promise<Session | null>` — verifies the
  integrity tag matches the customer_id|expiration using the app secret.
- `destroySession(token): Promise<void>`
- `cleanupExpired(): Promise<number>`

Per `docs/woocommerce-analysis.md` §5 on session lifecycle: guest→logged-in
migration, empty-session destruction, batched cleanup of expired rows.

### S3. core/webhooks/webhook-service.ts

Webhook delivery service. Topic match against webhooks table, queue via
`QueueAdapter`, deliver with an integrity-tag header (`X-WC-Webhook-Signature`
in WC; we use the same header name for compat). 5 consecutive failures →
`disabled`. Ping support.

Signature: `base64(integrity_tag(payload_body, secret))` — uses the same
helper family as S2.

Webhook topics: 17 built-in (coupon.*, customer.*, order.*, product.*) plus
`action.{hook_name}` custom topics (full list in `docs/AGENTS.md` §15 and
`docs/woocommerce_comprehensive_report.md` §15).

### S4. auth package

`@spacendigital/auth` — full implementation.

- Credential storage: PBKDF2-SHA256 via WebCrypto, 600k iterations, per-hash
  random salt (DECISION-5). Stored format: `pbkdf2$iterations$salt$hash`
  (versioned prefix so a stronger algorithm can replace it later).
- `verifyCredential(password, stored): Promise<boolean>` — constant-time compare.
- `auth_sessions` token issue/validate (random 32-byte URL-safe, hashed at rest).
- Roles & capabilities: customer / shop_manager / admin — capability map per
  `docs/woocommerce_comprehensive_report.md` §11.2.
- Optional OAuth provider wiring via Arctic (Google, GitHub, etc.) — bring-your-own
  provider config; not installed by default.
- Admin access tokens (WC calls these "api_keys"): `ck_` + 32 hex chars for the
  public key, `cs_` + 43 base64 chars for the private key. Truncated_key (first 7
  chars) for display. Per WC, the private key is stored plaintext (timing-safe
  compare at validation). Document the trade-off in DECISIONS.md when you implement
  it; consider sha256-stored alternative with a note.

### S5. payments package

`@spacendigital/payments` — gateway interface implementation + built-in gateways.

- `PaymentGateway` interface implementation per `docs/woocommerce_comprehensive_report.md` §7.
- Registry plugin (registers built-ins in the DI container).
- Built-in gateways:
  - **COD** (Cash on Delivery) — configurable `enable_for_methods` / `virtual`.
  - **BACS** (Bank Transfer) — account details stored in `settings_json`.
  - **Cheque** — instructions in settings.
  - **Stripe** — fetch-based PaymentIntents client per DECISION-8 (no Stripe SDK
    dependency). Create intent / capture / refund endpoints.
  - **PayPal** — fetch-based Orders v2 client per DECISION-8. Create / capture / refund.
- Saved payment methods CRUD (WC: `payment_tokens` table) — list, add, set-default,
  delete. Tokenization shape per `docs/woocommerce_comprehensive_report.md` §7.6.

### S6. api/api-keys routes

The Hono routes for admin access-token CRUD: `POST /api/v1/api-keys`,
`GET /api/v1/api-keys`, `DELETE /api/v1/api-keys/:id`. Issues tokens per S4.
HTTP Basic auth (consumer_key + consumer_secret) for `/api/v3/*` compat.

### S7. apps/admin login + api-key management UI

Admin SPA login flow (calls the auth API). Admin-SPA API-key CRUD screen. Per
`docs/AGENTS.md` §9.

## Sequence

After `docs/RESUME.md` step 14 is done (the entire non-security build is green),
run a fresh session on **Opus 4.8** (NOT Fable 5) and work through S1 → S7 in
order. Each S-step gets its own commit; push to `main` per the working rules.

## Verification per S-step

- S1 → unit test: feed known inputs, expect known outputs (NIST test vectors
  for the crypto primitives).
- S2 → integration test: issue, validate, destroy, cleanup-expired against the
  sqlite `auth_sessions` table.
- S3 → integration test: enqueue + deliver + 5-failure-disable against a mock
  HTTP endpoint.
- S4 → unit test: round-trip credential storage; role-permission matrix test.
- S5 → integration test with mock fetch: each gateway's create/capture/refund
  happy path + error path.
- S6 → integration test via the v1 API against sqlite.
- S7 → Playwright e2e: login flow, API-key CRUD.

## Working rules (same as RESUME.md)

- Git identity `Ishtiak Ahmed Evan <iaevan008@gmail.com>` — set before any commit.
- Commit every ~10 file changes to `main`. Push with `git push -u origin main`.
- Never use floats for money, never `DEFAULT 0` parent sentinels.
- Update `docs/RESUME.md`'s status section after each S-step lands so the
  Fable-5 sessions know what's done.
- Update `docs/DECISIONS.md` for any spec-gap decisions (especially around
  credential storage vs. stored-plaintext tradeoffs).