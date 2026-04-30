# Founder Brief: CardMaxxer

> Produced by `@plan` — 2026-04-07
> Plain-language record of every architectural decision made during Phase 2.
> `docs/architecture.md` cannot change without a corresponding update to this file.

---

## FB1 — Synchronous Scraping (No Job Queue)

**Date:** 2026-04-07
**Architecture section:** `docs/architecture.md` → Scraper Architecture

**Decided:** Playwright scrapes run inline in the Next.js API route handler. The client waits for the HTTP response (~15-30 seconds).

**Means for your product:** The "Fetch Benefits" button triggers a single HTTP request that takes up to 30 seconds. During that window, the loading screen shows "Fetching... → Parsing... → Done." No background jobs, no queue, no separate worker process. If the server restarts during a scrape, the scrape is lost — the user would need to retry.

**Check before approving (asked 2026-04-07):** Acceptable — scraping is rare (initial setup + quarterly re-scrapes). 30-second waits are not a UX problem at that frequency.

**What this closes off:** Hard to scrape multiple cards simultaneously (parallel Playwright instances + parallel requests would be needed). Adding concurrent multi-card scraping later requires extracting the scraper into a background job system (BullMQ + Redis or similar). For one-card-at-a-time scraping, this is permanently fine.

---

## FB2 — Lazy Period Calculation (GET with Write Side-Effect)

**Date:** 2026-04-07
**Architecture section:** `docs/architecture.md` → Period Engine

**Decided:** Period boundaries are calculated and advanced at read time (when benefits are fetched via API), not by a scheduled background job.

**Means for your product:** When you open the app after a monthly reset, the first API call detects the expired period, closes it, and opens a new one — all in the same request. You always see current-period data. The GET `/api/benefits/[userCardId]` and GET `/api/overview` routes have write side-effects. No cron setup needed on the local machine.

**Check before approving (asked 2026-04-07):** If you don't open the app for 2 months, periods don't advance until next open. Periods advance correctly the moment you next use the app. Acceptable for a weekly-use personal tool.

**What this closes off:** No automated background period history tracking. If you want "automatically snapshot usage at end of month" (for historical reporting), you'd need to add a scheduled task. Not relevant for MVP — the tracker is about current awareness, not historical audit.

---

## FB3 — Card Catalog is Static JSON

**Date:** 2026-04-07
**Architecture section:** `docs/architecture.md` → Directory Structure (`data/card-catalog.json`)

**Decided:** `data/card-catalog.json` holds all known cards (issuer, name, scrapeUrl, defaultColor). The Admin "Add Card" picker reads from this file at runtime. Adding a new catalog card means editing the JSON file and restarting the server.

**Means for your product:** No DB migration needed to add cards to the catalog. Edit one JSON file, restart, new card appears in the picker. Custom cards (not in catalog) are still addable via the Admin form — they just have no scrape URL and require manual benefit entry.

**Check before approving (asked 2026-04-07):** You'll edit a JSON file to add new catalog cards. Acceptable — for a personal tool with a known set of cards, this is fine.

**What this closes off:** Can't add/edit/remove catalog cards from the app UI. Catalog management is a developer action (edit JSON + restart). Easy to change post-MVP if you want a catalog admin interface.

---

## FB4 — No User DB Table (JWT Sub as UserId)

**Date:** 2026-04-07
**Architecture section:** `docs/architecture.md` → Data Model, Security Architecture

**Decided:** The single user's ID is a fixed string in `.env` (`ADMIN_USER_ID`). NextAuth JWT carries this as `sub`. `UserCard.userId` stores this string. No `User` model in the Prisma schema. NextAuth uses JWT strategy — no DB adapter, no Session/Account/VerificationToken tables.

**Means for your product:** Zero auth DB overhead. Session validation is a JWT signature check (CPU only, no DB query). Auth is completely stateless. Revoking all sessions requires changing `NEXTAUTH_SECRET` in `.env` and restarting the server.

**Check before approving (asked 2026-04-07):** Multi-user support requires: adding a `User` table, migrating `UserCard.userId` to a foreign key, and switching NextAuth to a DB adapter. A ~1-hour migration when needed. Confirmed acceptable.

**What this closes off:** No per-user profile pages or settings in MVP. Can't list/revoke active sessions from Admin. Can't add a second user without a real migration. None of these are needed for a personal tool.

---

## FB5 — Replace-on-Rescrape Deletes Usage History

**Date:** 2026-04-07
**Architecture section:** `docs/architecture.md` → Period Engine, Data Model

**Decided:** When re-scraping a card, the POST `/api/benefits/confirm` deletes ALL existing `Benefit` records for that `userCardId` (cascading to `BenefitPeriod`), then inserts fresh benefits from the review gate.

**Means for your product:** Re-scraping = clean slate. If you re-scrape Chase Sapphire in April, all March/February usage records for that card are permanently deleted. You start with fresh periods and `usedAmount = 0`. The review gate lets you restore any benefit you want to keep — the data is just usage history that is lost, not the benefit definitions themselves.

**Check before approving (asked 2026-04-07, Q1-A):** Builder explicitly chose Option A (replace) over Option B (merge/diff view). Usage history loss was surfaced explicitly. Confirmed acceptable.

**What this closes off:** No "how much did I use in past months" reports for a card that has been re-scraped. Merge-on-rescrape (preserving usage history while updating benefit definitions) is a post-MVP feature requiring a diff algorithm + benefit matching by name.

---

## FB6 — Prisma 7 Datasource Configuration Split

**Date:** 2026-04-07
**Architecture section:** `docs/architecture.md` → Directory Structure

**Decided:** Prisma 7.3.0 requires the database connection URL to live in `prisma.config.ts`, not in `prisma/schema.prisma`. The schema file contains models only.

**Means for your product:** Nothing changes about how the app works. Internally, there are now two Prisma config files instead of one: `prisma/schema.prisma` (what your data looks like) and `prisma.config.ts` (where the database lives). When you run migrations or generate the client, Prisma reads both.

**Check before approving:** If you ever upgrade Prisma beyond 7.x, check whether this split is still required. The pattern may stabilize or change again.

**What this closes off:** Going back to the single-file Prisma config pattern from v6 — it is a hard breaking change in v7 and will not be reversed.

---

## FB8 — Plaintext Admin Password (bcrypt Dropped)

**Date:** 2026-04-09
**Architecture section:** `docs/architecture.md` → Security Architecture, Infrastructure + Deployment

**Decided:** The admin password is stored as plaintext in `.env` (`ADMIN_PASSWORD`). bcrypt (`bcryptjs`) was removed. Auth comparison is a direct string equality check in `src/lib/auth.ts`.

**Means for your product:** No change to how login feels. You type your password, it works. Internally, there's no hashing — the value in `.env` is compared directly to what you typed. The `.env` file is gitignored and lives only on your local machine.

**Check before approving:** The root cause was Next.js's `dotenv-expand` package, which processes `.env` at startup. bcrypt hashes contain `$` characters (e.g., `$2a$10$...`), which dotenv-expand treats as variable references and mangles. Attempts to escape (double quotes, single quotes, `$$`) all failed in Next.js 16. Plaintext is the correct solution for a local-only single-user app where the `.env` file and the SQLite DB are on the same filesystem — if an attacker has read access to `.env`, they already own the machine.

**What this closes off:** bcrypt hash-based credential storage. If this app ever becomes multi-user or shared, this decision must be revisited before other users are added.

---

## FB9 — Find-or-Create Card Row Pattern (No Seed Script)

**Date:** 2026-04-09
**Architecture section:** `docs/architecture.md` → API Routes (UserCards)

**Decided:** When a user adds a catalog card via `POST /api/user-cards`, the route uses `findFirst({ issuer, name })` to locate an existing `Card` row, then creates one if missing. No seed script populates the `Card` table in advance.

**Means for your product:** The first time you add any card, a `Card` row is created on demand. If you add the same card again (e.g., you deleted it and re-add), the existing `Card` row is reused — no duplicate card definitions. The catalog JSON is still the source of truth for issuer/name/color; the DB row is created from it at add-time.

**Check before approving:** The original task spec assumed "Card rows already seeded" but no seed script was ever written. Find-or-create achieves the same result without a migration. If a seed script is ever added later, the find-or-create becomes a no-op (finds existing, skips create) — no conflict.

**What this closes off:** Nothing significant. If the catalog JSON changes (e.g., a card is renamed), existing `Card` DB rows won't auto-update — they'd need a manual migration or delete + re-add.

---

## FB10 — Client Data Fetching Lives in src/hooks/

**Date:** 2026-04-13
**Architecture section:** `docs/architecture.md` → Directory Structure

**Decided:** Each client-rendered page space has its own data-fetching hook in `src/hooks/`, named `use-[space]-data.ts`. The hook owns: fetching, loading/error state, and optimistic mutations with revert. Pages import the hook and handle UI state only.

**Means for your product:** Pages stay thin (< 200 lines). The fetch + retry + optimistic update logic is tested independently from the UI. When you add a new space (e.g., Overview), create `use-overview-data.ts` — don't put fetch logic directly in the page component.

**Check before approving:** Cards page uses this pattern. Overview and Admin pages should follow it. If you ever want to share data between spaces (e.g., expiring alerts on both Cards and Overview), the hook is the right place to add cross-space caching — not a global store (yet).

**What this closes off:** Inline `useEffect` + `fetch` directly in page components. Any data fetching added to a page component going forward would be a deviation from this pattern.

---

## FB7 — Playwright as npm Dependency (Local Chromium Required)

**Date:** 2026-04-08
**Architecture section:** `docs/architecture.md` → Tech Stack (Scraping)

**Decided:** `playwright` npm package added as a production dependency. Chromium must be installed separately via `npx playwright install chromium` on the host machine before the scraper works at runtime.

**Means for your product:** The scraper will silently fail at runtime until Chromium is installed (~150MB download, one-time). This is a setup step — not something users see, but something you (the owner) must run on the machine hosting the app. The npm install alone is not sufficient.

**Check before approving:** Have you run `npx playwright install chromium` on your local machine? If not, the scrape button will throw an error the first time it's used.

**What this closes off:** Nothing — Playwright was always the plan (A3 validated). This is the expected implementation path.

---

## FB8 — Benefits GET Route Moved Under User-Cards

**Date:** 2026-04-13
**Architecture section:** `docs/architecture.md` → Directory Structure, API Routes Summary

**Decided:** `GET /api/benefits/[userCardId]` moved to `GET /api/user-cards/[id]/benefits`. The old route created a Next.js dynamic slug conflict (`[id]` vs `[userCardId]` as siblings under `api/benefits/`) that prevented the app from starting.

**Means for your product:** No user-facing change. The same data is returned from a different URL. The fix was required — without it, the app could not start at all. Tests passed before the fix because they call route handlers directly as functions, bypassing Next.js routing.

**Check before approving:** Already verified — `npm run dev` starts cleanly, all 114 tests pass, all browser flows work.

**What this closes off:** Nothing — this is a routing fix. The API contract is identical, just at a more RESTful path.

---

## FB8 — Value Unit: Dollars vs Points

**Date:** 2026-04-14
**Architecture section:** `docs/architecture.md` → Data Model (Benefit), Claude Haiku Parser

**Decided:** Added a `valueUnit` field to the Benefit model — either `"dollars"` or `"points"`. The LLM parser now classifies each benefit's value, and the review gate shows a dropdown to correct it. Display renders `$300` for dollars and `75,000 pts` for points.

**Means for your product:** You can now see at a glance which benefits are actual dollar credits (use-it-or-lose-it money) vs loyalty points (nice-to-have but not urgent). This directly affects which benefits the Overview should prioritize showing as "expiring soon."

**Check before approving:** Already applied — DB migration ran, parser updated, review gate shows the dropdown, benefit display formats correctly.

**What this closes off:** Nothing — additive change. Default is `"dollars"` so all existing benefits continue working unchanged.
