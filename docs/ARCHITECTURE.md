# Architecture

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind CSS 4 · MDX · motion · Monaco · PGlite · node-postgres · Anthropic SDK.

```
src/
  app/
    page.tsx                  Home
    learn/[topic]/page.tsx    Lesson layout: sidebar | MDX content | TOC + references + live schema
    playground/               SQL workspace
    api/db/query/route.ts     Live mode: runs SQL on a local Postgres via `pg`
    api/ai/route.ts           Claude: complete / explain / fix / ask (streams text)
  content/
    registry.ts               Topic metadata, status (ready/planned), official references
    load.ts                   slug → MDX import map
    topics/*.mdx              Lessons
  components/
    animations/               One interactive explainer per concept (RlsBouncer, PrivilegeGrid, …)
    sql/                      SqlBlock (runnable snippet), ResultView
    playground/               Explorer, SqlEditor (Monaco), TableBrowser, Playground
    learn/ shell/ docs/ ai/ home/
  lib/
    db/                       Adapter layer (see below), seed, introspection, zustand store
    sql/                      Personas/session context, tiny highlighter
    ai/                       Client helpers for /api/ai
  mdx-components.tsx          Components available in every MDX file
scripts/verify-lessons.mjs    Content test: runs every lesson example on PGlite
```

## Database layer

```
            ┌──────────── DbAdapter.run(sql) ────────────┐
 UI ──runSql──►  localAdapter (PGlite, idb://postgres-lab)  │  same RunResult shape
            │   liveAdapter → POST /api/db/query → pg      │
            └─────────────────────────────────────────────┘
```

- `lib/db/store.ts` holds the mode, the live connection (the password stays in memory only) and a `revision` counter. `runSql()` bumps `revision` so explorers and schema panels refetch.
- Every run is prefixed with `SET search_path = lab, public`. The local adapter runs `RESET ROLE; RESET ALL` afterwards. The live route opens a fresh connection per request, so `SET ROLE` and settings never leak between runs.
- **Personas** (`lib/sql/session.ts`) simulate an app request: `SET app.member_id / app.org_id` and then `SET ROLE app_member`. The number of prefix statements is returned as `skip` so the UI hides their results.
- **Seed** (`lib/db/seed.ts`) is a multi-tenant task tracker in schema `lab` with roles `app_member`, `app_admin` and `app_anon`. It's idempotent and deliberately has no RLS or triggers, so lessons add them step by step.
- **Introspection** (`lib/db/introspect.ts`) is one JSON query per object type (tables incl. columns/policies/triggers, functions, roles) to keep the live HTTP round-trips low.

## Security decisions

- `/api/db/query` executes arbitrary SQL by design, so it **only accepts localhost hosts** unless `ALLOW_REMOTE_DB=true`. TLS verifies certificates when enabled. The lab is meant for local use; don't deploy it publicly with live mode on.
- `/api/ai` only reads `ANTHROPIC_API_KEY` on the server. The key never reaches the browser. Input sizes are capped.

## AI

`/api/ai` streams text for four tasks: complete, explain, fix and ask. Configuration lives in `src/lib/ai/server.ts` (server-only) and follows the same env contract as the research repo:

| Env | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Key or gateway token; empty = AI hidden |
| `ANTHROPIC_BASE_URL` | Optional Anthropic-compatible gateway |
| `ANTHROPIC_AUTH_SCHEME` | `x-api-key` (default) or `bearer` (sends `Authorization: Bearer`, no `x-api-key`) |
| `CLAUDE_MODEL` | Main model, e.g. `coder` on the gateway (default `claude-opus-5-5`) |
| `CLAUDE_FAST_MODEL` | Autocomplete model (defaults to `CLAUDE_MODEL`) |
| `AI_MAX_CONCURRENCY` | Process-wide cap on concurrent calls (default 5) |

| `TRANSCRIPTION_API_KEY` / `_URL` / `_MODEL` | Optional Whisper-compatible speech-to-text for mic buttons (else browser speech recognition) |

### AI features

| Task | Where | Notes |
|---|---|---|
| `complete` | Playground ghost text | fast model, 1k tokens |
| `explain`, `fix`, `review` | SqlBlock, playground toolbar, error panel | `review` = severity-tagged security/correctness audit + improved SQL |
| `write` | Playground "Describe what you want" bar | streams SQL, applied as one undoable editor edit |
| `ask` | Playground panel, lesson assistant | with `lesson`, the lesson MDX is sent as context |
| `simplify`, `translateText` | Lesson text-selection toolbar | selected passage (≤ 8k chars) |
| `translate` | Lesson language picker | whole lesson MDX; JSX and SQL kept verbatim, compiled in the browser with `@mdx-js/mdx` so interactive components keep working; cached in localStorage per lesson content hash |

Voice input (`VoiceButton`) posts audio to `/api/ai/transcribe` when transcription is configured, otherwise uses the Web Speech API. Languages (`src/lib/ai/languages.ts`) mirror the research repo's curated list; Urdu and Arabic render right-to-left with code blocks kept left-to-right.

Native `claude-*` ids get the beta Messages call with refusal fallbacks (`fallbacks: "default"`), `effort` (low for completions, medium otherwise) and a cached system prompt. Gateway aliases such as `coder` get a plain `messages.stream` with only `model`, `max_tokens`, `system` and `messages`, because they may reject Anthropic-only fields (the research repo also marks `coder` as ignoring structured output). The client sends the live schema description as context. Monaco ghost-text completions are opt-in (toggle in the playground) and debounced to 650 ms.

## Styling

Design tokens are CSS variables in `app/globals.css` (light + `.dark`), exposed to Tailwind via `@theme inline` (`bg-surface`, `text-brand`, `text-on-brand`, …). Lesson typography is `.prose-lab`; widgets inside lessons use `.not-prose`. The theme is stored in `localStorage['postgres-lab:theme']` and applied before paint.
