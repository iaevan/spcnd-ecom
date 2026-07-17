# spcnd-ecom — Build Specification

> The single source of truth for the spcnd-ecom build. Fable reads this file end-to-end, then builds the
> whole monorepo in one pass. WooCommerce behavior details that are too long to inline here live in the
> five analysis reports in `docs/` — this spec references them by file and section:
> - `docs/woocommerce_comprehensive_report.md` — combined deep-dive
> - `docs/woocommerce-core-architecture-report.md` — internals
> - `docs/woocommerce-feature-parity-report.md` — feature checklist
> - `docs/woocommerce-analysis.md` — earlier exploration
> - `docs/woocommerce_api_reference.md` — REST reference

This spec **replaces** the original `AGENTS.md`. The architecture and schema are rewritten; the
per-subsystem behavior is referenced from the analysis reports and only the deltas from WC are inlined.

---

## 0. Ten-second pitch

spcnd-ecom is **WooCommerce for the JavaScript world**. It is a MIT-licensed, installable library
(`npm install spcnd-ecom`) that you drop into your Astro / Next / Hono / Remix / Express app. It
gives you a full commerce engine — products, cart, checkout, orders, payments, shipping, tax, coupons,
reviews, customers, webhooks, admin SPA, REST API, plugin system — with full behavioral parity with
WooCommerce trunk. Nothing in the JS ecosystem comes close to WooCommerce's depth; spcnd-ecom closes
that gap.

It is **not** a hosted SaaS, **not** a WordPress plugin, **not** a drop-in replacement for the PHP
runtime. It is the engine, exposed as a typed TS library, with a clean core and a WooCommerce
compatibility layer (`@spcnd-ecom/compat-wc`) that re-exposes the hook names, meta tables, and REST
shapes plugin authors already know.

---

## 1. Product shape

spcnd-ecom is an installable library. The user is expected to write app code that imports it.

```ts
// their-app/src/server.ts
import { createSpcndApp } from 'spcnd-ecom';
import { sqlite } from '@spcnd-ecom/db';
import { ResendMail } from '@spcnd-ecom/email/transports';
import { StripeGateway } from '@spcnd-ecom/payments/gateways';

export const app = createSpcndApp({
  db: sqlite('./spcnd.db'),
  email: new ResendMail(process.env.RESEND_KEY),
  plugins: [
    // manual list (always supported)
  ],
  autoDiscoverPlugins: true, // opt-in: scan node_modules for `package.json["spcnd-ecom"].kind === "plugin"`
  payments: { gateways: [new StripeGateway({ ... })] },
  secret: process.env.SPCND_SECRET,
});

export const handler = app.api.createHandler();      // Hono Request -> Response
export const admin = app.admin.createHandler();     // serves the built admin SPA bundle
export const storefront = app.storefront;           // helpers for Astro/React/Next adapters
```

The demo Astro app in `apps/demo` shows the canonical wiring. spcnd-ecom itself ships no top-level
server process — only the library, factory functions, and adapters.

A meta-package `spcnd-ecom` re-exports the public surfaces of all sub-packages so users can install
one package. Power users can install sub-packages directly (`@spcnd-ecom/core`, `@spcnd-ecom/api`).

---

## 2. Locked decisions

| Concern | Choice |
|---|---|
| Distribution | npm library (install into the user's app) |
| Monorepo | Turborepo + pnpm workspaces |
| Runtime v1 | Node.js 20+ |
| Runtime v2 (later) | Cloudflare Workers / edge — design must not forbid it |
| API framework | Hono (only). Astro and React are *clients* of the Hono API. |
| Storefront framework | Astro (demo in `apps/demo`). Adapters package lets users wire into Next/Remix/Express. |
| Admin | Separate Vite + React SPA in `apps/admin`, shipped as a mountable static bundle + Hydrogen-like client. |
| ORM | Drizzle ORM (works across SQLite/PG/MySQL, type-safe, edge-friendly later). |
| DB v1 | All three dialects supported day one: SQLite (default, zero-config), PostgreSQL, MySQL. |
| Auth | Arctic + Oslo. Session strategy pluggable (DB / KV / cookie-only). |
| Email | Resend + React Email. Transport is an interface; console / SMTP / SendGrid adapters ship. |
| Validation | Zod end-to-end (HTTP, settings, plugin config). |
| Admin UI | shadcn/ui + Tailwind v4. |
| Charts | Recharts in admin only. |
| Plugin ecosystem | Clean typed core + compat layer (`@spcnd-ecom/compat-wc`) reproducing WC shape. Both audiences served. |
| Plugin distribution | Plugins are npm packages. Auto-discovery via `package.json["spcnd-ecom"]` metadata is **opt-in**, toggled in the TUI and in `spcnd-ecom.config.ts`. Default off. |
| Feature scope | 100% behavioral parity with WooCommerce trunk. Built in one Fable pass with the build order in §13. |
| License | MIT |

---

## 3. Monorepo structure

```
spcnd-ecom/
├── packages/
│   ├── types/                 # Shared TS types — generated from @spcnd-ecom/db where possible
│   ├── db/                    # Drizzle schemas for 3 dialects, migrations, dialect detection, seeders
│   ├── core/                  # Framework-agnostic business logic. ZERO Node-only imports outside its IO edge.
│   ├── api/                   # Hono factories: createRestV1(), createRestV3(), createWebhookRouter()
│   ├── auth/                  # Arctic+Oslo integration, session adapters, role/capability system
│   ├── payments/              # PaymentGateway interface + Stripe / PayPal / COD / BACS / Cheque built-ins
│   ├── shipping/              # ShippingService impl + flat_rate / free_shipping / local_pickup
│   ├── tax/                   # TaxService impl + rate finder + jurisdiction tables
│   ├── email/                 # React Email templates (all 22) + transport interface + adaptors
│   ├── reviews/               # Reviews + ratings + verified-purchase + moderation
│   ├── analytics/             # Reporting aggregation + lookup-table sync engine + cache hooks
│   ├── plugin-system/         # Typed bus, DI container, plugin contract, auto-discovery, defineSpcndPlugin
│   ├── compat-wc/             # do_action/apply_filters registry + ~150 WC hook name aliases + meta-table shims + WC-shaped REST serializer
│   ├── adapters/              # @spcnd-ecom/astro, @spcnd-ecom/react, @spcnd-ecom/next (later)
│   ├── ui/                    # shadcn-based admin component library shared with apps/admin
│   ├── cli/                   # `spcnd-ecom init` TUI, `db migrate`, `db sync-lookups`, codegen
│   └── spcnd-ecom/            # Meta-package re-exporting public surfaces
├── apps/
│   ├── admin/                 # Vite + React + React Router + TanStack Query + shadcn. Built to a static bundle the api can serve at `/spcnd-admin`.
│   └── demo/                  # Astro app consuming the library end-to-end. Seed data + a 6-product store.
├── docs/                      # This spec + the 5 WC analysis reports + RESUME.md, SESSION_START.md, etc.
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

### 3.1 Dependency rules (cycles are forbidden by construction)

- `types` → nothing. Auto-generated from `db` Drizzle schemas where shape matches a row.
- `db` → `types`.
- `core` → `db`, `types`, and **interface-only** imports from `auth`, `payments`, `shipping`, `tax`, `email`, `reviews`, `analytics` (via the service-interface interfaces defined in `core`). `core` never imports an impl package.
- `auth` / `payments` / `shipping` / `tax` / `email` / `reviews` / `analytics` → `db`, `types`, and `core`'s interfaces only. Impl packages never import each other.
- `plugin-system` → `types`, `core` interfaces.
- `compat-wc` → `plugin-system`, `core`, `db`. Adds the WC-shaped surface.
- `api` → `core` + service package impls (wired via DI container) + `auth` + `compat-wc`.
- `adapters/astro` → `api` (as a Hono mount), `core` (server-side helpers). `adapters/react` → `api` client only.
- `apps/admin` → `ui` + `api` client.
- `apps/demo` → `spcnd-ecom` meta-package + `adapters/astro`.
- `cli` → `db`, `core` (bootstrapping only).
- `spcnd-ecom` meta-package → re-exports `core`, `api`, `auth`, `payments`, `shipping`, `tax`, `email`, `reviews`, `analytics`, `plugin-system`, `compat-wc`, `db`, `cli`, and adapter helpers.

Every service interaction in `core` goes through an interface. Checkout calls `TaxService`, `ShippingService`, `CouponService`, `PaymentService`, `EmailService` as interfaces — never as imports. pnpm will reject any cycle. Enforced via `dependency-cruiser` in CI.

### 3.2 No global mutable state

There is no module-level `registry` or `bus`. Every `createSpcndApp(config)` returns an isolated `app` whose `bus`, `container`, `db`, and `cache` are instance-bound. Tests get isolated worlds. Plugins installed in one app don't leak into another.

---

## 4. Database design

### 4.1 Multi-dialect rules

Three fully supported dialects: **SQLite** (default, file-based, zero-config), **PostgreSQL** (production recommendation), **MySQL** (supported).

Drizzle produces per-dialect schema files in `packages/db/src/{sqlite,postgres,mysql}/`. Shared column names and types live in `packages/db/src/shared.ts` as builder functions; dialect-specific overrides (e.g. `tsvector` vs `FTS5` vs `FULLTEXT`) are localized to their dialect files.

Hard rules across dialects:

1. **Money is always numeric.** `NUMERIC(19,4)` on PG/MySQL, `TEXT` storing a fixed-4-decimal integer string on SQLite (Drizzle exposes as JS `number`; arithmetic in cents). Never `DOUBLE`, never `FLOAT`. The old spec used `DOUBLE PRECISION` in `order_stats.total_sales` etc. — that's a bug, fixed here.
2. **Stock is numeric.** `NUMERIC(12,3)` PG/MySQL, integer-as-3-decimal string SQLite. Never float.
3. **Timestamps are UTC.** `TIMESTAMPTZ` PG / `DATETIME(3)` MySQL / TEXT ISO-8601 SQLite. Drizzle maps via dialect adapter. All stored values are UTC; display layer converts.
4. **Foreign keys are real.** No `DEFAULT 0` sentinels. Parent references are `NULL` when absent + real FK with explicit `ON DELETE` behavior (see §5).
5. **Enums are CHECK-constrained text columns, not native ENUM types.** Native enums are painful to migrate; a CHECK column with a TS union generated from the same constant file gets us the same safety with cross-dialect parity.
6. **Dimensions and weight carry their own unit.** `weight NUMERIC(10,3) NULL`, `weight_unit CHAR(2) NULL` (defaults to store setting via app-layer coercion, not a column default since the store setting can change). Same for `length`/`width`/`height` + `dimensions_unit`. The WC pattern of `VARCHAR(20)` with no unit is rejected because changing the store unit silently corrupts every row.
7. **Indexes ship with every table.** FK indexes, slug/sku unique, `orders(status, date_created)`, `orders(customer_id, date_created)`, JSONB GIN on PG / JSON1 on SQLite / `JSON_VALUE` indexed virtual columns on MySQL. Full per-table index list is in `packages/db/src/shared.ts` and tested via `EXPLAIN` snapshots.
8. **EAV meta tables are kept on purpose** — they are the plugin extensibility contract. We add composite indexes `(owner_id, key)` and `(key)` on each. Same shape WC has, on purpose, because plugins write to them.
9. **No duplicated relation storage.** The original spec stored `category_ids` as JSONB on `products` *and* as a `product_category_map` junction table. The JSONB duplication is **dropped** — junction tables are the source of truth. `compat-wc` materializes the array shape (`get_category_ids()` etc.) for plugins and the v3 REST serializer.
10. **Lookup/denormalization tables (`product_meta_lookup`, etc.) are kept** because they back list-page performance and the WC REST collection filters. They are written in the **same transaction** as the parent entity. `spcnd-ecom db sync-lookups --rebuild` exists for recovery. Sync logic lives in `core/services/<entity>/write.ts` as a single write path.
11. **Order operational booleans are replaced by an `order_events` append-only table.** `order_stock_reduced`, `download_permissions_granted`, `new_order_email_sent`, `recorded_sales`, `recorded_coupon_usage_counts` are not columns on `orders`. They are rows in `order_events(order_id, event_type UNIQUE, payload JSONB, created_at)`. UNIQUE prevents double-fire. Compat layer exposes `order.is_stock_reduced()` as a lookup. The old WC `order.version` column is dropped (records "WC version that created order" — meaningless here).
12. **`media` table is introduced.** `products.image_id` is `BIGINT NULL` + FK to `media(id)`. `product_categories.thumbnail_id` same. `product_images.url` resolves through `media`. Compat layer exposes `get_image_id()` returning the WC-shaped attachment-id string.

### 4.2 Schemas dropped from the old spec

- `tax_rates.postcode` / `tax_rates.city` — redundant; WC itself stores these only in `tax_rate_locations`. We match WC and drop the columns.
- `api_keys.nonces TEXT` — existed only for OAuth 1.0a, which we do not ship (see §6.3).

### 4.3 Dialect-specific

- **Full-text search.** PG: `tsvector` generated column + `GIN` index on products (name, sku, short_description). SQLite: external FTS5 virtual table with triggers syncing from `products`. MySQL: `FULLTEXT(name, sku, short_description)`. `SearchAdapter` interface hides this from core.
- **JSON.** PG: `JSONB` with `GIN` indexes where relations stored as JSON (e.g. `taxes`, `meta_data` on `order_items`). SQLite: `JSON1` (`json_extract`). MySQL: `JSON` with functional indexes (8.0+).
- **Upsert.** PG: `ON CONFLICT`. MySQL: `ON DUPLICATE KEY UPDATE`. SQLite: `ON CONFLICT`. Drizzle exposes all three.

The complete per-table SQL lives in `packages/db/src/{dialect}/schema.sql` generated by Drizzle + a hand-curated `indexes.sql` per dialect. Fable generates both.

### 4.4 Migrations

`packages/db/migrations/<dialect>/0001_initial.sql` ... `NNNN_*.sql`. Tracked in a `_migrations` table per dialect. CLI commands:

- `spcnd-ecom db migrate` — apply pending.
- `spcnd-ecom db rollback --to N` — revert to a migration.
- `spcnd-ecom db sync-lookups --rebuild` — full rebuild of all denormalized lookup tables in one transaction.
- `spcnd-ecom db seed --file path/to/seed.json` — idempotent seed runner.

Major-version upgrade path (WC's 70+ update callbacks) is documented as a `defineMigration(from, to, fn)` contract in `@spcnd-ecom/db` for the future.

---

## 5. Schema (authoritative tables)

Full per-table DDL is generated by Drizzle. Below is the **authoritative shape** with types described dialect-agnostically. Fable treats this as a contract; the generated DDL in `packages/db` must match.

> Notation: `id BIGSERIAL PK`, `*` = required (NOT NULL), `?` = nullable, `UNIQUE`, `FK` = foreign key.

### Sessions & auth

- **sessions** `id PK, session_key CHAR(32) UNIQUE*, session_value TEXT*, session_expiry BIGINT*` — index on `session_key`, `session_expiry`.
- **auth_sessions** `id PK, customer_id FK→customers.id ON DELETE CASCADE*, token VARCHAR(255) UNIQUE*, expires_at TIMESTAMPTZ*, created_at TIMESTAMPTZ*`.
- **api_keys** `id PK, user_id FK→customers.id ON DELETE CASCADE*, description VARCHAR(200), permissions VARCHAR(10)* (CHECK in {read,write,read_write}), consumer_key CHAR(64) UNIQUE*, consumer_secret CHAR(43)*, truncated_key CHAR(7)*, last_access TIMESTAMPTZ?` — `nonces` column removed (no OAuth 1.0a).

### Products

- **products** — `id PK, type VARCHAR(50)* (CHECK in {simple,variable,grouped,external,virtual,downloadable}), name VARCHAR(500)*, slug VARCHAR(500)* UNIQUE, description TEXT, short_description TEXT, sku VARCHAR(100) UNIQUE?, global_unique_id VARCHAR(100)?, regular_price NUMERIC(19,4)?, sale_price NUMERIC(19,4)?, price NUMERIC(19,4)? (computed/active), date_on_sale_from TIMESTAMPTZ?, date_on_sale_to TIMESTAMPTZ?, status VARCHAR(20)* (CHECK in {publish,draft,pending,private,trash}), catalog_visibility VARCHAR(20)* (CHECK in {visible,catalog,search,hidden}), featured BOOL*, virtual BOOL*, downloadable BOOL*, tax_status VARCHAR(20)* (CHECK in {taxable,shipping,none}), tax_class VARCHAR(200)*, manage_stock BOOL*, stock_quantity NUMERIC(12,3)?, stock_status VARCHAR(20)* (CHECK in {instock,outofstock,onbackorder}), backorders VARCHAR(10)* (CHECK in {no,yes,notify}), low_stock_amount INT?, sold_individually BOOL*, weight NUMERIC(10,3)?, weight_unit CHAR(2)?, length NUMERIC(10,3)?, width NUMERIC(10,3)?, height NUMERIC(10,3)?, dimensions_unit CHAR(2)?, shipping_class_id FK→shipping_classes.id ON DELETE SET NULL?, purchase_note TEXT, menu_order INT*, post_password VARCHAR(255)? (kept for compat-wc password-protected products), reviews_allowed BOOL*, parent_id FK→products.id ON DELETE CASCADE?, image_id FK→media.id ON DELETE SET NULL?, gallery_image_ids JSONB (array of media.id), download_limit INT*, download_expiry INT*, total_sales BIGINT*, average_rating NUMERIC(3,2)*, review_count INT*, rating_counts JSONB, default_attributes JSONB, attributes JSONB, downloads JSONB, external_url VARCHAR(500)?, button_text VARCHAR(200)?, date_created TIMESTAMPTZ*, date_modified TIMESTAMPTZ*`.
  > Dropped vs. old spec: `category_ids`, `tag_ids`, `brand_ids`, `upsell_ids`, `cross_sell_ids` JSONB columns (junction tables are source of truth; compat-wc materializes them).
  > Changed: `weight`/`length`/`width`/`height` from `VARCHAR(20)` to numeric + per-row unit columns.
  > Changed: `image_id` from `VARCHAR(50)` to `BIGINT NULL` + FK to `media`.

- **product_variations** `id PK, product_id FK→products.id ON DELETE CASCADE*, sku VARCHAR(100) UNIQUE?, regular_price NUMERIC(19,4)?, sale_price NUMERIC(19,4)?, price NUMERIC(19,4)?, stock_quantity NUMERIC(12,3)?, stock_status VARCHAR(20)*, weight NUMERIC(10,3)?, weight_unit CHAR(2)?, length NUMERIC(10,3)?, width NUMERIC(10,3)?, height NUMERIC(10,3)?, dimensions_unit CHAR(2)?, image_id FK→media.id ON DELETE SET NULL?, sort_order INT*, enabled BOOL*, description TEXT, download_limit INT?, download_expiry INT?, manage_stock VARCHAR(10)* (CHECK in {parent,yes,no}) — 'parent' magic string kept intentionally so plugin code written against WC's variations ports cleanly, backorders VARCHAR(10)?, tax_class VARCHAR(200)*, shipping_class_id FK→shipping_classes.id ON DELETE SET NULL?, attributes JSONB`.
- **product_variation_attributes** `id PK, variation_id FK→product_variations.id ON DELETE CASCADE*, attribute_id BIGINT?, term_id BIGINT?, attribute_name VARCHAR(200)*, attribute_value VARCHAR(500)*`.
- **attribute_taxonomies** (global attribute taxonomies — kept name for compat) `attribute_id PK, attribute_name VARCHAR(200)*, attribute_label VARCHAR(200)?, attribute_type VARCHAR(20)* (CHECK in {select,text,color}), attribute_orderby VARCHAR(20)*, attribute_public INT*`.
- **product_attributes** (global) `id PK, name VARCHAR(200)*, slug VARCHAR(200) UNIQUE*, type VARCHAR(20)*, sort_order INT*`.
- **product_attribute_terms** `id PK, attribute_id FK→product_attributes.id ON DELETE CASCADE*, name VARCHAR(200)*, slug VARCHAR(200)*, sort_order INT*`.
- **product_categories** `id PK, name VARCHAR(200)*, slug VARCHAR(200) UNIQUE*, description TEXT, parent_id FK→product_categories.id ON DELETE CASCADE?, thumbnail_id FK→media.id ON DELETE SET NULL?, display_type VARCHAR(20)*, sort_order INT*`. (No `DEFAULT 0`; absent parent is `NULL`.)
- **product_tags** `id PK, name VARCHAR(200)*, slug VARCHAR(200) UNIQUE*`.
- **product_images** — **deprecated**, replaced by `media` + `media_links` join below. Kept as a compatibility view in `compat-wc` only.
- **media** `id PK, url TEXT*, alt VARCHAR(500)?, name VARCHAR(500)?, mime_type VARCHAR(100)?, source VARCHAR(50)* (CHECK in {local,s3,r2,external}), source_id VARCHAR(255)?, width INT?, height INT?, file_size BIGINT?, date_created TIMESTAMPTZ*`. Backed by `MediaAdapter` (local fs / S3 / R2).
- **media_links** `media_id FK→media.id*, owner_type VARCHAR(50)* (CHECK in {product,product_variation,category,...}), owner_id BIGINT*, sort_order INT*, PRIMARY KEY (media_id, owner_type, owner_id)`.
- **product_downloads** `id PK, product_id FK→products.id ON DELETE CASCADE*, variation_id FK→product_variations.id ON DELETE CASCADE?, download_id VARCHAR(36) UNIQUE*, name VARCHAR(500)*, file_url TEXT*, sort_order INT*`.
- **product_meta** `id PK, product_id FK→products.id ON DELETE CASCADE*, key VARCHAR(255)*, value TEXT`. Index `(product_id, key)`, `(key)`.
- **product_category_map** `product_id FK*, category_id FK*, PK(product_id, category_id)`.
- **product_tag_map** `product_id FK*, tag_id FK*, PK(product_id, tag_id)`.
- **product_upsell_map** `product_id FK*, upsell_id FK*, PK(product_id, upsell_id)`.
- **product_crosssell_map** `product_id FK*, crosssell_id FK*, PK(product_id, crosssell_id)`.
- **product_grouped_map** `group_id FK*, product_id FK*, sort_order INT*, PK(group_id, product_id)`.
- **product_meta_lookup** (denormalized; written in same txn as `products`) `product_id PK FK→products.id ON DELETE CASCADE, sku VARCHAR(100), global_unique_id VARCHAR(100), virtual BOOL, downloadable BOOL, min_price NUMERIC(19,4), max_price NUMERIC(19,4), onsale BOOL, stock_quantity NUMERIC(12,3), stock_status VARCHAR(100), rating_count BIGINT, average_rating NUMERIC(3,2), total_sales BIGINT, tax_status VARCHAR(100), tax_class VARCHAR(100)`.
- **product_attributes_lookup** `id PK, product_id FK→products.id ON DELETE CASCADE*, attribute_id BIGINT*, term_id BIGINT*, is_variation BOOL*`.

### Orders

- **orders** — `id PK, status VARCHAR(20)* (CHECK in {pending,failed,on-hold,processing,completed,cancelled,refunded,draft,auto-draft,checkout-draft,trash}), currency VARCHAR(3)*, prices_include_tax BOOL*, date_created*, date_modified*, date_paid TIMESTAMPTZ?, date_completed TIMESTAMPTZ?, discount_total NUMERIC(19,4)*, discount_tax NUMERIC(19,4)*, shipping_total NUMERIC(19,4)*, shipping_tax NUMERIC(19,4)*, cart_tax NUMERIC(19,4)*, total NUMERIC(19,4)*, total_tax NUMERIC(19,4)*, customer_id FK→customers.id ON DELETE SET NULL? (guest = NULL, not 0), order_key VARCHAR(22) UNIQUE*, billing_first_name..billing_phone (20 columns, kept flat for compat-wc — WC stores them flat in HPOS too), shipping_first_name..shipping_phone, payment_method VARCHAR(200)*, payment_method_title VARCHAR(500)*, transaction_id VARCHAR(200)?, customer_ip_address VARCHAR(45)?, customer_user_agent TEXT?, created_via VARCHAR(200)?, customer_note TEXT?, parent_id FK→orders.id ON DELETE CASCADE?, cart_hash VARCHAR(32)?`.
  > Dropped: `order.version` (records "WC version that created order"), all five operational booleans (`order_stock_reduced`, `download_permissions_granted`, `new_order_email_sent`, `recorded_sales`, `recorded_coupon_usage_counts`) — replaced by `order_events`.
  > Changed: `customer_id`, `parent_id` no longer `DEFAULT 0` — real FK with `NULL` when absent.

- **order_items** `id PK, order_id FK→orders.id ON DELETE CASCADE*, name TEXT*, type VARCHAR(200)* (CHECK in {line_item,fee,shipping,tax,coupon}), product_id FK→products.id ON DELETE SET NULL?, variation_id FK→product_variations.id ON DELETE SET NULL?, quantity INT?, subtotal NUMERIC(19,4)?, total NUMERIC(19,4)?, total_tax NUMERIC(19,4)?, subtotal_tax NUMERIC(19,4)?, taxes JSONB, meta_data JSONB`.
- **order_item_meta** `id PK, order_item_id FK→order_items.id ON DELETE CASCADE*, key VARCHAR(255)?, value TEXT`.
- **order_notes** `id PK, order_id FK→orders.id ON DELETE CASCADE*, note TEXT*, type VARCHAR(20)* (CHECK in {private,customer,system}), created_by VARCHAR(200)?, created_at TIMESTAMPTZ*`.
- **order_refunds** `id PK, order_id FK→orders.id ON DELETE CASCADE*, amount NUMERIC(19,4)*, reason TEXT?, refunded_by FK→customers.id ON DELETE SET NULL?, refunded_payment BOOL*, date_created TIMESTAMPTZ*`.
- **order_meta** `id PK, order_id FK→orders.id ON DELETE CASCADE*, key VARCHAR(255)*, value TEXT`.
- **order_events** (NEW) `id PK, order_id FK→orders.id ON DELETE CASCADE*, event_type VARCHAR(50)*, payload JSONB?, created_at TIMESTAMPTZ*`. `UNIQUE(order_id, event_type)` — prevents double-fire of events like `stock_reduced`, `download_permissions_granted`, `new_order_email_sent`, `recorded_sales`, `recorded_coupon_usage_counts`.

### Customers

- **customers** `id PK, email VARCHAR(200) UNIQUE*, password_hash VARCHAR(255)*, first_name VARCHAR(200)*, last_name VARCHAR(200)*, display_name VARCHAR(200)*, username VARCHAR(60)?, role VARCHAR(50)* (CHECK in {customer,shop_manager,admin}), is_paying_customer BOOL*, total_spent NUMERIC(19,4)*, order_count INT*, date_created*, date_modified*`.
- **customer_addresses** `id PK, customer_id FK→customers.id ON DELETE CASCADE*, type VARCHAR(20)* (CHECK in {billing,shipping}), first_name..phone (10 columns)`.
- **customer_meta** `id PK, customer_id FK→customers.id ON DELETE CASCADE*, key VARCHAR(255)*, value TEXT`.

### Coupons

- **coupons** — full shape, see `docs/woocommerce_comprehensive_report.md` §6 + `docs/woocommerce-feature-parity-report.md` §10. Types: `fixed_cart`, `percent`, `fixed_product` (CHECK-constrained, plus a future `custom` allowing plugin-defined types via `compat-wc` event hook).
- **coupon_usage** `id PK, coupon_id FK→coupons.id*, order_id FK→orders.id*, customer_id FK→customers.id ON DELETE SET NULL?, amount NUMERIC(19,4)*, date_created TIMESTAMPTZ*`.

### Reviews

- **reviews** `id PK, product_id FK→products.id ON DELETE CASCADE*, customer_id FK→customers.id ON DELETE SET NULL?, rating INT* (CHECK 1..5), content TEXT*, status VARCHAR(20)* (CHECK in {pending,approved,spam,trash}), verified_owner BOOL*, author_name VARCHAR(200)*, author_email VARCHAR(200)*, date_created*`.

### Shipping & tax

- **shipping_zones**, **shipping_zone_locations**, **shipping_zone_methods**, **shipping_classes** — unchanged from old §3.34-3.37 except `user_id` columns use real FK + `NULL`.
- **tax_classes** `id PK, name VARCHAR(200)*, slug VARCHAR(200) UNIQUE*`.
- **tax_rates** `id PK, tax_class_id FK→tax_classes.id?, country VARCHAR(2)*, state VARCHAR(200)*, name VARCHAR(200)*, rate NUMERIC(8,4)*, priority INT*, compound BOOL*, shipping BOOL*, order INT*`. **Dropped** `postcode` and `city` columns (duplicated in `tax_rate_locations`); matches WC.
- **tax_rate_locations** `id PK, tax_rate_id FK→tax_rates.id ON DELETE CASCADE*, location_code VARCHAR(200)*, location_type VARCHAR(40)* (CHECK in {postcode,state,country,continent,city})`.

### Payments & downloads

- **payment_tokens** `id PK, user_id FK→customers.id ON DELETE CASCADE? (real FK, NULL when guest), gateway VARCHAR(200)*, token TEXT*, type VARCHAR(50)*, last4 VARCHAR(4)?, expiry VARCHAR(7)?, is_default BOOL*, date_created*`.
- **payment_token_meta** — kept for plugin extensibility.
- **download_permissions** `id PK, product_id FK→products.id*, order_id FK→orders.id*, order_key VARCHAR(22)*, user_email VARCHAR(200)*, downloads_remaining INT? (-1 = unlimited), access_granted TIMESTAMPTZ*, access_expires TIMESTAMPTZ?, download_count INT*`.

### Webhooks

- **webhooks** `id PK, status VARCHAR(20)* (CHECK in {active,paused,disabled}), name VARCHAR(200)*, user_id FK→customers.id? (NULL not 0), delivery_url TEXT*, secret VARCHAR(255)*, topic VARCHAR(200)*, api_version INT*, failure_count INT*, pending_delivery BOOL*, date_created*, date_modified*`. 17 built-in topics + `action.{hook_name}` custom topics (full list in §15 of the original spec / `docs/woocommerce_comprehensive_report.md` §15).

### Settings (typed)

- **settings_boolean** `key VARCHAR(255) PK, value BOOL*`.
- **settings_integer** `key VARCHAR(255) PK, value BIGINT*`.
- **settings_string** `key VARCHAR(255) PK, value TEXT*`.
- **settings_json** `key VARCHAR(255) PK, value JSONB*`.
- **settings_general** (escape hatch for plugins) `key VARCHAR(255) PK, value TEXT*`.

Core options (`woocommerce_currency`, `woocommerce_default_country`, etc.) are split into typed tables: booleans go to `settings_boolean`, numbers to `settings_integer`, structured data (e.g. `woocommerce_specific_allowed_countries` array) to `settings_json`. compat-wc exposes `get_option('woocommerce_currency')` returning string-shaped data for plugins that expect that.

### Admin & system

- **admin_notes** `id PK, name VARCHAR(255)*, type VARCHAR(20)*, source VARCHAR(200)*, title TEXT*, content TEXT?, is_snoozable BOOL*, is_read BOOL*, severity VARCHAR(20)?, date_created*`.
- **system_log** `id PK, level VARCHAR(20)*, source VARCHAR(200)*, message TEXT*, context JSONB?, created_at*`. (context now JSONB for queryable structured logging.)
- **queue_jobs** `id PK, queue VARCHAR(100)*, payload JSONB*, attempts INT*, available_at TIMESTAMPTZ*, created_at*`. Backs the built-in in-process and BullMQ queue adapters.

### Analytics lookup (denormalized, sync'd in same txn as parent)

- **order_stats** `order_id PK FK→orders.id ON DELETE CASCADE, status*, total_sales NUMERIC(19,4)*, tax_total NUMERIC(19,4)*, shipping_total NUMERIC(19,4)*, net_total NUMERIC(19,4)*, returning_customer BOOL*, customer_id FK?, date_created*, date_paid?`. (All numeric, no float.)
- **order_product_lookup** `order_id FK*, product_id FK*, variation_id FK?, qty*, total_sales NUMERIC(19,4)*, tax_total*, shipping_total*, coupon_amount*`.
- **order_tax_lookup** `order_id FK*, tax_rate_id FK*, tax_total*, shipping_tax_total*`.
- **order_coupon_lookup** `order_id FK*, coupon_id FK*, discount_amount*, discount_amount_tax*`.
- **customer_lookup** `customer_id PK FK*, username*, first_name*, last_name*, email*, total_spent*, order_count*, date_last_active?`.
- **category_lookup** `category_id PK FK*, category_tree*, count INT*`.

### Migrations

- **_migrations** `id PK, name VARCHAR(255) UNIQUE*, applied_at TIMESTAMPTZ*`.

> Fable: the Drizzle-generated DDL for all three dialects must produce exactly this shape. Full per-table behavior — what each column means, what gets written when, and the WC behavior it mirrors — is in the original AGENTS.md §3 (archived in `docs/archive/AGENTS.original.md`) and the WC analysis reports. **Cross-reference those before generating schema files.**

---

## 6. API

### 6.1 Two namespaces served by the same Hono app

- `/api/v1/*` — clean JSON:API-shaped, new JS consumers (Astro storefront, mobile apps, React admin). Stable for v1.
- `/api/v3/*` — WC-shape compat: same field names, `price` and `average_rating` as strings, `X-WP-Total` / `X-WP-TotalPages` pagination headers, `Link` header, batch operations on every CRUD endpoint. For existing WC REST clients. **Drop OAuth 1.0a** from §14.2 of old spec — supported auth is HTTP Basic over SSL (consumer_key + consumer_secret) and bearer-token API keys for admin-app clients.

### 6.2 Endpoint registry

The full 45+ controller list is in the original AGENTS.md §14.3 and `docs/woocommerce_api_reference.md`. All are implemented for both v1 and v3 — v3 controller is a thin serializer adapter over v1.

### 6.3 Auth

- HTTP Basic (consumer_key + consumer_secret) for `/api/v3/*` REST parity.
- Bearer token (admin-app API keys) for `/spcnd-admin/*` and `/api/v1/*` admin surfaces.
- Customer session cookie for storefront routes.

`api_keys` table holds the keys. No OAuth 1.0a, no `nonces` column.

### 6.4 Webhook router

`createWebhookRouter()` mounts at `/api/webhooks/delivery` (inbound) and uses `compat-wc`'s `WebhookDelivery` service for outbound. Signature: `base64(hmac_sha256(payload_body, secret))`; timeout 60s (configurable; the queued job is decoupled from request lifecycle via `queue_jobs` so edge-portable later); 5 consecutive failures → `disabled`.

---

## 7. Plugin system (two layers)

The hook system is the soul of WooCommerce and must be reproduced. But it must be reproduced in a way that doesn't poison the typed core.

### 7.1 Layer 1 — `@spcnd-ecom/plugin-system` (typed core API)

- **Typed event bus**: `bus.emit(event<T>(symbol), payload: T)` and `bus.filter<T>(event, value, ...)`. Events are opaque typed descriptors created via `defineEvent<T>('product.save.before')`. Per-app-instance bus — no globals.
- **DI container**: `container.resolve<T>(ServiceToken<T>())`. Tokens are typed symbols registered at app boot.
- **Plugin contract**: `defineSpcndPlugin({ id, version, setup(app, container) { ... } })`. Lifecycle hooks `onActivate`, `onDeactivate`, `onInstall`, `onUninstall` (called by the plugin-system when storage changes plugin state).
- **Auto-discovery**: scans `node_modules` for packages with `package.json["spcnd-ecom"] = { kind: "plugin", entry: "./dist/index.js" }`. Default **off**; user toggles in TUI or sets `autoDiscoverPlugins: true` in config. Manual `plugins: [pluginInstance]` list always supported.
- **Capability gating**: plugins declare required capabilities (`payments.process`, `shipping.rate`, etc.) in their manifest; incompatible platforms (e.g. edge) refuse to load.

Built-in features (cart, checkout, orders, etc.) are themselves implemented as plugins against the same contract — there is no privileged path. They just ship by default in the meta-package.

### 7.2 Layer 2 — `@spcnd-ecom/compat-wc` (WooCommerce shape)

- **`doAction(name, ...args)`** and **`applyFilters<T>(name, value, ...args)`** — global-shape registry for WC-porting plugins. Routes through the typed bus internally, so actions/filters and typed events share one pipeline. Hook names approximate the 150 names in old AGENTS.md §28 (full list reproduced below in §7.3 with deltas marked).
- **Hook name typing map**: known hook names are typed (`applyFilters<'woocommerce_product_get_price', number, ...>`); unknown names return `any` at the boundary, documented.
- **`spcnd_register_post_type` / `spcnd_register_taxonomy`** — these names exist (they're emitted as no-op events at app boot) because WC-porting plugin authors put initialization logic in those hooks. The names are kept purely for surface familiarity. Documented as compat-only; behavior under the hood is replaced by the typed `defineEntityType()` API in `@spcnd-ecom/core`.
- **Meta-table shims**: `getProductMeta(productId, key)`, `updateProductMeta(...)`, etc. wrapping the EAV tables, matching WC's `get_post_meta`/`update_post_meta` signatures.
- **`get_woocommerce_*` helper shims**: `get_woocommerce_currency()`, `woocommerce_weight_unit()`, etc. — wrapped over typed settings tables.
- **WC-shaped REST serializer**: takes a v1 domain object and emits the v3 WC-shaped JSON (`price` as string, `dimensions` as nested strings, `images[].src` as resolved media URL, etc.). This is what powers `/api/v3/*`.
- **`{prop}` getter filters**: `applyFilters('woocommerce_product_get_price', price, product)` style filters on every property. The compatibility layer walks the typed getter and fires the legacy filter so plugins filtering `woocommerce_product_get_price` keep working.

### 7.3 Full hook name catalog (reproduce all, per old AGENTS.md §28)

Product, Cart, Checkout, Order, Shipping, Tax, Coupon, Payment Gateway, Webhook, Lifecycle — all ~150 names from old §28.1 through §28.10. Reproduce verbatim. Behavioral triggers and signatures are in old §28 and in `docs/woocommerce-core-architecture-report.md` §6 (cart), §7 (checkout), §8 (order) etc.

Delta from old §28.10: `spcnd_register_taxonomy` / `spcnd_after_register_taxonomy` / `spcnd_register_post_type` / `spcnd_after_register_post_type` are emitted as no-op compat events at boot; they do not create WP-style CPTs (we have PG tables). Documented clearly.

### 7.4 WC porting workflow

A PHP WC plugin author ports to spcnd-ecom by:
1. `npm init`, write TypeScript.
2. `import { defineSpcndPlugin, doAction, applyFilters, getProductMeta, ... } from '@spcnd-ecom/compat-wc'`.
3. Replace their `add_action('woocommerce_X', fn)` with `compat.on('woocommerce_X', fn)`. Same hook names, same payloads.
4. Replace `get_post_meta`/`update_post_meta` with the meta shims.
5. For new work, prefer the typed `bus` and `defineEvent` API from Layer 1.

`compat-wc` is documented end-to-end in its package README and exercised by a port-test suite (`tests/compat/*.test.ts`) that takes real WC plugin behaviors from `docs/woocommerce-analysis.md` and verifies the compat layer reproduces them.

---

## 8. Cross-cutting concerns

### 8.1 Cache

`CacheAdapter` interface. Built-in adapters:
- `MemoryCacheAdapter` (LRU, default; works on Node and edge).
- `RedisCacheAdapter` (`ioredis`).
- `KvCacheAdapter` (Cloudflare KV — registered lazily, only loaded if `caches` global exists).

Bus emits cache-invalidation events keyed by entity + version. WC's `DONOTCACHEPAGE`/`DONOTCACHEOBJECT`/`DONOTCACHEDB` semantics (per `docs/woocommerce-analysis.md` §8) are reproduced as scoped invalidation scopes.

### 8.2 Search

`SearchAdapter` interface. Built-ins:
- PG: `tsvector` generated column + GIN.
- SQLite: FTS5 virtual table synced from `products` via triggers.
- MySQL: `FULLTEXT(name, sku, short_description)`.
- Optional: external adapters (MeiliSearch, Typesense, Algolia) via plugin.

Default falls back to LIKE on lookup columns for tiny catalogs. `search`, `search_sku`, `search_name_or_sku`, `search_fields` query params from old §14.5 are honored.

### 8.3 Media

`MediaAdapter` interface. Built-ins: `LocalMediaAdapter` (Node FS), `S3MediaAdapter`, `R2MediaAdapter`. `media` table tracks metadata; the adapter handles actual bytes. Signed URLs for downloads. `products.image_id` and `gallery_image_ids` reference `media.id`.

### 8.4 Email

`EmailTransport` interface. Built-ins: console (dev), Resend, SendGrid, SMTP (Nodemailer). All 22 templates from old §13.1 are React Email components in `packages/email/templates/<template-id>.tsx`. Per-template config (enabled / subject / heading / additional_content / cc / bcc / recipient) lives in `settings_json`.

### 8.5 Observability

`Logger` and `MetricsCounter` interfaces. Built-in `ConsoleLogger` (pretty dev), `JsonLogger` (prod), `SystemLogLogger` (writes to `system_log` table). OpenTelemetry-friendly: spans emitted when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.

### 8.6 i18n

Full country/state data (250+ countries, all states, continents, phone codes, EU + VAT lists — see `docs/woocommerce_comprehensive_report.md` §20.2). 150+ currencies with symbols. 40+ country address formats and 80+ country-local overrides. Reproduces all WC address-format and postcode-format rules (old §20.3, §20.6).

### 8.7 GDPR

Data exporters and erasers per old §24.1, §24.2. Anonymization rules per §24.4. Automated retention jobs are queued via `queue_jobs` and run by a `QueueAdapter` (BullMQ adapter built-in; in-process adapter for dev). Retention options per old §17.1.

### 8.8 Sessions

DB-backed by default, with KV-backed and cookie-only adapters. Cookie shaping per old §22 — `{customer_id}|{expiration}|{expiring}|{hmac_hash}`. HMAC computed with app secret. Guest→logged-in migration data-copy semantics preserved (old §22.4 step 2).

### 8.9 Migrations + seeding

Documented above (§4.4). Demo seed ships in `apps/demo/seed.json` with 6 products across 2 categories, 1 coupon, 2 shipping zones, 5 tax rates, 1 admin user, 1 customer.

### 8.10 Testing

- Unit tests (`vitest`) — core against in-memory SQLite; service impls against PG/MySQL via `testcontainers`.
- Integration tests — full Hono app via `supertest`-style request/response helpers.
- e2e — Playwright against `apps/demo` (auth, browse, cart, checkout, admin CRUD).
- Plugin-author harness — `createTestApp()` returning an isolated app + bus + container + temporary SQLite DB.

---

## 9. Admin SPA (`apps/admin`)

Vite + React 18 + React Router 6 + TanStack Query + shadcn/ui + Tailwind v4 + Recharts.

Built to a static bundle (`apps/admin/dist`) that the `@spcnd-ecom/api` `createAdminHandler()` can serve at `/spcnd-admin` from any host. Also buildable standalone with `pnpm build --filter @spcnd-ecom/admin`.

### 9.1 Pages (full WC parity, per old §16.1 + §16.2)

Dashboard (Performance overview, charts, leaderboards), Products (CRUD, bulk edit, import/export, variations, reviews tab), Orders (list, detail, refunds, notes, resubmit), Customers, Coupons, Reviews moderation, Shipping Zones, Shipping Classes, Tax Rates, Tax Classes, Payment Gateways, Email Notifications (per-email 22 configs), Settings (11 tabs — General, Products, Tax, Shipping, Payments, Accounts & Privacy, Emails, Integrations, Site Visibility, POS, Advanced), Analytics (10 report types + leaderboards), System Status, API Keys, Webhooks.

### 9.2 Charts

Recharts on client only. Admin is a separate SPA — does not break the "core is edge-portable" claim.

### 9.3 Components

Shared `@spcnd-ecom/ui` (shadcn-based) — used by admin only; not depended on by `core` or `api`.

---

## 10. Storefront (`apps/demo` + `@spcnd-ecom/adapters/astro`)

The demo Astro app is the canonical example. All page templates from old §19.1 are implemented:
- Shop/archive, single product, category archive, tag archive, cart, checkout, thank-you, my-account, login/register, lost-password.
- Components replacing 20 shortcodes (old §19.2) and 15 widgets (old §19.3) — implemented as Astro components in `apps/demo/src/components/` and exported from `@spcnd-ecom/adapters/astro` for reuse.
- All 16 form handlers (old §19.4) implemented as Astro server endpoints calling the API.

`@spcnd-ecom/adapters/react` ships a typed Hono-api client + React hooks for users who want a React storefront.

`@spcnd-ecom/adapters/next` ships a Next.js app-router integration (later — stub in v1).

---

## 11. SEO & structured data

JSON-LD schemas generated per old §21.1: `Product` (single), `AggregateOffer` / `Offer` (variable), `BreadcrumbList`, `WebSite` with `SearchAction`, `Order` (in email). URL structure: `/product/{slug}/`, `/product-category/{slug}/`, `/product-tag/{slug}/`. XML sitemap, canonical URLs, `rel="next"`/`rel="prev"`, image alt. All generated by `core/seo` and consumed by the Astro adapter.

---

## 12. Calculation algorithms

Reproduce exactly from old §27 and `docs/woocommerce-core-architecture-report.md`:
- Order total calculation (old §27.1)
- Grand total formula (old §27.2)
- Tax calculation on order (old §27.3)
- Tax line consolidation (old §27.4)
- Coupon application to order (old §27.5)
- Rounding strategy — per-line vs subtotal (old §27.6)
- Fee capping to prevent negative grand total (old §27.7)
- Number precision — internal calculations in integer cents (`× 10^precision`) to avoid float errors (old §27.8). Where WC uses `float`, we use integer cents or `NUMERIC(19,4)`. Behavior identical.

All arithmetic in core happens on integer cents via a `Money` value type; conversion to/from `NUMERIC(19,4)` happens at the DB edge. Display layer formats per store currency settings.

---

## 13. Build order for one Fable pass

Fable fills files in this order. Each step's package must compile (`tsc --noEmit`) before the next starts.

1. Root: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `vitest.workspace.ts`, `biome.json`, `.gitignore`, `.dockerignore`.
2. `packages/types` — shared enums, brand-id types, money type.
3. `packages/db` — Drizzle schemas for 3 dialects, first migration (`0001_initial`), seeders.
4. `packages/core` essentials: entities (Product, Order, Customer, Coupon, TaxRate, ShippingMethod, etc.), repositories, `Money`, service interfaces (`ShippingService`, `TaxService`, `CouponService`, `PaymentService`, `EmailService`, `MediaService`, `CacheService`, `SearchService`, `Logger`, `QueueAdapter`).
5. `packages/plugin-system` — typed bus, DI container, `defineSpcndPlugin`, auto-discovery.
6. `packages/compat-wc` — `doAction`/`applyFilters` registry, all ~150 hook names, meta-table shims, WC-shaped REST serializer skeleton.
7. `packages/auth` — Arctic + Oslo integration, session adapters, role/capability system.
8. `packages/core` cart + checkout orchestration (calls service interfaces inside a txn).
9. `packages/core` orders + `order_events` state machine.
10. `packages/tax` engine + rate finder + jurisdiction data + 5 default rates.
11. `packages/shipping` zones + flat_rate / free_shipping / local_pickup + shipping classes.
12. `packages/payments` gateway interface + Stripe + PayPal + COD + BACS + Cheque.
13. `packages/reviews` + verified-purchase + moderation.
14. `packages/email` — all 22 React Email templates + 4 transports + queue integration.
15. `packages/analytics` — 10 reports + leaderboards + lookup-table sync engine.
16. `packages/api` — `createRestV1()`, `createRestV3()` (compat-wc serializer), `createWebhookRouter()`, `createAdminHandler()`.
17. `packages/ui` — shadcn-based admin component library.
18. `apps/admin` — Vite + React SPA, all admin pages, Playwright e2e smoke.
19. `packages/adapters/astro` + `packages/adapters/react`.
20. `apps/demo` — Astro wiring, all page templates, seed runner.
21. `packages/cli` — TUI init, db commands, codegen.
22. `packages/spcnd-ecom` meta-package re-exports.
23. Cross-cutting: cache adapters, search adapters, media adapters, observability, i18n dataset, GDPR jobs, downloads/permissions, sessions, migrations.
24. Finish `compat-wc`: all hook name aliases exercised in `tests/compat/*`.
25. Documentation site (Astro Starlight) at `apps/docs` — optional in v1; the package READMEs + this spec are primary.

Everything ships together in the first Fable pass.

---

## 14. Acceptance criteria — what "done" means

- `pnpm install && pnpm build && pnpm test` succeeds cleanly from a fresh clone.
- `npm install spcnd-ecom && npx spcnd-ecom init` (with SQLite, console email, dev seed, no auto-discovery) → user gets a `spcnd-ecom.config.ts`, runs `npm run dev`, opens `localhost:4321` (Astro demo) and `localhost:4321/spcnd-admin` (admin) and can complete an end-to-end purchase (browse → cart → checkout with COD → order saved → confirmation email printed to console → admin shows order).
- `pnpm test:integration` runs against SQLite, PG (testcontainers), and MySQL (testcontainers) and passes.
- `pnpm test:e2e` (Playwright) runs against `apps/demo` and covers auth, browse, cart, checkout, admin CRUD.
- `pnpm test:compat` exercises at least 30 documented WC plugin behaviors against the compat-wc layer.
- `pnpm lint && pnpm typecheck` clean across all packages.
- `dependency-cruiser` reports zero cycles.
- Every public surface has TSDoc; README files exist at root, each package, and `docs/`.

---

## 15. Files referenced by this spec

- `docs/archive/AGENTS.original.md` — the original 3220-line spec, kept for behavioral cross-reference (sections 4–30 are still the authoritative WC behavior description).
- `docs/woocommerce_comprehensive_report.md` — WC internals deep-dive.
- `docs/woocommerce-core-architecture-report.md` — WC architecture deep-dive.
- `docs/woocommerce-feature-parity-report.md` — feature parity checklist.
- `docs/woocommerce-analysis.md` — earlier analysis (data tables, controllers).
- `docs/woocommerce_api_reference.md` — REST controller reference.

Fable reads this spec top to bottom, then cross-references the analysis reports while implementing each subsystem. The two-layer plugin system in §7 + the schema in §5 + the build order in §13 are the highest-leverage decisions; everything else can be recovered from the analysis reports.