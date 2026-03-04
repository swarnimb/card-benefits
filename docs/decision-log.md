# Decision Log

| Date | Decision | Options Considered | Choice | Rationale |
|------|----------|-------------------|--------|-----------|
| 2026-02-07 | Framework | Next.js, Remix, Vite+React | Next.js (App Router) | Massive community, portfolio signal, handles UI + API in one project, server components for data fetching |
| 2026-02-07 | UI Library | shadcn/ui, Material UI, Chakra UI | shadcn/ui + Tailwind CSS | Beautiful defaults, composable, no runtime overhead, modern portfolio aesthetic |
| 2026-02-07 | Database | SQLite, Postgres, MongoDB | SQLite via Prisma | Zero setup for local app, Prisma ORM makes Postgres migration a config change later |
| 2026-02-07 | LLM for parsing | Claude, GPT-4, local model | Claude API (Haiku) | Already in ecosystem, Haiku is cheap/fast, ideal for structured extraction |
| 2026-02-07 | CSV parsing | Papa Parse, csv-parse, d3-dsv | Papa Parse | Battle-tested, handles edge cases, well-documented |
| 2026-02-07 | Import strategy | Relative, absolute | Absolute via `@/` alias | Standard Next.js convention, cleaner than relative paths |
| 2026-02-07 | State management | Redux, Zustand, React Server Components | Server Components + client fetch | No global state needed — data is DB-driven, fetched per page |
| 2026-02-07 | Card data source | Runtime scraping, seeded JSON, manual DB entry | Seeded JSON files | Reliable for MVP, decouples data curation from app runtime, scraping is future pipeline |
| 2026-02-07 | CSV processing location | Client-side, server-side | Server (API routes) | File handling + LLM calls belong server-side, keeps client thin |
| 2026-02-07 | AI usage | User-facing chatbot, pipeline-only | Pipeline-only (parsing + categorization) | AI earns its place in the data pipeline, not as a gimmick |
| 2026-02-07 | Points tracking | CSV import only, manual only, hybrid | Hybrid: user-entered baseline + transaction-estimated future | Most accurate approach — user provides ground truth, app maintains running estimate |
| 2026-02-07 | Benefits architecture | Coupled to dashboard, separable | Separable — DB is an independent asset | Card benefits database has standalone value, enables future platform potential |
| 2026-02-09 | Prisma SQLite driver | Bare PrismaClient, driver adapter | `@prisma/adapter-better-sqlite3` | Prisma v7 requires driver adapters — can't instantiate PrismaClient without one. `better-sqlite3` is the standard SQLite adapter. |
| 2026-02-09 | Third seed card | Capital One Venture ($95), Venture X ($395) | Capital One Venture X | Venture X has trackable benefits ($300 travel credit, lounge access) that better showcase the app. Regular Venture is just 2X on everything. |
| 2026-02-09 | Amex Resy credit modeling | Semi-annual $50, annual $100 | $100 annual | Schema doesn't support semi-annual periods. Acceptable simplification for MVP. |
| 2026-02-09 | Prisma v7 seed config | package.json prisma.seed, prisma.config.ts migrations.seed | prisma.config.ts migrations.seed | Prisma v7 moved seed config from package.json to prisma.config.ts. |
| 2026-02-10 | Wells Fargo CSV format | Headerless format, headered format | Headered (assumed) | Wells Fargo sometimes exports headerless CSVs (just Date,Amount,*,*,Description with no header row). Current format assumes headers present. If real CSVs are headerless, Task 8 auto-detection will need a positional fallback path. Revisit when testing with real exports. |
| 2026-02-10 | Category normalization | LLM only, bank-category map only, hybrid | Hybrid (LLM + fallback map) | Confirm endpoint tries Claude Haiku first if ANTHROPIC_API_KEY is set. Falls back to a static bank-category → benefit-category map (e.g. "Food & Drink"→"dining"). Ensures app works without API key while still supporting smarter categorization when available. |
| 2026-02-16 | Swipe library | embla-carousel, swiper | embla-carousel | Lightweight (~3KB), headless (full style control), cleaner API. Swiper is 40KB+ and more opinionated than needed. |
| 2026-02-16 | Utilization bar | shadcn Progress, custom component | Custom component | Needed color-coded thresholds (green→yellow→red) and animated fill. shadcn Progress is single-color and harder to customize. |
| 2026-02-16 | Settings page structure | Separate pages for card mgmt + data mgmt, single page | Single page with sections | Tasks 30 & 31 both target settings/page.tsx. One page with clear section headers is simpler and avoids extra routing. |
| 2026-02-16 | Merchant-specific credits tracking | Keep trackable, make display_only | display_only | Merchant-specific credits (DoorDash, Uber Cash, Dunkin') can't be accurately tracked via category matching — a $50 restaurant charge would count toward a $10 DoorDash credit. Future: add merchant-level matching to engine. |
