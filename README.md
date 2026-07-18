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
- **Two-layer plugin system**: a clean typed core (`@spacendigital/plugin-system`) for new JS plugins,
  plus `@spacendigital/compat-wc` that re-exposes the WooCommerce hook names, meta tables, and REST
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
spcnd-ecom/
├── README.md                               # this file (only .md at repo root)
└── docs/
    ├── AGENTS.md                           # THE spec. Fable reads this end-to-end.
    ├── SESSION_START.md                    # Resume protocol for Fable sessions.
    ├── RESUME.md                           # Current build state, what's done, next steps.
    ├── DECISIONS.md                        # Spec-gap decisions honored by all sessions.
    ├── OWNER_PLAN.md                       # Future repo-transfer plan (do not act on it).
    ├── woocommerce_comprehensive_report.md # WC internals — behavioral reference
    ├── woocommerce-core-architecture-report.md # WC architecture — behavioral reference
    ├── woocommerce-feature-parity-report.md   # feature parity checklist
    ├── woocommerce-analysis.md                # earlier WC analysis (data tables, controllers)
    └── woocommerce_api_reference.md          # WC REST controller reference
```

The `docs/AGENTS.md` spec encodes all architecture decisions (multi-dialect DB, two-layer
plugin system, installable-library product shape, Hono-only API, separate admin SPA, opt-in
plugin auto-discovery, plugin TUI, etc.) and is the single source of truth for the build.

## Building it

This repo is being built by Fable in passes — each pass resumes by reading
`docs/SESSION_START.md` and continuing from `docs/RESUME.md`'s next step. The five
`docs/woocommerce-*.md` files are the behavioral reference for WC internals.

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