# Constraints: CardMaxxer

> Per-project file. Seeded by `@plan` — 2026-04-07.
> Updated whenever a new binding decision is made during development.
> Loaded by `@session-start` every session.
>
> **What belongs here:** Active binding decisions only. Not rationale. Not options considered. Just what is locked and what it means in practice.
>
> **Distinct from `docs/assumptions.md`:** Assumptions are things validated before planning. Constraints are decisions already made that close off future options.

---

## Active Constraints

---

### [CONSTRAINT-01] SQLite — no cloud database

**Decision:** The database is SQLite, stored as a local file at `prisma/dev.db`. No PostgreSQL. No cloud-hosted DB.

**What it means in practice:** No Prisma `enum` types (use `String` fields). No native array types (use JSON strings if needed). All queries run against a local file — no network latency. DB is not accessible from other machines. Data lives on the machine running `next start`.

**Who decided and when:** @cto (via @plan), 2026-04-07

**What this closes off:** Sharing data across multiple machines without manual DB file transfer. Cloud backup requires an external script. PostgreSQL features (full-text search, array columns, JSON operators) not available.

---

### [CONSTRAINT-02] Playwright scraping runs synchronously in API route

**Decision:** Playwright scrapes run inline in the Next.js API route handler (no job queue, no background worker).

**What it means in practice:** Scrape requests block until Playwright finishes (~15-30s). The client must show a loading state. Do not add scrape logic outside of `lib/scraper/` or the `/api/user-cards/[id]/scrape` route. No Redis, no BullMQ, no separate process.

**Who decided and when:** @cto (via @plan), 2026-04-07

**What this closes off:** Concurrent multi-card scraping (each scrape would need a separate Playwright instance + parallel requests). Scraping while closing the browser tab will abort the request. Post-MVP: can be replaced with a job queue if concurrent scraping is needed.

---

### [CONSTRAINT-03] Period calculation is lazy (read-time, no cron)

**Decision:** `ensureCurrentPeriod()` is called on every read of benefit data (GET `/api/benefits/[userCardId]` and GET `/api/overview`). Periods are closed and new ones created at that point.

**What it means in practice:** GET routes have write side-effects. Do not try to make these routes purely read-only. Do not add a cron job for period advancement. Periods only advance when the app is opened.

**Who decided and when:** @cto (via @plan), 2026-04-07

**What this closes off:** Background period snapshots (automated monthly summaries). Periods do not advance if the app is not opened after a reset. Acceptable for a weekly-use personal tool.

---

### [CONSTRAINT-04] Card catalog is static JSON, not a DB table

**Decision:** `data/card-catalog.json` is the source of truth for known cards (issuer, name, scrapeUrl, defaultColor). It is a code artifact, not user data.

**What it means in practice:** To add a new card to the catalog, edit `data/card-catalog.json` and restart the server. Do not create a DB table for the catalog. The catalog is read at runtime via `fs.readFileSync` or a static import.

**Who decided and when:** @cto (via @plan), 2026-04-07

**What this closes off:** Adding/editing catalog cards from the Admin UI. All catalog management is done by editing the JSON file.

---

### [CONSTRAINT-05] JWT sessions — no auth DB tables

**Decision:** NextAuth uses `strategy: "jwt"`. No DB adapter. No `User`, `Session`, `Account`, or `VerificationToken` tables in the Prisma schema.

**What it means in practice:** `userId` in `UserCard` is a string from the JWT `sub` claim (`ADMIN_USER_ID` env var). Do not add a `User` model to the schema without also migrating `UserCard.userId` to a foreign key.

**Who decided and when:** @cto (via @plan), 2026-04-07

**What this closes off:** Session revocation (requires `NEXTAUTH_SECRET` rotation). Per-user settings. Multi-user support without a real schema migration.

---

### [CONSTRAINT-06] Re-scrape replaces all benefits (no merge)

**Decision:** POST `/api/benefits/confirm` deletes ALL existing `Benefit` records for a `userCardId` and replaces them with the confirmed list. This applies to both initial setup and re-scrapes.

**What it means in practice:** Re-scraping a card deletes all its `BenefitPeriod` records (usage history). Usage starts fresh after every re-scrape. Do not add a "merge" or "diff" code path in `confirm/route.ts`.

**Who decided and when:** Builder (Q1-A), 2026-04-07

**What this closes off:** Usage history preservation across re-scrapes. "How much did I use in past months?" is not answerable for a card that has been re-scraped. Post-MVP feature if needed.

---

### [CONSTRAINT-07] `updateBenefitUsage()` is the only write path for `usedAmount`

**Decision:** All writes to `BenefitPeriod.usedAmount` must go through `lib/engine/usage.ts → updateBenefitUsage()`. No direct Prisma writes to `usedAmount` elsewhere.

**What it means in practice:** Route handlers call `updateBenefitUsage(benefitId, newAmount)`. They do not call `prisma.benefitPeriod.update({ usedAmount })` directly. If you need to update usage anywhere, import and call `updateBenefitUsage`.

**Who decided and when:** @data (via @plan), 2026-04-07

**What this closes off:** Nothing — this is an enforced single-responsibility pattern. Bypassing it is the anti-pattern.

---

### [CONSTRAINT-08] `BenefitPeriod` records are append-only after closing

**Decision:** A `BenefitPeriod` with `status: 'closed'` is never mutated. New periods are always inserted as new records. The only allowed state change is `'open' → 'closed'` (a one-time transition).

**What it means in practice:** Do not UPDATE any field on a `BenefitPeriod` where `status = 'closed'`. If you need to correct a closed period, create a new one instead.

**Who decided and when:** @data (via @plan), 2026-04-07

**What this closes off:** In-place period correction. Historical records are immutable once closed.

---

### [CONSTRAINT-09] Claude Haiku only — model not substitutable

**Decision:** The parser uses `claude-haiku-4-5-20251001` hardcoded in `lib/parser/index.ts`. No other model.

**What it means in practice:** Do not parameterize the model string. Do not swap to Sonnet or Opus for "better parsing" — Haiku is validated and cost-calibrated ($0.007/parse). Tool_use only — no freeform JSON parsing fallback.

**Who decided and when:** @llm-parser (via @plan), 2026-04-07

**What this closes off:** Easy model upgrades. Any model change requires updating the constraint, the parser, and re-validating cost.

---

### [CONSTRAINT-10] Benefit review gate is mandatory — no auto-save path

**Decision:** No benefit is ever saved to the DB without going through the review gate (POST `/api/benefits/confirm`). There is no code path that saves benefits without user confirmation.

**What it means in practice:** The scrape route (`/api/user-cards/[id]/scrape`) never writes to the DB — it always returns a draft. The confirm route is always a user-triggered action. Do not add any auto-save shortcuts.

**Who decided and when:** @plan (product requirement), 2026-04-07

**What this closes off:** Automatic benefit refresh without user review. Future automation would require a new explicit design decision.

---

### [CONSTRAINT-11] Prisma 7 — datasource URL lives in `prisma.config.ts`, not `schema.prisma`

**Decision:** Prisma 7.3.0 removed support for `url = env("DATABASE_URL")` in the `schema.prisma` datasource block. The connection URL must be in `prisma.config.ts` under `datasource.url`. The schema file contains models only.

**What it means in practice:** Do not add `url` back to the `datasource db {}` block in `schema.prisma` — it will throw a validation error. All migration and generate commands read `prisma.config.ts` automatically. The `PrismaClient` at runtime uses the `@prisma/adapter-better-sqlite3` adapter, which receives the URL from env at instantiation in `src/lib/db.ts`.

**Who decided and when:** @dev (discovered during Task 2), 2026-04-07

**What this closes off:** The single-file Prisma config pattern from Prisma v6. If you downgrade Prisma, this constraint would need to be revisited.

---

### [CONSTRAINT-12] DS-01 relaxed — JSDoc not required for internal library functions

**Decision:** `rules/documentation-standards.md` DS-01 (JSDoc on all public exports) is relaxed for this project. JSDoc is not required on internal library functions in `src/lib/`. TypeScript strict-mode signatures and descriptive names serve as the documentation contract for a single-developer internal tool. JSDoc is only required on API route handlers and functions that cross a public interface boundary.

**What it means in practice:** `@dev` and `@code-review` do not flag missing JSDoc on `src/lib/**` functions. If a function's signature + name don't make the contract obvious, add a JSDoc — but it is not a gate requirement.

**Who decided and when:** Builder (@code-review debrief), 2026-04-08

**What this closes off:** Nothing — this is a scope reduction for a single-developer tool. Reverse this if the codebase is shared with other developers.

---

### [CONSTRAINT-13] CQ-06 exemption — single-letter date variables in pure date math

**Decision:** Single-letter variables `y` (year), `m` (month), `d` (day) are permitted in functions whose sole purpose is date boundary calculation (e.g., `calcCalendarBoundary`, `calcStatementBoundary`). CQ-06 prohibits single-letter names except in loop indices and mathematical formulas — date arithmetic qualifies as the latter.

**What it means in practice:** `y/m/d` in date helper functions are not flagged by `@dev` or `@code-review`. All other abbreviations (multi-character non-standard ones like `qs`, `sm`, `sy`) are still prohibited. The exemption is narrow: only `y/m/d` only in date math helpers.

**Who decided and when:** Builder (@code-review debrief), 2026-04-08

**What this closes off:** Nothing.

---

### [CONSTRAINT-14] Plaintext admin password — bcrypt removed

**Decision:** `ADMIN_PASSWORD` in `.env` is stored as plaintext. `src/lib/auth.ts` compares it directly with `===`. bcryptjs dependency removed.

**What it means in practice:** Do not re-introduce bcrypt. Do not store a hash in `.env`. The env var name is `ADMIN_PASSWORD` (not `ADMIN_PASSWORD_HASH`). If login breaks in the future, the env var to check is `ADMIN_PASSWORD`.

**Who decided and when:** Builder (auth debug session), 2026-04-09

**What this closes off:** bcrypt-based password storage. Root cause: Next.js `dotenv-expand` mangles bcrypt hashes — all `$` characters are treated as variable references and expand to empty strings, truncating the 60-char hash. Plaintext is appropriate for a local-only single-user tool where `.env` and the DB are on the same machine.

---

### [CONSTRAINT-15] UI-layer concat preferred over data-layer denormalization

**Decision:** When a display surface needs to render a composite of two normalized fields (e.g., `issuer` + `name`), do it at the UI/render layer via string concatenation. Do not denormalize by duplicating one field into another (e.g., prepending `issuer` into `name` at the data source).

**What it means in practice:** Catalog and DB fields stay normalized — one piece of identifying data per column. UI surfaces that want a composite render it inline: `${card.issuer} ${card.name}`. If a display bug surfaces ("the title is missing the issuer"), the fix is at the JSX call site, not at the data source. The exception is genuinely inseparable brand strings (e.g., Discover's "it" modifier where the brand product line is "Discover it") — handle those as targeted UX polish on the single catalog entry, not as a blanket "every name gets issuer prepended" rewrite.

**Who decided and when:** Builder (Task 41 — pushback on spec-A which proposed denormalizing the catalog), 2026-05-19

**What this closes off:** Storing the same information in two columns to satisfy a render need. Future "field X should show field Y too" requests get a one-line JSX fix, not a schema or data migration. Future `@create-plan` specs that propose data denormalization for display defects should be challenged against this constraint.

---

### [CONSTRAINT-16] `setBenefitActivation()` is the only write path for `Benefit.activatedAt`

**Decision:** All writes to `Benefit.activatedAt` (the Feature 8 set-and-forget activation state) must go through `lib/engine/usage.ts → setBenefitActivation()`. No direct Prisma writes to `activatedAt` elsewhere. Mirrors CONSTRAINT-07.

**What it means in practice:** Route handlers call `setBenefitActivation(benefitId, activated)`; they never call `prisma.benefit.update({ activatedAt })` directly. `activatedAt` is period-independent state on `Benefit`, distinct from `BenefitPeriod.usedAmount` — CONSTRAINT-07 continues to govern `usedAmount` separately; this is its parallel for activation.

**Who decided and when:** @cto (Feature 8 architecture), 2026-05-21

**What this closes off:** Nothing — an enforced single-responsibility pattern. Bypassing it is the anti-pattern.

---

### [CONSTRAINT-17] Set-and-forget benefits have no `BenefitPeriod` records

**Decision:** A benefit with `setAndForget = true` (Feature 8) is never given `BenefitPeriod` records. Its entire state is `Benefit.activatedAt`. `ensureCurrentPeriod()` and initial period creation must skip set-and-forget benefits.

**What it means in practice:** Set-and-forget benefits have no per-period usage and no period history. Any code that iterates a benefit's periods, or assumes every tracked benefit has a current period, must guard on `setAndForget`. Their Overview value math and activation state read directly from `Benefit` (`value`, `activatedAt`) — never from a period.

**Who decided and when:** @cto (Feature 8 architecture), 2026-05-21

**What this closes off:** Per-period audit history for set-and-forget benefits (e.g. "did the Walmart+ credit post each month"). Intentional — there is nothing to track per period for these benefits. Re-introducing per-period history would require modeling it back.

---

### [CONSTRAINT-18] Realized/secured value is the `done` bucket, not a separate Overview figure

**Decision:** An active set-and-forget benefit's "realized/secured value" (PRD Feature 8) is represented by its membership in the Overview `done` bucket — there is no separate "secured value" headline or figure on the Overview. The only money figure on the Overview is money-at-risk.

**What it means in practice:** `buildOverviewTriage` routes an active set-and-forget benefit (`activatedAt != null`) into `done` with `unusedAmount: 0`; a not-set-up one is calm in `onTrack`. No `OverviewData` field tracks a realized total. The Overview stays calm with a single money number (design-decisions.md). Adding a visible "$X secured automatically" figure is a NEW surface — it requires a new task + a `@designer` pass, not an incidental change.

**Who decided and when:** Builder (Task 53), 2026-06-02

**What this closes off:** Treating "realized value" as a displayed number without design review. Future Overview work must not silently add a second money headline.

---

### [CONSTRAINT-19] Realized-value figures live on Cards/Admin only, not Overview

**Decision:** Aggregate "realized value" figures — Redeemed YTD, Available, and annual-fee totals (PRD Feature 9) — are permitted on the Cards and Admin screens. The Overview hero remains money-at-risk only. This refines, and does not loosen, CONSTRAINT-18.

**What it means in practice:** Cards shows a portfolio stat trio (annual fees / redeemed YTD / available) and per-card redeemed/available; Admin shows a summary strip and an "up to $X/yr tracked" figure in the review gate. The Overview adds no second money headline — CONSTRAINT-18 still governs Overview. All figures are computed from existing usage data, not stored.

**Who decided and when:** Builder (Feature 9 redesign), 2026-06-04

**What this closes off:** Putting a realized/secured-value headline on the Overview. Realized value on Overview remains the `done` bucket only (CONSTRAINT-18).

---

### [CONSTRAINT-20] Toasts permitted for card add/remove only

**Decision:** A toast notification is permitted for card add and card remove confirmations (PRD Feature 9 / design). All other feedback — benefit tracking, usage updates, activation — stays inline-feedback-only with no toast. This refines the design-decisions.md "no toasts" rule for these two actions only.

**What it means in practice:** Adding a card (after the review-gate confirm) and removing a card may fire a toast ("… added · N benefits tracked" / "Removed …"). Benefit usage sliders, tracked toggles, and set-and-forget activation must never use a toast — they confirm visually inline, as before.

**Who decided and when:** Builder (Feature 9 redesign), 2026-06-04

**What this closes off:** Toasts as a general feedback pattern. The inline-feedback principle still governs everything except card add/remove.

---

### [CONSTRAINT-21] Annual fee is scrape-derived, product-level, nullable

**Decision:** `Card.annualFee` is populated by the scrape + Haiku parse pass (PRD Feature 9), not manual entry. It is product-level (on `Card`, shared across users of that card), nullable, and surfaced pre-filled in the review gate for confirmation before save.

**What it means in practice:** The parser extracts a card-level annual fee alongside the benefit list; it appears as a confirmable field in the review gate (auto-fetched, editable, not required) and saves on confirm. If the parse misses it, `annualFee` is null and the UI renders "—" (see assumptions A11). No screen requires the user to type an annual fee.

**Who decided and when:** Builder (Feature 9 redesign), 2026-06-04

**What this closes off:** Manual annual-fee entry, and storing annual fee per-UserCard. Annual fee is a product attribute on `Card`, fetched automatically.

---

### [CONSTRAINT-22] Issuer card color — Feature 9 design tokens are the source of truth

**Decision:** A card's rendered face color comes from `Card.defaultColor`, seeded to the Feature 9 design-token hex per issuer (amex `#C9A961`, chase `#3B5BDB`, capitalone `#B73A3A`, citi `#2E5BC9`, discover `#E0741F`). The design tokens — not the legacy catalog seeds — are the single source of truth. A `defaultColor` that differs from its issuer's token hex is treated as a deliberate user override and wins at render.

**What it means in practice:** `data/card-catalog.json` `defaultColor` seeds equal the token hexes; existing `Card.defaultColor` rows still on the OLD seed are backfilled to the token hex (genuine user overrides preserved). The UI renders `defaultColor` directly at the card face — no separate token lookup. To restyle issuer colors, change the tokens AND the catalog seeds together; do not reintroduce the legacy catalog hexes.

**Who decided and when:** Builder (Feature 9 redesign, `@designer` consult), 2026-06-04

**What this closes off:** Two divergent issuer-color sets (catalog vs tokens). Card color is now token-derived with a user-override escape hatch; a future palette change is a coordinated token + seed + backfill update, not an ad-hoc per-surface choice.

---

### [CONSTRAINT-23] App shell on desktop = centered phone-width column

**Decision:** The `(app)` layout renders content in a centered `max-w-[420px]` column (`min-h-dvh` + hairline side borders); the fixed `BottomNav` is constrained to the same width (`left-1/2 -translate-x-1/2 max-w-[420px]`). The UI is mobile-first (designed at 375px); on a wide window it stays centered rather than stretching full-bleed.

**What it means in practice:** All three screens — and any new screen — live inside this column; do not build full-bleed desktop layouts. Verify UI at 375px AND 1280px (both must read correctly inside the column). The MVP is desktop-only, so this centered column IS the daily view.

**Who decided and when:** Builder (Feature 9), 2026-06-04

**What this closes off:** A separate responsive/multi-column desktop layout. Widening the column or adding desktop-specific breakpoints is a future decision, not an ad-hoc per-screen choice.

---

## Summary Table

| # | Decision | Practical impact | Decided by | Date |
|---|---|---|---|---|
| 01 | SQLite, local only | No Prisma enums, no cloud DB | @cto | 2026-04-07 |
| 02 | Playwright sync in API route | No job queue, 30s blocking requests | @cto | 2026-04-07 |
| 03 | Lazy period calculation | GET routes have write side-effects, no cron | @cto | 2026-04-07 |
| 04 | Catalog is static JSON | Edit JSON file to add cards, not Admin UI | @cto | 2026-04-07 |
| 05 | JWT sessions, no auth tables | No User model, session revocation via secret rotation | @cto | 2026-04-07 |
| 06 | Re-scrape replaces all benefits | Usage history lost on re-scrape | Builder (Q1-A) | 2026-04-07 |
| 07 | updateBenefitUsage() only write path | No direct DB writes to usedAmount | @data | 2026-04-07 |
| 08 | BenefitPeriod append-only | Closed records never mutated | @data | 2026-04-07 |
| 09 | Claude Haiku only, tool_use only | Model hardcoded, no freeform JSON parsing | @llm-parser | 2026-04-07 |
| 10 | Review gate mandatory | No auto-save code path | @plan | 2026-04-07 |
| 11 | Prisma 7 — datasource URL in prisma.config.ts | schema.prisma has models only, no url field | @dev (discovered) | 2026-04-07 |
| 12 | DS-01 relaxed for src/lib/** | JSDoc not required on internal library functions | Builder | 2026-04-08 |
| 13 | CQ-06: y/m/d exempt in date math helpers | Single-letter date vars allowed in pure date boundary functions | Builder | 2026-04-08 |
| 14 | Plaintext admin password | ADMIN_PASSWORD in .env; bcrypt removed (dotenv-expand incompatibility) | Builder | 2026-04-09 |
| 15 | UI-layer concat over data denormalization | Composite displays render at JSX layer; columns stay normalized | Builder (Task 41) | 2026-05-19 |
| 16 | setBenefitActivation() only write path for activatedAt | Feature 8 activation writes route through one function | @cto (Feature 8) | 2026-05-21 |
| 17 | Set-and-forget benefits have no BenefitPeriod records | State is Benefit.activatedAt; no per-period history | @cto (Feature 8) | 2026-05-21 |
| 18 | Realized value = done bucket, not a separate Overview figure | No secured-value headline; a visible figure is a new task + @designer | Builder (Task 53) | 2026-06-02 |
| 19 | Realized-value figures on Cards/Admin only | Redeemed YTD/Available/fees on Cards+Admin; Overview stays money-at-risk | Builder (Feature 9) | 2026-06-04 |
| 20 | Toasts for card add/remove only | Benefit tracking stays inline-feedback-only | Builder (Feature 9) | 2026-06-04 |
| 21 | annualFee scrape-derived, product-level, nullable | On Card, confirmed in review gate, "—" fallback | Builder (Feature 9) | 2026-06-04 |
| 22 | Issuer color = Feature 9 design tokens (defaultColor seeded to token; override wins) | One color source; catalog seeds = tokens; backfill on migration | Builder (Feature 9) | 2026-06-04 |
| 23 | App shell on desktop = centered max-w-[420px] column | Mobile-first design centered on desktop (desktop-only MVP); BottomNav constrained to same width; new UI lives in this column | Builder (Feature 9) | 2026-06-04 |
