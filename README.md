# 🐘 Postgres Lab

Interactive PostgreSQL handbook: lessons with runnable examples, playful animations, a SQL playground and an optional Claude assistant. Every example runs on a **real** PostgreSQL, either in the browser (PGlite, PostgreSQL 18 in WASM) or on your local server.

## Quick start

```bash
pnpm install
cp .env.example .env.local     # optional: add ANTHROPIC_API_KEY for AI features
pnpm dev                       # http://localhost:3000
```

- **Browser DB** (default): nothing to install. Data persists in IndexedDB. Reset it from the header menu.
- **Live DB**: header menu → *Live* → enter your local connection → *Load demo schema*. Only `localhost` hosts are allowed unless `ALLOW_REMOTE_DB=true`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build && pnpm start` | Production build |
| `pnpm typecheck` | TypeScript check |
| `pnpm verify:lessons [slug]` | Runs every lesson example against a fresh PGlite and reports unexpected results |

## Docs

- [Architecture](docs/ARCHITECTURE.md): how the pieces fit
- [Content guide](docs/CONTENT-GUIDE.md): add a topic / example / animation
- [Session plan](docs/SESSION-PLAN.md): run sheet for the 5 Oct 2026 session
- [Roadmap](docs/ROADMAP.md) · [Changelog](docs/CHANGELOG.md)

The pre-rebuild prototype lives in `_legacy/` for reference and is excluded from the build.
