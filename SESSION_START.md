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
2. Read **`RESUME.md`** — current build state, what's done, what's in-progress, the ordered
   17-step remaining plan, architecture invariants that must not be broken.
3. Read **`DECISIONS.md`** — 10 spec-gap decisions you must honor (SQLite money as INTEGER minor
   units; money exposed as fixed-4-decimal strings at DB edge + integer cents in core;
   PBKDF2-SHA256 via WebCrypto for auth; `createSpcndApp` in meta-package, `createSpcndCore`
   in core; fetch-based Stripe/PayPal; React Email rendered via renderToStaticMarkup; Redis
   client injected not depended on; canonical settings keys unprefixed with compat-wc
   prefix-shim; SQLite transactions serialized via async mutex; five WC reports serve as
   behavioral reference in lieu of AGENTS.original.md).
4. Read **`docs/AGENTS.md`** — the spec (architecture, schema §5, two-layer plugins §7, build
   order §13, acceptance §14).
5. Use the **five `woocommerce-*.md` reports** only as targeted reference — read a specific
   section when implementing the matching subsystem, never front-to-back. They are large;
   re-reading them burns budget.

**Then continue the build from RESUME.md §"NEXT STEPS" — step 1 (finish core).**

## Working rules (from RESUME.md — repeating for emphasis)

- **Git identity is `Ishtiak Ahmed Evan <iaevan008@gmail.com>`** — set it before the first
  commit, verify with `git config user.name && git config user.email`. Any commit authored as
  "Claude", "Fable", or any other AI/tool name must be amended before push.
- Commit every ~10 file changes. Conventional commit messages. `git push -u origin main`
  (retry 4x with backoff on network errors only).
- Each package must `pnpm --filter <pkg> build` clean before moving on.
- Never: floats for money/stock, `DEFAULT 0` sentinels, a second API framework,
  module-level singletons, core → impl-package imports, more than ~10 changes uncommitted.
- Turbo `test` depends on `^build` — always `pnpm build` before cross-package tests.
- Update `DECISIONS.md` when filling a genuine spec gap. Update RESUME.md's status section
  before ending a session (mark what's done, what's in-progress).
- Never create feature branches. All work goes on `main`.

## If interrupted mid-build

Commit with `wip(scope): description of what's left` and update RESUME.md's status section
to point at the next file you'd have written. Next session reads this file + RESUME.md +
git log to resume in under 30 seconds of context.

## Environment facts (verified by previous session, re-verify if anything seems off)

- Node 22+, pnpm 10.33 available; registry works through proxy; better-sqlite3 compiles.
- `pnpm install && pnpm build && pnpm test` currently green for completed packages
  (types 6 tests, db 7 tests, plugin-system 8 tests — 21 total).
- Docker likely unavailable → write PG/MySQL testcontainers integration tests to skip
  gracefully when `SPCND_TEST_PG_URL` / docker are absent.
- `core` package has no tests yet (scaffold/`entities.ts` only) — that's the in-progress state.