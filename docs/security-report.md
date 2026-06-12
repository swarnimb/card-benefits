# Security Report: CardMaxxer

**Last audit:** 2026-06-12 (Feature 12 — pre-public sweep, Task 92; see section at end). Previous: 2026-06-09 (Feature 10 — Usage Accuracy & In-Place Logging, Tasks 67–73)
**Scope:** Feature 10 diff. Security-relevant surfaces: `POST /api/benefits/[id]/usage` (Overview inline usage write), `PATCH/DELETE /api/benefits/[id]` (the `tracked` eye-toggle from Task 73 — mass-assignment scrutiny), `src/lib/engine/usage.ts` (`updateBenefitUsage`), `scripts/audit-benefit-values.ts`, the per-window parser changes, and the Finding-1 easing fix (UI-only). Plus full SEC-07 sensitive-file sweep, git-history scan, `npm audit`, and a `'use server'` (SEC-08) sweep. Supersedes the 2026-06-07 Feature 9 report (retained in git history).
**Status:** CLEAR

**Summary:** 0 Critical / 0 High / 1 Medium / 1 Low (+ carried-forward accepted deviations)

**Unresolved Critical/High findings:** None

---

## Security Audit Report

**Scope:** (as above) — Feature 10 surfaces, SEC-07/git/deps.
**Status:** CLEAR
**Method:** Code-evidence pass by subagent against SEC-01–SEC-09; the two highest-impact surfaces (PATCH mass-assignment, usage-write resource authz) re-verified in person by the security authority (`route.ts:15-17,38-44,82-94` read directly).

---

### Code surface — PASS (no Critical/High)

Verified against SEC-01–SEC-09:

- **`POST /api/benefits/[id]/usage` (Overview inline logging, new path)** — SEC-04: `requireAuth()` → 401; **resource ownership enforced** — `benefit.userCard.userId !== getUserId()` → 403 (no IDOR). SEC-02: body type-guarded, `usedAmount` validated as finite ≥ 0 before business logic; authoritative upper bound clamped in `updateBenefitUsage`. SEC-05: catches log server-side, return generic "Internal server error".
- **`PATCH /api/benefits/[id]` (the `tracked` eye-toggle)** — **mass assignment defended (authority-verified):** `ALLOWED_PATCH_FIELDS` allowlist (`route.ts:15-17`) + `extractPatchFields` copies only whitelisted keys (`:38-44`) — the raw body is never spread into Prisma. `classification`, `usedAmount`, `id`, `setAndForget`, `activatedAt`, and `userCardId`/`cardId` (**ownership reassignment**) are NOT settable by a client. Per-field validation (`validatePatchFields`), auth 401 (`:83`), ownership 403 (`:94`). `value` is intentionally client-editable here (Admin edit field), validated non-negative-number-or-null — by design, distinct from the excluded `usedAmount`.
- **`updateBenefitUsage()` (`engine/usage.ts`, sole `usedAmount` writer)** — clamps to `[0, value]`; pure Prisma (no raw SQL, SEC-03); `UsageEngineError` carries only `benefitId`/`newAmount` (non-sensitive), DB cause stays server-side (SEC-05).
- **`scripts/audit-benefit-values.ts`** — SEC-01: no hardcoded secret (`DATABASE_URL` from env). SEC-03: pure Prisma in `$transaction`. The `--apply <file>` path arg is operator-supplied on a local CLI (no privilege boundary crossed); corrections validated (finite > 0) and scoped to existing benefit IDs. Benign.
- **Finding-1 easing fix** — UI-only token/animation constants (`tokens.ts` + 9 components). No auth, data, or input surface. No security relevance.
- **Server Actions:** `'use server'` = 0 matches in `src/` → **SEC-08 / SEC-09 N/A** (all mutations via standard route handlers).

---

### MEDIUM — Finding 1: Five moderate dependency CVEs (0 Critical/High)

**Rule:** Insecure dependencies (known CVEs)

**Founder Brief**
**Decided:** `npm audit` reports 5 moderate advisories, 0 critical/high (unchanged from Feature 9).
**Means for your product:** Low real-world exposure for a local single-user MVP. `postcss <8.5.10` XSS (GHSA-qx2v-qp2m-jg93, under `next`) needs attacker-controlled CSS served; `@hono/node-server` middleware-bypass (GHSA-92pp-h63x-v22m) sits in Prisma **dev tooling**, not the runtime request path.
**Check before approving:** After bumping, re-run `npm audit` and confirm the moderate count drops.
**What this closes off:** Nothing — both fixes are semver-major (`next`, `prisma`); test scrape + build after bumping.

**What is wrong:** Transitive `postcss` (under `next`) and `@hono/node-server` (under `@prisma/dev`) moderate advisories.
**What could go wrong:** Realistically little in this deployment model; tracked, not blocking.
**How to fix it:** Schedule a Prisma + Next/postcss bump; re-test after. NON-BLOCKING (Medium, documented & tracked — carried from Feature 9).

---

### LOW — Finding 2 (informational): audit-script `corrections.json` artifact not gitignored

**Rule:** SEC-07 (spirit — keep non-source artifacts out of commits)

**What is wrong:** `scripts/audit-benefit-values.ts --apply` reads a corrections file (e.g. a `corrections.json` at repo root) that is not covered by `.gitignore`. No such file currently exists in the tree.
**What could go wrong:** Minimal — the file holds benefit IDs + dollar values, **no secrets**. A stray `git add .` could commit operational data. No external attacker vector.
**How to fix it:** Optional — add `corrections.json` (or a `audit-corrections/` convention) to `.gitignore` when/if the apply mode is first used. Not blocking.

---

### Carried-forward accepted deviations (not re-flagged)

- `ADMIN_PASSWORD` plaintext in `.env`, plaintext compare in `auth.ts` (CONSTRAINT-14 — single-user local, accepted SEC-06 deviation).
- App served over local HTTP, not HTTPS (localhost MVP — accepted SEC-06 deviation; revisit at Phase 2 / Vercel).
- Unbounded numeric `value`/`annualFee` (Feature 9 LOW — harmless single-user; bound at Phase 2 multi-tenant).

### Confirmed CLEAN

- All SEC-07 sensitive paths gitignored: `.env` / `.env*.local`, `CLAUDE.md`, `manifest.md`, `profile.md`, `content/`, and all sensitive `docs/` (`testing-setup`, `session-log`, `session-handoff`, `framework-issues`).
- `git status` — none of the 12 modified/staged files are SEC-07 sensitive (just `docs/plan.md`, `docs/qa-report.md`, source/test/component files).
- **No sensitive file (`.env`, `testing-setup.md`, any `.db`) has ever appeared in git history** — only `.env.example` (a non-secret template). No credential rotation needed.

---

**Summary:** 0 Critical / 0 High / 1 Medium / 1 Low
**Verdict:** **CLEAR** — no Critical or High findings. The two highest-risk Feature 10 surfaces (mass assignment on the `tracked` PATCH, resource-level authz on the usage write) are correctly defended (authority-verified). One Medium (carried-forward dependency CVEs) and one Low (informational gitignore gap) are documented and non-blocking. Feature 10 is clear to ship from a security standpoint, subject to the carried-forward accepted local-MVP deviations.

---

## Feature 12 pre-public sweep (Task 92)

**Date:** 2026-06-12
**Scope:** FULL git history (76 commits, `main` only — no tags, no stashes, no other refs; remote `origin = github.com/swarnimb/card-benefits`, currently private), all 270 paths ever committed, all blob content at every revision, commit metadata, working-tree `.gitignore` coverage. Purpose: gate flipping the repo public for the GitHub Pages demo.
**Method:** `gitleaks` not installed — manual sweep. (1) `git log --all --pretty=format: --name-only | sort -u` path census vs. sensitive-file blocklist. (2) Value-level search: every VALUE in the local `.env` (`DATABASE_URL`, `ANTHROPIC_API_KEY`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_USER_ID`) searched verbatim across the full `git log --all -p` dump and `git grep` over every rev (script printed only variable names + hit counts, never values). (3) Regex sweep of full history: `sk-ant-*`, API-key/password/secret/token assignments, `Bearer` tokens, AWS `AKIA` keys, private-key blocks, all 13–16 digit runs (Luhn-checked), card last-4 markers (`ending in NNNN`, `•••• NNNN`), US phone / SSN / street-address patterns, all `*swarnim*@*` and consumer-domain email addresses. (4) Per-file history review of `.env.example`, `docs/testing-setup.md`, `docs/session-handoff.md`, `docs/session-log.md`, `data/cards/*.json`, `data/card-catalog.json`, and `docs/qa-report.md` usage references.

### Findings

| # | Severity | Location (commit + path) | Finding | Status |
|---|----------|--------------------------|---------|--------|
| 1 | **None — confirmed clean** | all 76 commits, all paths | No `.env`, `*.db`/`*.sqlite`, `docs/session-log.md`, `docs/session-handoff.md`, `docs/testing-setup.md`, `CLAUDE.md`, `manifest.md`, or `.claude/` was EVER committed at any revision. Only `.env.example` (placeholders at every revision — verified via full diff history). | PASS |
| 2 | **None — confirmed clean** | full history, value-level | Zero hits anywhere in history for the actual values of `ANTHROPIC_API_KEY` (108 chars), `NEXTAUTH_SECRET`, and `ADMIN_PASSWORD`. No `sk-ant-*`, AWS keys, private keys, Bearer tokens, or API-key assignments at any rev. **No credential rotation required.** | PASS |
| 3 | **None — confirmed clean** | full history, PII patterns | Zero 13–16 digit runs in the entire history (therefore zero card numbers, Luhn or otherwise), zero last-4 markers, phones, SSNs, addresses. `data/cards/*.json` + `data/card-catalog.json` are public issuer catalog data only (names, URLs, public benefit values) — no scraped personal usage data or dev DB ever committed. | PASS |
| 4 | Info | all 76 commits (author/committer metadata) | `bagreswarnim@gmail.com` is the git author/committer email on every commit. It is also the current `ADMIN_EMAIL` value. This is NOT in any file blob — metadata only. Author emails are public on any public repo (normal OSS practice); the email alone grants nothing (app is local-only, never deployed; password never leaked — see #2). | Accepted. Optional: set a GitHub noreply email for future commits. History rewrite NOT warranted. |
| 5 | Info | e.g. `518bb7e0` / `cd426cad` `docs/qa-report.md` | QA steps reference the owner's real card lineup by name with benefit amounts ("Amex Platinum → $600 Hotel Credit, usedAmount 0→100"). Card names + published benefit values are public catalog info; the usage figures are QA test inputs, not real spend. | Accepted — flagged per policy, no action. |
| 6 | Low (hygiene) | working-tree `.gitignore` | Coverage verified: `.env` + `.env*.local` ✓, `prisma/*.db(-journal)` + global `*.db`/`*.db-journal`/`*.db.bak*`/`*.bak` (demo temp DBs) ✓, `docs/session-log.md` / `session-handoff.md` / `testing-setup.md` / `framework-issues.md` ✓, `CLAUDE.md`/`manifest.md` ✓, `corrections.json` ✓ (closes Feature 10 LOW Finding 2). Gap: a hypothetical `.env.production` / `.env.development` (non-`.local`) would NOT be ignored. | Non-blocking. Recommended: replace the `.env` line with `.env*` + `!.env.example`. |

### Verdict

**CLEAR for public release.** No secrets, credentials, card numbers, or personal data exist anywhere in the pushed history. No history rewrite and no key rotation needed before flipping `github.com/swarnimb/card-benefits` public. Two informational notes (author email in commit metadata; QA-report card names) are accepted as normal for a public repo; one non-blocking `.gitignore` hardening suggestion (#6).
