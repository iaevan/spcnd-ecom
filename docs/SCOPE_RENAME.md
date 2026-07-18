# SCOPE_RENAME — do this BEFORE step 1 of RESUME.md

The codebase currently uses `@spcnd-ecom/*` as the npm scope for all internal packages.
The decision was made to standardize on the `spacendigital` identity across GitHub
(target org is `spacendigital/spcnd-ecom`) and npm (target org is `@spacendigital`).
Rename before continuing the build so the rest of v1 is written against the final scope.

## Task

Rename the npm scope from `@spcnd-ecom` to `@spacendigital` across the entire codebase.

## What to change

1. **Every `packages/*/package.json`** — `name` field AND every `@spcnd-ecom/*` entry in
   `dependencies`, `devDependencies`, `peerDependencies` → `@spacendigital/*`.
   Example: `"@spcnd-ecom/db": "workspace:*"` → `"@spacendigital/db": "workspace:*"`.
2. **Every import statement in `packages/*/src/**/*.ts`** —
   `from '@spcnd-ecom/...'` → `from '@spacendigital/...'`.
3. **Every import in `packages/*/test/**/*.ts`** — same.
4. **Every reference in `packages/plugin-system/src/discover.ts` and any other code that
   string-matches the package metadata key** — the `package.json["spcnd-ecom"]` plugin
   discovery key is **unchanged** (that's a product-name sentinel, not an npm scope; keep
   it as `"spcnd-ecom"`).
5. **Root `package.json`** — the `scripts` that pass `--filter @spcnd-ecom/<name>` must
   become `--filter @spacendigital/<name>`.
6. **`docs/AGENTS.md`** — update package-name references (`@spcnd-ecom/core`,
   `@spcnd-ecom/plugin-system`, etc.) to `@spacendigital/*`. Keep the product name
   `spcnd-ecom` itself unchanged (the product is still "spcnd-ecom"; only the npm scope
   changes).
7. **`docs/RESUME.md`, `docs/SESSION_START.md`, `docs/OWNER_PLAN.md`** — update any
   `@spcnd-ecom/*` references to `@spacendigital/*`.
8. **Meta-package `packages/spcnd-ecom/package.json`** (when Fable creates it) — name it
   `@spacendigital/spcnd-ecom` OR plain `spcnd-ecom` (unscoped meta-package that re-exports
   the scoped sub-packages). Fable's choice; document it in DECISIONS.md.
9. **`pnpm-workspace.yaml`** — workspace globs reference package directories, not names,
   so no changes unless Fable explicitly filters by name (it doesn't currently).

## What NOT to change

- The product name `spcnd-ecom` — that's the library's brand name (meta-package, repo name,
  CLI binary, TUI title). Unchanged.
- The `package.json["spcnd-ecom"]` plugin-discovery metadata key — unchanged. Plugins are
  still discovered by the literal string `"spcnd-ecom"`.
- The CLI binary name `spcnd-ecom` (e.g. `npx spcnd-ecom init`) — unchanged.
- The cookie name `spcnd_session_*` — unchanged.
- The order-key prefix `wc_order_` — unchanged (that's a WooCommerce compat artifact).
- The `spcnd_*` hook-name prefix in `compat-wc` — unchanged (compat surface for WC plugin
  authors; documented in DECISIONS.md as a compat artifact).
- File paths and directory names under `packages/` (e.g. `packages/core/`,
  `packages/db/`) — unchanged. Only the npm package *names* change, not the directories.
- Database table names, column names, event names, filter names — unchanged.

## Verification

After the rename, before moving on to RESUME.md step 1:

```bash
# Verify nothing references the old scope anymore
grep -rn "@spcnd-ecom" packages/ docs/ 2>/dev/null | grep -v node_modules | grep -v dist | grep -v ".git/"
# Should return zero results (except possibly documented compat strings like the discovery key)

# Build and test the three finished packages
pnpm install
pnpm --filter @spacendigital/types build
pnpm --filter @spacendigital/db build
pnpm --filter @spacendigital/plugin-system build
pnpm --filter @spacendigital/core build
pnpm --filter @spcnd-ecom/types test
pnpm --filter @spcnd-ecom/db test
pnpm --filter @spcnd-ecom/plugin-system test
```

All 21 existing tests (types 6, db 7, plugin-system 8) must still pass after the rename.

## Commit

Single commit, conventional format:

```
refactor: rename npm scope @spcnd-ecom → @spacendigital

Aligns the internal package scope with the target GitHub org (spacendigital)
and the npm org (@spacendigital) the project will publish under. Product name,
CLI binary name, plugin discovery key, cookie prefix, and compat-wc hook-name
prefix are intentionally unchanged — only the npm package scope changes.

See docs/SCOPE_RENAME.md for the full spec of what changed and what stayed.
```

Then `git push -u origin main` (retry 4x with backoff on network errors only).

## After the rename

Continue with `docs/RESUME.md` §"NEXT STEPS" step 1 (finish `@spacendigital/core` — note
the new scope name in subsequent commits).

## Why

The decision was made by the owner to standardize on `spacendigital` as the
GitHub + npm identity. The npm org `@spacendigital` is already created and
owned (https://www.npmjs.com/org/spacendigital), so the renamed packages will
publish under an owned scope. Doing it now (before more of v1 is written) is
much cheaper than renaming after the build is complete. Fable will resume
writing the remaining ~80% of v1 against the final scope, so no second
rename will ever be needed.