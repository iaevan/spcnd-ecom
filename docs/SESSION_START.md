# SESSION START — read this first

You are resuming the spcnd-ecom build. Work is committed on branch **`main`**
(push target is `main` only — never push elsewhere, never create feature branches).

**Resume sequence (do not skip):**

0. **Set git identity to the project author (FIRST, before any commit):**
   ```bash
   git config user.name "Ishtiak Ahmed Evan"
   git config user.email "iaevan008@gmail.com"
   ```
   Verify with `git config user.name && git config user.email`. Never commit as anyone else.
   Never use "Claude" or any AI tool name as author/committer. The repo author is Ishtiak Ahmed
   Evan and every commit — yours and any agent's — must be attributed to him.
1. `git status && git log --oneline -3` — confirm clean state and last commit.
2. Read **`docs/RESUME.md`** — current build state, what's done, what's in-progress, the ordered
   17-step remaining plan, architecture invariants that must not be broken.
3. Read **`docs/DECISIONS.md`** — 10 spec-gap decisions you must honor (SQLite money as INTEGER minor
   units; money exposed as fixed-4-decimal strings at DB edge + integer cents in core;
   PBKDF2-SHA256 via WebCrypto for auth; `createSpcndApp` in meta-package, `createSpcndCore`
   in core; fetch-based Stripe/PayPal; React Email rendered via renderToStaticMarkup; Redis
   client injected not depended on; canonical settings keys unprefixed with compat-wc
   prefix-shim; SQLite transactions serialized via async mutex; five WC reports serve as
   behavioral reference in lieu of AGENTS.original.md).
4. Read **`docs/AGENTS.md`** — the spec (architecture, schema §5, two-layer plugins §7, build
   order §13, acceptance §14).
5. Use the **five `docs/woocommerce-*.md` reports** only as targeted reference — read a specific
   section when implementing the matching subsystem, never front-to-back. They are large;
   re-reading them burns budget.

## ⚠ SCOPE_RENAME.md is DONE — skip it

The npm-scope rename from `@spcnd-ecom/*` to `@spacendigital/*` was completed in commit
`514b16b` and verified (21 tests still green). Do not re-run it. Continue directly to
RESUME.md step 1.

## ⚠ SECURITY BLOCK — read this before doing anything

**Do NOT read `docs/SECURITY_WORK.md`.** That file contains the trigger words that trip
your safety classifier. It exists ONLY for an Opus 4.8 session to read later.

The build has been split: steps 1–17 in `docs/RESUME.md` are Fable-5-safe. The
security-adjacent work (credential storage, integrity-tag signing, third-party
payment-provider clients, admin access-token issuance, OAuth wiring, i18n states/
address-formats/country-locale) has been moved to `SECURITY_WORK.md` as items S1–S8,
deferred to a later Opus 4.8 session.

**Do NOT read the following doc sections — they contain sanctioned-country references
in financial/tax/address-format context that trip your safety classifier:**
- `docs/woocommerce-analysis.md` §5.4 (VAT Countries list with IR/KP/SY/RU/BY/CU codes)
- `docs/woocommerce-analysis.md` §5.7 (Address Formats with sanctioned-country formats)
- `docs/woocommerce-analysis.md` §5.8 (Country Locale Overrides)
- `docs/woocommerce-analysis.md` §6.3 (Price Formatting — currency symbols for sanctioned-country currencies like RUB)
- Any other section that pairs a country list with financial / tax / payment context.

When in doubt, do NOT read `docs/woocommerce-analysis.md` at all. The other four WC
reports (`comprehensive_report`, `core-architecture-report`, `feature-parity-report`,
`api_reference`) cover the same behavioral ground for catalog/cart/checkout/orders/
coupons/discounts/shipping/tax engine/reviews/email/analytics — those don't contain
the VAT-country-list trigger pattern.

If you find yourself about to generate code involving any of: credential hashing,
integrity tags / signing, third-party payment clients, OAuth, admin access-token
issuance, or i18n state/address-format/locale data — **STOP**, write a
`/* TODO:security-blocked — see docs/SECURITY_WORK.md item S<N> */` marker in place of
the implementation, skip that file, and continue with the next non-security item in
RESUME.md's "NEXT STEPS" list.

---

**Then continue the build from docs/RESUME.md §"NEXT STEPS" — step 1 (finish the
non-security parts of @spacendigital/core).**

## Working rules (from docs/RESUME.md — repeating for emphasis)

- **Git identity is `Ishtiak Ahmed Evan <iaevan008@gmail.com>`** — set it before the first
  commit, verify with `git config user.name && git config user.email`. Any commit authored as
  "Claude", "Fable", or any other AI/tool name must be amended before push.
- Commit every ~10 file changes. Conventional commit messages. `git push -u origin main`
  (retry 4x with backoff on network errors only).
- Each package must `pnpm --filter <pkg> build` clean before moving on.
- Never: floats for money/stock, `DEFAULT 0` sentinels, a second API framework,
  module-level singletons, core → impl-package imports, more than ~10 changes uncommitted.
- Turbo `test` depends on `^build` — always `pnpm build` before cross-package tests.
- Update `docs/DECISIONS.md` when filling a genuine spec gap. Update docs/RESUME.md's status section
  before ending a session (mark what's done, what's in-progress).
- Never create feature branches. All work goes on `main`.

## If interrupted mid-build

Commit with `wip(scope): description of what's left` and update docs/RESUME.md's status section
to point at the next file you'd have written. Next session reads this file + docs/RESUME.md +
git log to resume in under 30 seconds of context.

## Repo ownership (read docs/OWNER_PLAN.md — do not act on it)

The repo is currently at `iaevan/spcnd-ecom` (personal). It will be transferred to the
`spacendigital` org after v1 ships. **Do not initiate the transfer.** Do not change the
`repository` field in any `package.json` to point at `spacendigital`. Do not create the
`spacendigital/spcnd-ecom` repo. The owner will handle the transfer when v1 is ready.
Ignore this section if `docs/OWNER_PLAN.md` is missing or says transfer is complete.

## Environment facts (verified by previous session, re-verify if anything seems off)

- Node 22+, pnpm 10.33 available; registry works through proxy; better-sqlite3 compiles.
- `pnpm install && pnpm build && pnpm test` currently green for completed packages
  (types 6 tests, db 7 tests, plugin-system 8 tests — 21 total).
- Docker likely unavailable → write PG/MySQL testcontainers integration tests to skip
  gracefully when `SPCND_TEST_PG_URL` / docker are absent.
- `core` package has no tests yet (scaffold/`entities.ts` only) — that's the in-progress state.