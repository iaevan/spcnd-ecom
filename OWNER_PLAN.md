# OWNER_PLAN — future repository transfer

This file documents the plan to move the repo from the personal account to an organization
account once v1 is shippable. **Do not delete until the transfer is complete.**

## Current state

- **Source repo:** `iaevan/spcnd-ecom` (personal account)
- **Default branch:** `main`
- **Work lives on `main` only — never create feature branches.**

## Target state (post-v1)

- **Target repo:** `spacendigital/spcnd-ecom` (the `spacendigital` organization is already
  authenticated in `gh`)
- **No repo has been created there yet.** Do not create it until you are ready to transfer —
  the transfer tool requires the target repo name to be available.

## Transfer procedure (when v1 is ready)

GitHub's repo transfer preserves **everything**: commit history, contributors graph, issues,
PRs, releases, stars, branches, default branch setting. The 4 commits already attributed to
`Ishtiak Ahmed Evan <iaevan008@gmail.com>` travel with the repo.

1. Run the transfer (one command, no UI needed):
   ```bash
   gh repo transfer iaevan/spcnd-ecom spacendigital
   ```
   GitHub will ask `spacendigital` to accept the incoming transfer. If you are an owner of
   `spacendigital` (you are), the transfer completes in seconds.

2. After the transfer, GitHub adds a redirect from the old URL to the new one. Existing
   clones continue to work via the redirect for ~6 months, but update remotes to the new
   URL to avoid relying on the redirect:
   ```bash
   # on every local clone
   git remote set-url origin https://github.com/spacendigital/spcnd-ecom.git
   ```

3. Update the `repository` field in the root `package.json` (and any package-level
   `package.json` that gets one later) to point at the new URL:
   ```json
   "repository": { "type": "git", "url": "https://github.com/spacendigital/spcnd-ecom.git" }
   ```

4. Update SESSION_START.md and RESUME.md if they reference the old URL — current versions
   do not (they reference the branch name only), so likely no change needed.

5. (Optional) Update the npm scope ownership when you publish to npm. If you publish
   `@spcnd-ecom/*` packages from the personal account first, they tie the scope to that
   account. If you publish under the org, transfer the `@spcnd-ecom` npm scope to the
   `spacendigital` org on npmjs.com before first publish. **You have not published yet —**
   so this is a non-issue until you do.

## What does NOT need to change

- Package names (`@spcnd-ecom/*`) — these are npm scopes, not GitHub URLs. They remain the
  same regardless of which GitHub org owns the repo.
- Any code that imports `@spcnd-ecom/*` — works identically.
- The contributors graph — all commits stay attributed to `Ishtiak Ahmed Evan
  <iaevan008@gmail.com>`.
- Star count — transfers over.
- Issues / PRs / releases — transfer over.

## Pre-transfer checklist (verify right before transfer)

- [ ] `git log --format="%an <%ae>" | sort -u` shows only `Ishtiak Ahmed Evan
      <iaevan008@gmail.com>`. No Claude, no Fable, no `iaevan@local`.
- [ ] `gh repo view iaevan/spcnd-ecom --json defaultBranchRef` shows `main`.
- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` all green.
- [ ] README.md and docs/AGENTS.md reflect the actual project state.
- [ ] No feature branches exist (`git branch -a` shows only `main`).

Then run `gh repo transfer iaevan/spcnd-ecom spacendigital` and market away.