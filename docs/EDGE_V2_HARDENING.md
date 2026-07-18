# EDGE_V2_HARDENING — constraints to honor during v1 so v2 on Workers is small

> Read this file alongside `docs/RESUME.md` while building v1. The constraints here
> are **v1 design constraints**, not v2 work. They prevent v2 from becoming a rewrite.
>
> **Why this exists:** spcnd-ecom v2 will run on Cloudflare Workers. That requires
> every Node-only API to stay behind an interface so a Workers-native impl can drop in.
> If v1 hardcodes `fs.createReadStream` or `setInterval` inside business logic, v2
> becomes a 3-4 week refactor. If v1 abstracts correctly, v2 is 5-10 days of adapter
> implementations.

## The 7 gaps v1 must honor

### Gap 1: `better-sqlite3` is Node-only (native binding)

`packages/db/src/sqlite/factory.ts` uses `better-sqlite3`. Correct for v1.

- **v1 constraint**: The `SpcndDb` interface in `packages/db/src/types.ts` MUST NOT
  leak anything better-sqlite3-specific. No sync `prepare()` / `exec()` exposed
  outside the SQLite factory. Other code goes through `db.drizzle.select()...`,
  `db.transaction()`, `db.queryRaw()`.
- **v2 work**: add `packages/db/src/d1/factory.ts` using the D1 HTTP driver or
  `env.DB` binding. Returns the same `SpcndDb` interface. D1 migrations are
  SQLite-compatible — mostly identical to the existing `0001_initial.sql`.
- **Verify in v1**: `grep -rn "better-sqlite3\|Database.Sync\|prepare(" packages/core/ packages/api/ packages/auth/ packages/payments/ packages/shipping/ packages/tax/ packages/email/ packages/reviews/ packages/analytics/` returns zero hits outside `packages/db/src/sqlite/`.

### Gap 2: SMTP email transport uses `nodemailer` (Node-only)

`packages/email/transports/smtp.ts` will use `nodemailer`. Edge users can't use SMTP.

- **v1 constraint**: `SmtpTransport` MUST be registered lazily — only when an SMTP
  URL is configured. The `EmailTransport` interface in `core/services/interfaces.ts`
  is clean (just `send(message): Promise<void>`). The core code never imports
  `nodemailer` directly; the email plugin imports it only when constructed.
- **v2 work**: on Workers, users use Resend / SendGrid (both fetch-based) or console.
  SMTP transport simply isn't registered. No code changes needed if v1 isolates it.
- **Verify in v1**: `grep -rn "nodemailer" packages/core/ packages/api/ packages/email/src/templates/` returns zero hits. `nodemailer` only appears in `packages/email/src/transports/smtp.ts`.

### Gap 3: Local filesystem `MediaAdapter` uses `fs` (Node-only)

`packages/.../media/adapters/local.ts` (or similar) will use Node's `fs` module.

- **v1 constraint**: The `MediaAdapter` interface in `core/services/interfaces.ts`
  MUST expose `stream(file)` and/or `signedUrl(file, ttl)` — not a hardcoded
  `fs.createReadStream` at the call site. `core/downloads/download-service.ts`
  MUST use `MediaAdapter.stream(file)` / `MediaAdapter.signedUrl(file)`, never
  `fs` directly. The local adapter implements `stream` via `fs.createReadStream`;
  R2 implements it via the R2 SDK's body.
- **v2 work**: `R2MediaAdapter` — already specced, just implement. `signedUrl()`
  returns R2 presigned URL; `stream()` returns the R2 object body stream.
- **Verify in v1**: when Fable writes `media/media-service.ts` and
  `downloads/download-service.ts`, grep for `from 'fs'` /
  `from 'node:fs'` / `createReadStream` in those files. Zero hits outside
  adapter impls. If Fable hardcoded `fs` in the service, refactor before commit.

### Gap 4: File download streaming

`docs/woocommerce-comprehensive_report.md` §23.3 lists `force` (read file in chunks)
and `xsendfile` (nginx/Apache-only). Neither works on Workers.

- **v1 constraint**: `downloads/download-service.ts` MUST route downloads through
  `MediaAdapter.stream(file)` or `MediaAdapter.signedUrl(file, ttl)`. For `force`
  download method: on Node, `stream` returns a `ReadableStream` from
  `fs.createReadStream`. For `redirect` method: return a 302 to `signedUrl()`.
  The service MUST NOT branch on Node-only APIs.
- **v2 work**: on Workers, `force` returns the R2 object's `ReadableStream` body
  directly. `redirect` returns a 302 to an R2 presigned URL.
- **Verify in v1**: same grep as Gap 3. If download-service branches on
  `process.env` or `fs`, refactor.

### Gap 5: Long-running webhook delivery (60s timeout)

`webhooks/webhook-service.ts` (SECURITY_WORK item S3) queues deliveres. Workers
have a 30s CPU limit per request; in-process `MemoryQueueAdapter` /
`BullMQ` won't work there.

- **v1 constraint**: `WebhookService` MUST enqueue all deliveries via
  `QueueAdapter.enqueue(job, payload)`. NEVER call `fetch(deliveryUrl, ...)`
  inline inside the webhook-topic handler. The delivery happens in a queue
  consumer, not in the request handler.
- **v2 work**: `CloudflareQueuesAdapter` implementation — Workers Queues have
  HTTP-triggered consumers with 15-min per-attempt budget and native retries.
- **Verify in v1**: After Opus writes S3, grep
  `packages/core/src/webhooks/webhook-service.ts` for `fetch(
  ` inline. Zero hits outside the queue consumer's delivery function.

### Gap 6: Cron jobs (scheduled: cleanup, abandoned-cart, retention)

`docs/AGENTS.md` §13 lists scheduled jobs (cleanup expired sessions, daily
retention, abandoned-cart recovery email). Node uses `node-cron` or `BullMQ`
repeating; Workers uses Cron Triggers.

- **v1 constraint**: Extract scheduled jobs to a `ScheduledJobs` registry —
  each job has a name, schedule (cron string), and a `run()` function. The v1
  runner can use `setInterval` in Node or `BullMQ.repeat();` the v2 runner
  uses Cron Triggers. The jobs themselves are runtime-agnostic.
- **v2 work**: `wrangler.toml` Cron Triggers entries: one per scheduled job
  (`*/15 * * * *` for session cleanup, `0 3 * * *` for retention, etc.).
  A `scheduled()` handler in the Workers entry point dispatches to the same
  `ScheduledJobs` registry.
- **Verify in v1**: when Fable writes the `gdpr/`, `sessions/`, `email/`
  scheduled jobs, ensure each is a job object with name + schedule + run(),
  not a bare `setInterval` inside a service constructor.

### Gap 7: Stripe / PayPal webhook signature verification (S5 edge-note)

Stripe and PayPal verify inbound webhooks by HMAC-signing the request body +
timestamp. On Workers, the request body arrives as a `ReadableStream` you can
only read once. If the auth middleware consumes the body, the downstream handler
can't.

- **v1 constraint** (Opus 4.8 S5): the Stripe / PayPal gateway implementation
  MUST `request.clone()` before reading the body for signature verification.
  The original request (or the clone) passes downstream intact. This pattern
  works on both Node and Workers.
- **v2 work**: none — if v1 implements it with `clone()`, it works on Workers
  unchanged.
- **Verify in S5**: grep in `packages/payments/src/gateways/{stripe,paypal}.ts`
  for `request.clone()` or `req.clone()` in the webhook handler signature
  verification step.

## What this file is NOT

- Not v2 work itself — v2 scope is listed in the next section as a reference.
- Not a list of things to fix in v1 today — most of v1 is already correct per the spec.
- Not a reason to refactor existing v1 code — only a constraint list for files
  that haven't been written yet (`media/`, `downloads/`, `webhooks/`,
  `sessions/`, scheduled jobs).

## v2 scope (reference only — don't work on this in v1)

Once v1 has shipped a client store and the 7 gaps above are honored:

| Add | Description | Effort |
|---|---|---|
| `packages/db/src/d1/factory.ts` + `migrations/d1/` | D1 dialect factory returning `SpcndDb`; SQLite-compatible migrations | 1 day |
| `packages/adapters/cloudflare/` | Workers entry: `fetch` handler + `scheduled` handler + Queue consumer exports + KV/R2/Queues bindings | 2-3 days |
| `R2MediaAdapter` implementation | already specced | 1 day |
| `KvCacheAdapter` implementation | already specced | 1 day |
| `CloudflareQueuesAdapter` implementation | already specced | 1 day |
| `CloudflareCronAdapter` implementation | dispatches `scheduled()` to `ScheduledJobs` registry | 1 day |
| `wrangler.toml` template + docs | example Workers deployment | 1 day |
| Strip SMTP transport for edge builds | declare lazy-register | 30 min |
| D1 migrations test | run migrations against a D1 local emulator | 1 day |

Total v2 scope: ~5-10 days if v1 honored the 7 gaps; ~3-4 weeks if v1 didn't.

## Strategic note (do not surface in README yet)

The v2-on-Workers path is the acquisition signal — the "Astro played this correctly,
emdash played it wrong" story. Position the v2 README to say "spcnd-ecom v2 runs
on Cloudflare Workers — the edge-first commerce engine" once v2 alpha ships.
Do not mention acquisition intent in the v1 README; let the product speak.

The hardening above is the small cost v1 pays to keep v2 cheap and keep that
option alive.