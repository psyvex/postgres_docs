# Roadmap

## Now (before 5 Oct 2026)
- [x] Five security-track lessons with runnable examples and animations
- [x] Browser (PGlite / PG 18) + live local Postgres modes
- [x] Playground: Monaco, schema autocomplete, table browser with "view as" personas
- [x] Claude assistant: explain, fix, ask, ghost-text completion
- [ ] Rehearse with `docs/SESSION-PLAN.md`; fix anything awkward on the projector

## Next
- Presenter mode: step-by-step reveal and keyboard navigation per lesson
- Self-hosted Monaco (currently loaded from the jsDelivr CDN) for fully offline use
- Quizzes for "Check yourself" with saved progress
- E2E tests (Playwright) for animations and persona runs
- `verify:lessons` against a live Postgres (Docker) in CI

## Later: more topics
Indexes & EXPLAIN · Transactions & MVCC · JSONB · Partitioning · Backups & Replication · Full-text search · Extensions (pgvector, PostGIS) · Connection pooling
