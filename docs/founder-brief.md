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

---

## FB11 — Tailscale Dropped, Vercel Queued for Phase 2

**Date:** 2026-05-13
**Architecture section:** `docs/architecture.md` → Tech Stack, Infrastructure + Deployment

**Decided:** The Tailscale-for-mobile-access plan (originally validated as assumption A5) is removed from MVP scope. MVP runs desktop-only on the local machine. Vercel deployment is queued as Phase 2 work, documented in assumption A9.

**Means for your product:** CardMaxxer is laptop-only until Phase 2. You can't use it on your phone at point-of-purchase or while reviewing statements in bed — those use cases wait for Vercel migration. The mobile-first 375px design work isn't wasted: the layout stays intact and becomes useful when Phase 2 ships. Rationale: validate product fit through personal daily use before paying the cost of cloud migration.

**Check before approving Phase 2 (later — not now):** Three non-trivial blockers exist for Vercel migration. (1) SQLite local file must migrate to Postgres — Neon free tier is the target. (2) Playwright + Chromium exceeds Vercel's 250 MB function size and 60-second timeout — needs either a hybrid split (frontend on Vercel + local scraper writes to Postgres) or browser-as-a-service like Browserless (~$10/mo). (3) GET routes with write side-effects (CONSTRAINT-3, lazy period calc) cause race conditions under Vercel's serverless concurrency — needs event-driven period closure or a Vercel Cron job. The current "no Browserless / no Lambda" project convention also requires explicit revision at Phase 2 kickoff.

**What this closes off:** Real-device mobile validation of A7 (Framer Motion scroll-snap interaction) for MVP. If local + desktop deployment proves sufficient and product fit doesn't manifest, the Vercel migration may never happen — desktop-only is a viable permanent state, not a stepping stone.

---

## FB12 — Benefit Classification: Track Only What You Could Actually Miss

**Date:** 2026-05-15
**Architecture section:** `docs/architecture.md` → Data Model (Benefit Classification & Tracking), `docs/prd.md` Feature 3.5, assumptions A10

**Decided:** CardMaxxer no longer tracks every benefit it scrapes. Every scraped benefit is sorted into one of five buckets. By default, only two of those buckets are actually tracked: "use-it-or-lose-it credits" (like a $100 spa credit that vanishes if unused) and "things you have to switch on" (like a free DashPass you must activate). The other three — auto-applied earn rates (cash back, points that just happen), always-on perks (lounge access, travel insurance), and one-time signup bonuses — are not tracked.

**Means for your product:** The Overview and "expiring soon" views stay focused on the money you can actually lose by forgetting. You won't see your dashboard cluttered with "you earn 3x points on dining" — that earns itself whether you pay attention or not. The benefits worth chasing don't get buried under the ones that take care of themselves.

Excluded benefits are **not deleted** — they're saved and just hidden. That's a deliberate choice: it keeps the door open to a future "show me everything and let me decide" feature without having to re-scrape every card again. Nothing is thrown away, only filtered from the default view.

The split of responsibility matters: the AI only assigns the bucket (a judgment call — "is this a use-it-or-lose-it credit or an always-on perk?" — which it's genuinely good at). Plain, predictable code then decides tracked yes/no from that bucket. That means if we ever want to change the policy (say, start tracking signup bonuses too), we change a small rule in code — we don't have to re-run or re-prompt the AI over your whole card library.

**Why:** the entire point of this product is catching money you'd otherwise leave on the table. Tracking auto-applied rewards is noise — it buries the credits that actually get missed under a pile of benefits that need no attention. A tracker that flags everything flags nothing.

**Check before approving (the risk we accepted — A10):** The real risk is the AI mis-sorting a genuine use-it-or-lose-it credit into a hidden bucket — and because it's hidden, you'd never know you were losing that money. We accepted this risk with two mitigations. First, the mandatory review screen you see before anything is saved always shows the hidden items collapsed ("N excluded — expand") — they're never invisible, just folded away, so you can always check. Second, anything the AI is unsure about defaults to TRACKED, not hidden. So the dangerous direction — silently hiding real money — is always recoverable, while the harmless direction — showing one extra low-value item — is the only thing that slips through by default.

**What this closes off:** Nothing is permanently closed — excluded benefits are retained, so a future "view all / manually re-include" capability is fully open. What it does set is a default posture: the product opts you out of noise and makes you opt back in, rather than the reverse.

---

## FB13 — Overview Reorganized Around Urgency, Not Benefit Type

**Date:** 2026-05-16
**Architecture section:** `docs/architecture.md` → Overview space (route, components, `engine/expiring.ts`, `types/api.ts`), `docs/prd.md` Feature 6 (Overview Space)

**Decided:** The Overview screen no longer groups benefits by category ("Dining: $75", "Travel: $200"). It now answers one question on open: *what am I about to lose, and what should I do today?* A money-at-risk headline shows the total unredeemed value that resets soon, then three sections by urgency: **Needs attention** (expiring soon, amber, most-urgent first), **On track** (active, not urgent), and **Done** (used up / nothing to do — collapsed). Benefit type and category are now just small labels on each row, not the organizing principle. The old category-aggregation code and its components were deleted, not kept side-by-side.

**Means for your product:** Opening the app now leads with the dollar figure you're at risk of losing and a deadline, instead of a neutral category breakdown that didn't tell you to act. One real behavior change: subscriptions and access perks (DashPass, lounge credits) now appear on Overview too — previously Overview only showed credits/perks. The Cards tab is unchanged and still organizes by type; Overview is triage, Cards is inventory. That difference is intentional.

**Why:** the previous Overview was skeleton-level — it listed totals but never said "act on this now." Urgency is the only axis that drives the daily behavior this product exists to create.

**Check before approving:** Already applied — Tasks 36–38 shipped, all 38 plan tasks complete. The deferred visual check (does the most urgent action show without scrolling at 375px?) is queued for the `@qa` milestone sign-off.

**What this closes off:** The category-rollup view ("how much dining credit across all cards?") is gone from Overview — it would need rebuilding if wanted later. The old `aggregateOverview` path and `categories`/`expiringSoon` API shape were removed outright (single forward contract, no dual-maintenance), so anything depending on that old shape would need the triage shape instead.

---

## FB14 — Generic Scraper, Not Per-Bank Adapters

**Date:** 2026-05-19
**Architecture section:** `docs/architecture.md` → Scraper Architecture, `docs/plan.md` Task 39

**Decided:** The scraper is one generic pipeline that works for any credit-card marketing URL — not five per-bank scrapers. It tries a fast plain-HTTP fetch first; if that doesn't return enough usable text (the page was a JavaScript shell), it falls back to a real browser, scrolls the page to trigger lazy content, clicks "show more" / "see details" / expandable sections, and only then extracts the article text using Mozilla's Readability library (the same engine behind Firefox's Reader View). The five per-bank scraper files (Amex, Chase, Capital One, Citi, Discover) that previously existed were empty pass-throughs to the generic code — they were deleted as misleading dead code. The dispatcher that used to look up "which scraper for which bank?" is kept, but its lookup map is empty by design — a hook to add bank-specific code later only if a specific bank actually needs it.

**Means for your product:** Adding a new card from a new issuer "just works" — there's no longer a phantom requirement to write a Discover scraper or a Citi scraper before that bank's cards can be scraped. The fast path makes most cards scrape in under two seconds instead of forty. The slow path (Playwright) is reserved for pages that genuinely need a browser, and even there it now actively expands hidden benefit sections instead of grabbing only what was visible on first paint. Failed scrapes still surface as "scrape error → review gate → manual entry" exactly as before; the failure contract is preserved.

**Why:** We had five files pretending to be issuer-specific scrapers, all forwarding to the same generic function. That's not abstraction — it's a lie about complexity. A generic pipeline that's actually good is more honest and more useful than five files that all do the same wrong thing. The empty extension-point map lets us add real per-bank handling the day we find a bank the generic pipeline can't handle — but until that day, it stays empty.

**Check before approving:** Two specific risks are accepted. (1) Amex's bot detection may still defeat the generic pipeline — same risk as before, same mitigation (manual entry via review gate, assumption A3). (2) PDF benefit summaries remain out of scope — if an issuer hides benefits behind a PDF link, the user adds manually. Neither risk is new; both were already documented.

**What this closes off:** The "five issuer files, one per bank" code shape is permanently gone. If a future bank needs special handling, the new shape is "add one entry to the empty `ISSUER_SCRAPERS` map" — a much smaller surface than recreating per-issuer files. The PDF-extraction path remains explicitly out of scope.

---

## FB15 — Set-and-Forget Benefits: Activation Lives on the Benefit, Not the Period

**Date:** 2026-05-21
**Architecture section:** `docs/architecture.md` → Data Model → Set-and-Forget Benefits (Feature 8); `docs/prd.md` Feature 8

**Decided:** Some credit-card benefits — Walmart+, Uber One, CLEAR, Oura, streaming credits — only need to be set up once; after that the credit arrives automatically every period with no action from you. CardMaxxer will now treat these differently from credits you must actively spend (airline fee credit, hotel credit, dining). Each such benefit gets two new pieces of data: a flag marking it "set-and-forget," and an "activated" state. Crucially, that activated state is stored on the benefit itself — not on the per-month/per-quarter usage record — so it never resets. Tap it active once, it stays active.

**Means for your product:** You stop being nagged ~11 months a year to "use" benefits that need nothing from you. Set-and-forget benefits move into a calm "Automatic" group; once activated they sit quietly and still count toward your secured value. Only benefits that genuinely need a recurring decision stay in the "needs attention" list — the app stops crying wolf.

**Why:** The tracking model was built on one clock — the benefit's reset period — and assumed "reset" means "the user must act again." For set-and-forget benefits that is false: the credit resets monthly but your action was one-time. Storing activation per-period guaranteed it would wrongly reset every month. The fix is to store activation one level up, on the benefit itself, where one-time state belongs.

**Check before approving:** Two accepted trade-offs. (1) After you re-scrape a card, its set-and-forget benefits revert to "not set up" and you re-tap them once — re-scrapes are quarterly-ish, and preserving activation across a re-scrape would break the existing "re-scrape replaces everything" rule (CONSTRAINT-06). (2) Set-and-forget benefits keep no month-by-month history — there is nothing to track per month.

**What this closes off:** The deferred v2 additions — a proactive "you're missing $209/yr" nudge and a "not interested" dismiss state — stay easy to add later. But per-period audit history for set-and-forget benefits is deliberately not modeled; a future feature wanting "show me each month Walmart+ posted" would have to add it back.
