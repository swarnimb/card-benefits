# CardMaxxer

Personal dashboard that scrapes and tracks credit card benefits across all your cards — so you never miss a reset or leave money on the table. Built as a local-first Next.js app for desktop use; Vercel deployment is planned for Phase 2.

## Live Demo

Try it at [swarnimb.github.io/card-benefits](https://swarnimb.github.io/card-benefits/) — a read-only demo with fictional card data. Real usage (scraping, editing, your own cards) runs locally; see Setup below.

## Setup

```bash
cp .env.example .env
# Fill in real values in .env (see Environment Variables below)

npm install
npx prisma generate
npx prisma db push
npx playwright install chromium

npm run dev
```

The app runs at `http://localhost:3002` by default.

## Environment Variables

See `.env.example` for all required variables:

- `DATABASE_URL` — SQLite file path
- `ANTHROPIC_API_KEY` — Claude API key (Haiku model, used for benefit parsing)
- `NEXTAUTH_SECRET` — Random string for JWT signing
- `NEXTAUTH_URL` — Base URL (`http://localhost:3002` for local MVP)
- `ADMIN_EMAIL` — Login email
- `ADMIN_PASSWORD` — Login password (plaintext, local-only app)
- `ADMIN_USER_ID` — User identifier for DB scoping

## Tests

```bash
npm test                  # unit tests
npm run test:integration  # integration tests (requires DB)
```

## Mobile / Remote Access

Mobile and remote access are deferred to Phase 2 — see `docs/assumptions.md` A9. The MVP is desktop-only; Vercel migration is the planned path for cloud access (requires Postgres migration and external scraping — tracked separately).
