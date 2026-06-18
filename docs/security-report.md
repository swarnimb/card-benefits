# Security Report: CardMaxxer

**Last audit:** 2026-06-17 (Feature 11 — Manual Benefit Management, Tasks 79–86 + the post-code-review fixes). Previous: 2026-06-12 (Feature 12 pre-public sweep, Task 92) and 2026-06-09 (Feature 10). Prior reports retained in git history.
**Scope:** The Feature 11 attack surface — `POST /api/benefits` (new write endpoint), `PATCH`/`DELETE /api/benefits/[id]`, `POST /api/benefits/confirm` (shares the create helper), `src/lib/engine/benefit-create.ts`, the new `src/lib/validation/benefit-enums.ts` allowlist module, `src/types/benefit.ts`, `src/lib/auth.ts`, and the `source` schema field. Plus the full SEC-07 sensitive-file sweep, all-history secret scan (repo is slated to go public via Feature 12), `npm audit`, and a working-tree secret scan.
**Status:** CLEAR

**Summary:** 0 Critical / 0 High / 1 Medium / 3 Low (+ carried-forward accepted deviations)

**Unresolved Critical/High findings:** None

> Note: audit ran against the **uncommitted** working tree (Feature 11 build + the code-review fixes). Commit before relying on this report as the record for a specific revision.

---

## Security Audit Report

**Scope:** as above.
**Status:** CLEAR

### Application-layer attack surface (POST / PATCH / DELETE / confirm)

- **[PASS] Broken access control (SEC-04 — IDOR + privilege escalation).** All four verbs enforce ownership *before* mutation. POST/confirm load the `userCard` by id and check `userCard.userId !== getUserId()` before any write (`route.ts:112-118`, `confirm/route.ts:117-124`). PATCH/DELETE load the benefit with `include:{userCard:true}` and check `benefit.userCard.userId !== getUserId()` (`[id]/route.ts:115-121, 155-161`) — the benefit→userCard→userId chain is traversed correctly and guards the same object that is mutated. No verb checks one object and mutates another.

- **[PASS] Mass assignment / parameter pollution (SEC-02).** Well-defended on every path. POST destructures exactly six user fields and hard-codes `classification`/`tracked`/`setAndForget`/`valueUnit`/`resetAnchor`/`source` server-side (`route.ts:39, 70-85`). `createBenefitWithPeriod` persists via an explicit column list with **no `...b` spread** and strips `confidence`/`note` (`benefit-create.ts:71-90`); `userCardId` is the server-validated value, so **re-parenting a benefit to another card is impossible**. PATCH copies only the 9 keys in `ALLOWED_PATCH_FIELDS` — `source`, `classification`, `userCardId`, `id`, `usedAmount`, `createdAt`, `setAndForget` cannot be written; `source` is server-derived (scraped→manual on edit).

- **[PASS] Input validation completeness (SEC-02).** Negative / `NaN` / `Infinity` / string `value` and `usedAmount` are all rejected via `typeof === "number" && Number.isFinite && >= 0` (`route.ts:43`, `[id]/route.ts:50`, `confirm/route.ts:41`). `name` capped at 200 chars, `description` at 1000 (no unbounded-string storage/DoS vector). Enums checked via `Set.has`. Validation runs before the DB lookup on POST/confirm. `usedAmount` is never an accepted input on any create/edit path.

- **[PASS] Injection (SEC-03).** All DB access is parameterized Prisma (`findUnique`/`create`/`update`/`updateMany`/`delete`/`deleteMany`). No `$queryRawUnsafe`/`$executeRawUnsafe` in `src/` outside tests. User strings reach only `console.*` as logged context, never a shell/path/SQL sink.

- **[PASS] Sensitive data exposure (SEC-05).** Every catch returns generic `{error:"Internal server error"}` (500) and logs the real error server-side only. No stack traces, Prisma details, or secrets reach the client. Responses return only the caller's (admin's) own data.

- **[PASS] Integrity — append-only periods (CONSTRAINT-08) & sole usedAmount writer (CONSTRAINT-07).** PATCH only transitions periods `open→closed` or zeroes the OPEN period on a type change; closed periods are never targeted. No user-supplied `usedAmount` write exists; `updateBenefitUsage` remains the sole mutating writer. DELETE cascades periods (`onDelete:Cascade`) — no orphans.

### MEDIUM — Transitive dependency CVEs (carried forward, accepted/deferred)

**Rule:** Insecure dependency (vulnerability category).
**What is wrong:** `npm audit` reports 1 critical / 2 high / 11 moderate overall, but `--omit=dev` (the served runtime graph) is **0 critical / 1 high / 5 moderate**. The critical (`@vitest/mocker`) and one high (`vite`) are **dev-only** test tooling, never bundled. The remaining "high" (`hono` path-traversal/CORS) reaches the graph only transitively via the `prisma` CLI and `shadcn` (both devDependencies) and is never imported by the Next.js runtime. The 5 prod moderates are the same hono advisories — **unchanged from the 2026-06-12 accepted baseline**.
**What could go wrong:** Nothing on the served app — the affected packages don't execute in the request path. Risk is confined to dev/build tooling.
**How to fix it:** Non-blocking. `npm audit fix` (non-breaking) clears the easy transitive moderates without touching Next; a full semver-major dependency bump remains parked for a dedicated session with full build + scrape + integration re-test (per the standing tech-debt note). No NEW high/critical reaches runtime.

### LOW findings (non-blocking)

- **[LOW] Single-admin `getUserId()` is a latent multi-user IDOR footgun.** `getUserId()` returns the env-derived `ADMIN_USER_ID` (`auth.ts:59-61`) rather than the session subject. Correct and safe under the single-credential model (authenticated set == authorized set). **But if a second user is ever added (e.g. the deferred Phase-2/Vercel migration), every ownership check would compare against the same global id → universal horizontal IDOR.** Must be changed to the session's user id before any multi-user work. Carried forward from prior reports.
- **[LOW] `tracked` is client-overridable on confirm (by design).** The review-gate (Decision A) lets the client persist any `tracked` boolean, overriding the deterministic `deriveTracked(classification)` mapping. Impact is cosmetic (Overview/Cards visibility) with no cross-tenant or integrity effect. Accepted as designed.
- **[LOW] PATCH validates the body after the ownership lookup.** Unlike POST (validate-then-lookup), PATCH does lookup+ownership before parsing the body (`[id]/route.ts:112-128`). Not a defect — an unauthorized caller is rejected before any body read or mutation — only an ordering inconsistency with the SEC-02 "validate at boundary first" preference.

### SEC-07 sensitive-file exposure

- **[PASS]** Every SEC-07 file present on disk is gitignored and untracked (verified via `git check-ignore -v` + `git ls-files`): `.env`, `.env.local`, `docs/testing-setup.md`, `session-log.md`, `session-handoff.md`, `framework-issues.md`, `profile.md`, `CLAUDE.md`, `manifest.md`, `prisma/dev.db`, root `dev.db` (via `*.db`). `git status` shows only application code untracked/staged — no sensitive file.

### Git-history secret scan (pre-public)

- **[PASS]** Full-history filename scan (`git log --all --name-only`) surfaced only `.env.example` (placeholders). Pickaxe + secret greps across all 76 commits found no `sk-ant-` key, no real `NEXTAUTH_SECRET`, no committed `.env` or real DB. The only secret-grep hit is `ADMIN_PASSWORD = 'correctpassword'` in `src/__tests__/lib/auth.test.ts` — a dummy test fixture, not a real credential. **Repo is safe to make public.**

### Working-tree secret scan

- **[PASS]** No hardcoded secrets in `src/` or config. `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_USER_ID` (`auth.ts`) and `ANTHROPIC_API_KEY` (`parser/index.ts`) are read only from `process.env`. `.env.example` holds placeholders only.

---

**Summary:** 0 Critical / 0 High / 1 Medium / 3 Low
**Verdict:** **CLEAR** — no Critical or High findings. The new write endpoint and benefit CRUD are well-hardened: correct pre-mutation ownership checks, allowlist-based persistence with no body spread (no re-parenting / privilege-field smuggling), rigorous numeric/length validation, parameterized queries, generic client errors, and intact append-only / sole-writer integrity. The Medium (dep CVEs) is confined to dev/build tooling and matches the accepted baseline; the Lows are non-blocking. **Action item before any multi-user work: fix the single-admin `getUserId()` ownership model (Low #1).**
