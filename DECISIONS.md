# DECISIONS

Spec-gap decisions made during the build, per the operating instructions.

## DECISION-1: `docs/archive/AGENTS.original.md` is absent from the archive
- Context: docs/AGENTS.md §15 references the original 3220-line spec for behavioral
  cross-reference (old §13.1 emails, §19 templates, §20 i18n, §22 sessions, §27 algorithms,
  §28 hook catalog). The uploaded archive does not contain it.
- Options considered: A) halt and ask; B) reconstruct behavior from the five `woocommerce-*.md`
  reports which cover the same ground.
- Decision: B — the five reports at the repo root are treated as the authoritative behavioral
  reference. All algorithm/hook/email/table details were sourced from them.
- Rationale: The reports contain the calculation algorithms (comprehensive §11), hook catalogs
  (comprehensive §10 + core-architecture §10), 22-email table (feature-parity §3.2), session
  cookie shape (analysis §5), and complete table schemas (analysis §1) — everything the old
  spec sections are cited for.

## DECISION-2: SQLite money columns are INTEGER minor units, not TEXT
- Context: Spec §4.1.1 says SQLite money is "TEXT storing a fixed-4-decimal integer string".
  TEXT-stored numbers compare lexicographically in SQL ('9.0000' > '10.0000'), which breaks
  the price filters on `product_meta_lookup` (min_price/max_price) the spec also requires.
- Options considered: A) TEXT as written; B) INTEGER count of 1/10000ths (exact, 64-bit).
- Decision: B. The Drizzle column mapper exposes the identical fixed 4-decimal string
  ("12.3400") on every dialect, so app code cannot observe the difference.
- Rationale: Preserves the spec's real invariants (never float, exact, NUMERIC(19,4)-equivalent
  resolution) while keeping SQL comparability and index usefulness on SQLite.

## DECISION-3: Money exposed as strings at the DB edge, integer cents in core
- Context: Spec §4.1.1 note says "Drizzle exposes as JS number", but §12 mandates all core
  arithmetic on integer cents via a Money type; NUMERIC(19,4) as a JS float re-introduces the
  float hazard the spec bans.
- Decision: DB layer exposes money as fixed 4-decimal strings on all dialects;
  `Money.fromDb(string)` converts to integer minor units (4dp) at the edge; all arithmetic is
  integer; display formatting rounds per store settings.
- Rationale: Honors the "arithmetic in cents" requirement end-to-end with zero float exposure.

## DECISION-4: SQLite transactions serialized with an async mutex
- Context: better-sqlite3 is synchronous; drizzle's native transaction API only accepts sync
  callbacks, but core services are async (they await bus events and service interfaces).
- Decision: `SpcndDb.transaction()` on SQLite issues BEGIN IMMEDIATE/COMMIT manually around the
  async callback and serializes transactions with a per-connection mutex; nested transactions
  flatten into the outermost one. PG/MySQL use their drivers' native async transactions.
- Rationale: Correctness on a single connection with async callbacks; SQLite is the dev/small
  default where transaction throughput is not the bottleneck.

## DECISION-5: Password hashing is PBKDF2-SHA256 via WebCrypto (not scrypt/argon2)
- Context: Spec locks Arctic + Oslo for auth but neither pins a password hash. The auth package
  is not on the spec's Node-only list (§8), so it must stay edge-portable; node:crypto scrypt
  and native argon2 are Node-only.
- Decision: PBKDF2-SHA256 (600k iterations, per-hash random salt) via `crypto.subtle`,
  implemented in @spcnd-ecom/auth. The stored format is versioned (`pbkdf2$...`) so a stronger
  algorithm can be added later without invalidating hashes.
- Rationale: OWASP-acceptable, zero dependencies, runs on Node 20 and edge runtimes.

## DECISION-6: Settings keys stored unprefixed; compat-wc maps `woocommerce_*` names
- Context: §5 splits wp_options into typed tables but does not fix a key namespace.
- Decision: Canonical keys are the WC option names with the `woocommerce_` prefix stripped
  (`currency`, `default_country`, ...). `compat-wc`'s `get_option('woocommerce_currency')` shim
  strips the prefix and re-shapes values ('yes'/'no' for booleans) for WC-porting plugins.
- Rationale: Clean names for the typed core; exact WC names preserved at the compat surface.

## DECISION-7: `createSpcndApp` lives in the meta-package; core exports `createSpcndCore`
- Context: §1 shows `createSpcndApp(config)` returning `app.api` / `app.admin`, but §3.1 forbids
  core from importing the api package (api → core).
- Decision: @spcnd-ecom/core exports the kernel factory (`createSpcndCore`: db, bus, container,
  settings, services, plugin loading). The `spcnd-ecom` meta-package composes kernel + api +
  default service impl plugins into the user-facing `createSpcndApp`.
- Rationale: Keeps the dependency DAG acyclic while preserving the spec's public API shape.

## DECISION-8: Payment gateways use fetch-based REST clients, not vendor SDKs
- Context: Spec lists "which Stripe SDK version" as a legitimate open decision.
- Decision: Stripe (PaymentIntents API) and PayPal (Orders v2 API) gateways are implemented
  over `fetch` with typed minimal clients; no `stripe`/`@paypal/*` dependencies.
- Rationale: Edge-portable (v2 Cloudflare goal), no heavyweight deps, and the gateway surface
  the spec needs (create intent/capture/refund) is small and stable.

## DECISION-9: Email templates are React components rendered with react-dom/server
- Context: Spec says "Resend + React Email" as the email stack; @react-email brings a large
  dependency tree for what are 22 static-ish transactional templates.
- Decision: Templates are plain React server components rendered to HTML via
  `renderToStaticMarkup`, with a shared layout mirroring WC's email-header/footer/styles
  partials. Transports: console, SMTP (nodemailer), Resend (fetch), SendGrid (fetch).
- Rationale: Same authoring model (React/TSX), a fraction of the dependency weight, and
  transport-agnostic HTML output.

## DECISION-10: Redis cache adapter accepts an injected ioredis-compatible client
- Context: §8.1 lists RedisCacheAdapter (ioredis) as built-in; hard-depending on ioredis makes
  every install pay for it.
- Decision: `RedisCacheAdapter` takes any ioredis-compatible client instance in its
  constructor; ioredis itself is not a dependency of the monorepo.
- Rationale: Keeps install light; users who want Redis already have a client object.
