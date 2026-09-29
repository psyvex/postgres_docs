# Changelog

## 2026-09-29: More AI (research repo patterns)

- Lesson translation into 21 languages (research repo's curated list): streams, keeps JSX/SQL verbatim, compiles MDX in the browser so interactive examples still work; cached per lesson hash; RTL for Urdu/Arabic.
- Lesson assistant: floating "Ask this lesson" panel grounded in the lesson source; selection toolbar with Explain simpler / Translate / Ask.
- Voice input on every AI box: Whisper-compatible `/api/ai/transcribe` (`TRANSCRIPTION_*` env) with Web Speech API fallback.
- Playground: "Describe what you want" → SQL (undoable edit) and a Security **Review** button.
- AI route: new tasks `write`, `review`, `simplify`, `translateText`, `translate`; strips leading blank lines from gateway models; reports truncation.

## 2026-09-29: AI gateway support

- `src/lib/ai/server.ts`: env contract from the research repo: `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_SCHEME=bearer`, `CLAUDE_MODEL` (e.g. `coder`), `CLAUDE_FAST_MODEL`, `AI_MAX_CONCURRENCY`.
- Anthropic-only extras (betas, fallbacks, effort, cache_control) are sent only to native `claude-*` models; gateway aliases get a plain request. Verified against a mock gateway.

## 2026-09-29: Home page

- New animated sections (`src/components/home/sections/`): keyword marquee, lessons grid with staggered reveal, How it works (Read → Run → Break with a replaying RLS terminal), Two databases (interactive Browser/Live diagrams), AI assistant chat demo, roadmap, gradient final CTA.
- Hero: floating notebook sketches (`HeroSketches`) that avoid content; curved comet link for the spotlighted topic; outer ring of planned topics orbits.
- Header nav moved to the right.

## 2026-09-29: Brand

- Hero refresh inspired by the portfolio repo: full-bleed line grids (drift + cursor parallax), scan line, film grain, two-tone oversized headline, eyebrow, handwritten note (Caveat), glow CTA, count-up stats computed from content at build time (`HeroIntro`).
- Dark mode: white plate behind the brand mark so the navy half stays visible.

- Home hero redesigned as a topic "universe" (`HeroUniverse`): mark as the core, ready topics orbit it (from the registry), planned topics as outer moons; a spotlight tours topics, sends query packets and types each topic's signature SQL.

- Lab mark **"Draw & Fill"** (Webelight symbol + PostgreSQL elephant badge) (`src/components/brand/BrandMark.tsx`): `static` / `once` / `loop` modes plus `BrandLoader`.
- Used in the header (draws on load, replays on hover), route `loading.tsx`, database/editor/catalog/table loaders, and the favicon (`src/app/icon.svg`, final frame).
- First-load splash (`SplashScreen`): full Draw & Fill intro while PGlite boots (min 2 s, max 7 s), once per browser session; hidden before paint on reloads.
- Loop mode keeps a faint ghost of the mark and a steady badge, so short loaders are never blank.
- `/brand` gallery keeps all 10 explored concepts for reference (`src/components/brand/LogoConcepts.tsx`).

## 2026-09-29: Icons

- Replaced every emoji with icons: `src/components/icons` maps semantic names to react-icons (Phosphor duotone + Simple Icons Postgres logo). Custom SVGs cover the gaps: `BurstIcon`, `TenantHopIcon`, and the `ElephantBouncer` mascot (awake / asleep).
- `PersonaSelect` dropdown replaces native `<select>` so personas show icons.
- MDX: `<Icon name="…" />`, `<Yes>` / `<No>` table markers; tickable go-live checklist.
- Fix: MDX tables and task lists weren't rendering; enabled `remark-gfm` + `rehype-slug` (heading IDs).

## 2026-09-29: Rebuild

- Replaced the prototype (moved to `_legacy/`) with a content-driven architecture: topic registry + MDX lessons.
- Real PostgreSQL everywhere: PGlite (PG 18.3, IndexedDB) in the browser, or a local server through `/api/db/query`, which is restricted to localhost.
- Lessons: Row-Level Security, Roles & Privileges, Functions & Procedures, Triggers & Automation, Security in Production, each with official references.
- Animations: RLS bouncer, live privilege grid (real GRANT/REVOKE), function badge machine, trigger pipeline, SQL-injection demo (real queries), security heist.
- Playground: Monaco editor, schema-aware completion, explorer, table browser with personas, snippets, AI panel.
- Claude integration (`claude-opus-5-5`): streaming explain / fix / ask / inline completion using live schema context.
- Full-width layouts, light/dark theme, thin themed scrollbars.
- `pnpm verify:lessons` content test.
