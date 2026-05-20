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
