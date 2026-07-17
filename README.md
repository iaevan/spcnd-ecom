# spcnd-ecom

> **WooCommerce for the JavaScript world.** A MIT-licensed, fully-featured, behavioral-parity
> reimplementation of WooCommerce as an installable TypeScript library.

Nothing in the JS ecosystem comes close to WooCommerce's depth (products, cart, checkout, orders,
payments, shipping, tax, coupons, reviews, customers, webhooks, admin SPA, REST API, plugin
system). spcnd-ecom closes that gap with a stack you actually want to use in 2026: Hono + Drizzle
+ Zod + Astro + React, on SQLite / PostgreSQL / MySQL.

## What it is

- An **installable library** (`npm install spcnd-ecom`), not a hosted product. You drop it into
  your Astro / Next / Hono / Remix / Express app and call factory functions.
- **Full behavioral parity with WooCommerce trunk.** Every feature, data model, algorithm, hook,
  and REST shape is reproduced.
- **Two-layer plugin system**: a clean typed core (`@spcnd-ecom/plugin-system`) for new JS plugins,
  plus `@spcnd-ecom/compat-wc` that re-exposes the WooCommerce hook names, meta tables, and REST
  shapes so PHP WC plugin authors can port with mostly mechanical translation.
- **Multi-dialect storage**: SQLite (zero-config default), PostgreSQL (production), MySQL.
- **One Astro demo app** (in `apps/demo`) showing the canonical wiring — both storefront and
  admin — with seed data and end-to-end purchase flow.

## What it isn't

- Not a WordPress plugin. There is no PHP runtime.
- Not a hosted SaaS. You run it on your own Node server (Cloudflare Workers support is a v2 goal).
- Not a payment processor — it integrates with Stripe, PayPal, COD, BACS, Cheque, etc.

## Repo layout

```
woocommerce-copy/
├── docs/
│   └── AGENTS.md                  # THE spec. Fable reads this end-to-end.
├── woocommerce-comprehensive-report.md     # WC internals — behavioral reference
├── woocommerce-core-architecture-report.md # WC architecture — behavioral reference
├── woocommerce-feature-parity-report.md   # feature parity checklist
├── woocommerce-analysis.md                # earlier WC analysis (data tables, controllers)
├── woocommerce_api_reference.md            # WC REST controller reference
├── FABLE.md                                # The one-shot build prompt for Fable
└── README.md                               # this file
```

The `docs/AGENTS.md` spec **replaces** the original AGENTS.md (preserved as
`docs/archive/AGENTS.original.md` for behavioral cross-reference). It encodes all architecture
decisions (multi-dialect DB, two-layer plugin system, installable-library product shape,
Hono-only API, separate admin SPA, opt-in plugin auto-discovery, plugin TUI, etc.) and is the
single source of truth for the build.

## Building it

This repo is currently in the spec phase — no source yet. The build is executed by Fable in one
shot using `FABLE.md` as the prompt and `docs/AGENTS.md` as the spec. The five `woocommerce-*.md`
files at the repo root are the behavioral reference for WC internals.

Once Fable has run, the resulting structure matches §3 of `docs/AGENTS.md`:

```
packages/   # 16 packages
apps/       # admin (Vite+React) + demo (Astro)
```

## Running it (post-build)

```bash
npm install spcnd-ecom
npx spcnd-ecom init
# TUI lets you choose: storage dialect (SQLite/PG/MySQL), DB URL, auth provider,
# email provider, environment, seed data, plugin auto-discovery.
npm run dev
# storefront: http://localhost:4321
# admin:      http://localhost:4321/spcnd-admin
```

## License

MIT.