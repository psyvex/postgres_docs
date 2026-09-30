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
scripts/verify-lessons.mjs    Content test: runs every lesson example on PGlite. Mirrors the app's
                              `toStatements()` (PGlite reports `affectedRows` cumulatively across a
                              multi-statement exec) so `affected: n` grades the same in CI as in the
                              browser, and recovers an aborted session with `ROLLBACK` before `RESET`,
                              because a block that opens `BEGIN` and then fails poisons every later
                              statement with 25P02
vitest.config.mts             Node test config (must be .mts; stubs `server-only`)
.github/workflows/ci.yml      install → verify:lessons → typecheck → lint → test
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

- `/api/db/query` executes arbitrary SQL by design, so it **only accepts localhost hosts** unless `ALLOW_REMOTE_DB=true`. The check lives in `src/lib/db/guard.ts` (server-only, pure, unit-tested), not in the route. Opening the hatch now *requires* `DB_QUERY_TOKEN`: every request for a non-local host must carry it in the `x-db-token` header, compared as SHA-256 digests with `crypto.timingSafeEqual` — fixed-length digests, so a short guess cannot fail early and the token length is not a side channel. Remote mode with no token configured **fails closed**: the route refuses all remote hosts and names the variable to set. The token guards exactly the door the hatch opens, so localhost keeps working with the hatch open and the operator is never locked out of their own machine. `GET /api/db/query` publishes `{remoteAllowed, tokenRequired, tokenConfigured}`, and the connection form renders a "Server token" field only when the server demands one — like the Postgres password, the token is kept in memory only and never written to `localStorage`. TLS verifies certificates when enabled. The lab is meant for local use; don't deploy it publicly with live mode on.
- `/api/ai` only reads `ANTHROPIC_API_KEY` on the server. The key never reaches the browser. Input sizes are capped, and a per-IP sliding-window quota is charged before the model call (see **AI**).

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
| `AI_MINUTE_BURST` | Per-IP requests allowed in the last minute (default 6) |
| `AI_REQUESTS_PER_HOUR` | Per-IP requests allowed in the last hour (default 60) |
| `AI_TRANSLATE_PER_HOUR` | Per-IP whole-lesson translations allowed in the last hour (default 10) |

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

**Per-visitor quota** (`src/lib/ai/quota.ts`, server-only): `/api/ai` counts **requests** per client IP on a sliding window, so there is no midnight boundary to game — `AI_MINUTE_BURST` (default 6) stops rapid-fire, `AI_REQUESTS_PER_HOUR` (default 60) stops sustained grinding. Counts, not weighted units, because the number has to be legible to the person reading the denial: `x-quota-remaining: 41` means 41 requests left, and no message prints a fraction. Requests are not equal (a whole-lesson `translate` asks for 32k output tokens, an answer 8k), so `translate` is additionally capped by `AI_TRANSLATE_PER_HOUR` (default 10) inside the same windows — the one place the meter is not a single global count. Storage is two 60 one-minute `Float64Array` rings per IP (requests, translations), so a slot is reused exactly when its minute stops counting; keys idle for over 2 h and an LRU over `MAX_KEYS=20000` bound memory. The charge is taken *before* the model call and *after* task/size validation, so a malformed request costs nothing and a flood of provably-failing requests cannot refill an allowance. Denied requests get 429 + `retry-after` (seconds, computed from the real expiry of the oldest request, not a fixed hour) + `x-quota-limit` (`minute` | `hour` | `translate`), and the body carries one sentence the answer card renders; successes carry `x-quota-remaining`, and `GET /api/ai` publishes `{hourly, burstPerMinute, translatePerHour}`.

Voice input (`VoiceButton`) posts audio to `/api/ai/transcribe` when transcription is configured, otherwise uses the Web Speech API. `enumerateDevices()` gates the button (no input device → no button, because that failure has no user fix), a 15 s cap with a visible countdown ends a silent capture, every browser error code maps to a sentence with its remedy, and both capture stops are `try`-wrapped — Chrome throws `InvalidStateError` from `SpeechRecognition.stop()` when its speech service is dead, and that throw used to swallow the state reset below it. The recording bubble opens upward because the copilot panel clips `overflow`. **Spikes** (`components/ai/useVoiceLevel.ts`) are the real signal, not a loop: `AnalyserNode` → RMS → `MotionValue` per animation frame, 21 bars in a rolling window, plus a level-scaled ring on the button. It only ever meters a stream the caller already owns (the server path's `MediaRecorder` stream) and never opens one itself — a second `getUserMedia` while the Web Speech API is capturing produces a lit mic and no transcript, and the Web Speech API exposes no audio to meter anyway, so the browser path stays decorative. `live` is false whenever the meter can't start, which keeps the decorative fallback rather than a flat line — and note that an analyser alone is not a sink, so the graph ends in a zero-gain gain node. Languages (`src/lib/ai/languages.ts`) mirror the research repo's curated list; Urdu and Arabic render right-to-left with code blocks kept left-to-right. `components/ai/LanguagePicker` is the one pill dropdown both the translator and the copilot use.

**Movable copilot** (`learn/LessonAssistant.tsx`, pattern from the research repo's `copilot-sidebar.tsx`): a single `{x, y}` state positions the launcher and `panelBox()` anchors the panel beside it (flipping to whichever side has room, 8 px clamp). Drag = pointer capture on the launcher or the panel header, with a 4 px threshold so a press that never moved stays a tap. Beyond the reference: the position persists in `localStorage['postgres-lab:copilot:pos']`, a `resize` listener re-clamps it, header controls are excluded from the drag, and ⌖ resets it to the corner.

**Answer cache** (`components/ai/useAiAnswer.ts`): `AiAnswer` never calls `/api/ai` itself. `useAiAnswer(task, payload)` derives a key from everything that changes an answer (task, lesson, language, and hashes of question / text / SQL / schema / error) and looks it up in a module-level map, so the request belongs to the key, not to a mounted component. Unmounting (closing the copilot, toggling the AI panel, navigating away) aborts nothing — the stream keeps filling the entry, and reopening renders wherever it got to. Finished answers are mirrored to `localStorage['postgres-lab:ai-cache']` (newest 24, 7-day TTL, cleared on quota errors), so a reload is served from disk. `clearAiCache()` drops one key or all of them (the trash buttons); `retry()` is the one path that spends a request, and it keeps the entry object so mounted cards keep their subscription. Because the key is derived from the payload, the playground snapshots `schemaText` into the request when you ask — otherwise the schema arriving a moment later would change the key and fire a second call. The cache is plain text in `localStorage` — your own SQL and schema — and the header trash button empties the visible list and the cache in one click (`clearAiCache()`). Answer bodies set `user-select: text`, because the copilot's drag handler used to swallow selection with the drag.

**AI answer text size** (`components/ai/useAiFontSize.ts` + `.ai-text` in globals.css): one shared size for every AI answer. `responsive()` picks it from the viewport until the reader uses the A−/A+ control, which stores it in `localStorage['postgres-lab:ai-font']` and publishes it as `--ai-fs` on `<html>` through a module-level store, so all mounted answers and controls update together. Children are sized in em, so code and tables keep their proportions; `overflow-wrap: anywhere` plus scrolling `pre` keeps wide SQL inside the panel.

**Streaming contract** (`streamAi`): every text delta replaces the accumulated response, so a reconnect never duplicates; a gateway error is folded into the stream as `**Error:** …`; in the browser an `AbortController` lets one abort (closing the copilot no longer does — the cache owns the stream). The route returns plain text (`text/plain`), not NDJSON.

Native `claude-*` ids get the beta Messages call with refusal fallbacks (`fallbacks: "default"`), `effort` (low for completions, medium otherwise) and a cached system prompt. Gateway aliases such as `coder` get a plain `messages.stream` with only `model`, `max_tokens`, `system` and `messages`, because they may reject Anthropic-only fields (the research repo also marks `coder` as ignoring structured output). The client sends the live schema description as context. Monaco ghost-text completions are opt-in (toggle in the playground) and debounced to 650 ms.

## Playground

`src/components/playground/Playground.tsx` — the editor's `schema` prop is the **single source of truth** for schema, shared by Monaco completion providers, the Explorer, and the AI. `useSchema` (in `lib/db/useSchema.ts`) runs the introspection query against the **live database** (PGlite or server), turns it into `TableMeta[]`, and refreshes on every run; `describeSchema` formats the same data into the text given to Claude, so completion and AI always agree with the real tables. The AI panel is toggleable (`aiOpen`, a toolbar button that is visible at **every** width, with `aria-controls="playground-assistant"` and `aria-expanded`) and is 400 px wide on wide screens so answers wrap sentences, not code. Below 1536 px it is not a column at all but a **bottom sheet** (`fixed inset-x-0 bottom-0 h-[72dvh] z-40`) over a `z-30` backdrop, closed by Escape, the backdrop, or an X in its header; the same content, prompt and transcript, which scrolls inside the sheet (`min-h-0 flex-1 overflow-y-auto`). One `matchMedia('(min-width: 1536px)')` drives `wide`, and `wide` picks the classes — so the sheet and the column cannot disagree with the CSS. It breaks at `2xl` because the column has always started there: a sheet that only covered `lg`-and-down would leave a 1280 px laptop with a toggle that opens nothing. The sheet starts closed on a narrow mount and closes whenever the window crosses into narrow (a mobile toolbar is ~128 px tall, so a persistent sheet would eat the editor); Escape is a no-op in the desktop column, on the principle that a persistent column should not disappear on a keypress.

Layout is a CSS grid whose row template is set inline — `auto auto minmax(120px,1fr) 9px <n>px` — because the last track is user-controlled. The 9 px row is a `role="separator"` slider: pointer-drag, ↑/↓ to nudge, Enter to collapse the panel to its tab strip; size and collapsed flag persist in `localStorage['postgres-lab:playground:bottom']`, and a run or a tab click reopens it. The drag listeners live on `window` (`setPointerCapture` never retargeted moves away from Monaco, so the handle saw none of them) and lock `cursor`/`userSelect` on `<body>` for the duration. The max size is measured from the toolbar and Write bar rows above it — the Write bar grows a row when its example chips appear, so the clamp also re-runs from a `ResizeObserver` on it; guessing the chrome height overflowed the page by 78 px.

The `main` cell carries `grid-cols-[minmax(0,1fr)] min-w-0`, and that is not decoration. Without an explicit column template the editor sits in an *implicit* `auto` track, and an `auto` track is floored at min-content — Monaco stamps a pixel width onto its own DOM node, so the track could only ever grow and never shrink. Measured at a 400 px viewport before the fix: the column stayed 1179 px wide, `automaticLayout` re-laid out into a box wider than the screen, and the page scrolled sideways by 779 px. **Any grid cell that holds Monaco needs an explicit `minmax(0,…)` track.** (Auditing this, Monaco also reports `lines-content` and `view-rulers` as 16 777 216 px wide; that is its virtual canvas inside `overflow-guard`, normal, and not the overflow.)

`src/components/sql/ResultView.tsx` renders the `RunResult` union as one of: rows table (with copy), command tag, syntax-error card, runtime error card (both fed by the database's own failure — `error` plus `detail`, `hint` and SQLSTATE on a failed `RunResult`; nothing is parsed in the client), and a **guard card** for statements the local sandbox refuses.

## Metadata, sitemap and share cards

`src/lib/site.ts` is the only place that knows where this deployment lives: `NEXT_PUBLIC_SITE_URL`, with a visible placeholder host as fallback so a fork builds. `src/lib/site-meta.ts` turns it into `rootMeta` (used by `app/layout.tsx`) and `lessonMeta(title, tagline, slug)`, and **`metadataBase` must stay in `rootMeta`** — without it Next emits relative `og:image` URLs, and a preview that is relative is a preview that does not render. `sitemap.ts` maps `readyTopics` from the registry, so `status` is the gate that keeps a `planned` lesson out of the index, and `robots.ts` disallows `/api/` because those routes execute SQL and pay for model calls. Lesson metadata, the card and the page body all read the same registry row, so a lesson's title, tagline, track, `minutes` and `challengeCount` are written once.

The cards are `ImageResponse` from `next/og` (1200×630, prerendered at build: one `○ /opengraph-image` for the utility routes, one `● …/opengraph-image` per ready lesson). Three constraints shaped them. **Satori needs explicit `display: flex` on any node with more than one child**, and JSX counts the text either side of an expression as separate children — `{SITE_NAME} / learn / {slug}` fails the build, a single template literal does not. **`textTransform: 'uppercase'` with `letterSpacing` swallows spaces** unless `whiteSpace: 'pre'` is set. And satori renders in a sandbox with no stylesheet, so **CSS variables do not exist there** — the cards' palette is a literal copy of the dark tokens in `globals.css`, annotated as such; changing a token means looking at both.

## Tooling and tests

**The production build runs on webpack, not Turbopack** — `"build": "next build --webpack"`. Not a preference: Turbopack's minifier breaks PGlite, and the app's core feature dies with it. A Turbopack build serves every page fine and fails only in the browser, at DB boot: `m.instantiateWasm is not a function`, with all wasm/`.data` assets fetching 200s. The name survives minification, so it is not property mangling of that key — the Emscripten module object the factory receives simply no longer carries the hook. Same code, same machine: `next build` (Turbopack) → playground shows nothing; `next build --webpack` → results table renders, 0 page errors. Dev is unaffected (`next dev` runs the unminified bundle, which is why this hid for so long). If a future Next makes the bundler switch cheap, prefer the option that keeps PGlite's Emscripten glue intact, and re-run this check by opening `/playground` on a **production** build and pressing Run.

**Numbers in server-rendered components are formatted with an explicit locale** (`ScanRace`'s `n = (v) => v.toLocaleString('en-US')`). Lesson pages are prerendered at build time, and a bare `toLocaleString()` is resolved by *whoever builds the page* — Node on this machine renders `100000` as `1,00,000` while the browser renders `100,000`, which React reports as hydration error #418. Dev cannot catch this (render-on-demand, one process, one locale), so it only appears in a production build's console. Prefer literals in prose, an explicit locale in components. The check is a grep of the built HTML (`.next/server/app/learn/<slug>.html`), not of the source.

**Explainer animations render bulk visuals as plain DOM.** `ScanRace` draws 2 × 1,031 heap pages as `<span>`s coloured by class, with `transition-colors` doing the animating; `motion` is reserved for the handful of things that genuinely move (the B-tree descent, the verdict card). 2,062 `motion` nodes on a lesson page is the wrong tool, and the strips are `aria-hidden` with every number repeated as text, so the animation carries no information a screen reader (or a screenshot) cannot get from the scoreboard.

`pnpm test` runs vitest (config `vitest.config.mts`): 88 tests in 7 files (`lib/ai/quota.test.ts`, `lib/sql/session.test.ts`, `lib/ai/languages.test.ts`, `lib/db/guard.test.ts`, `lib/learn/check.test.ts`, `components/shell/CommandPalette.test.ts`, `content/registry.test.ts`) — all pure modules, so no browser, no database, no API key. Two platform facts shape the config: it has to be `.mts` (as `.ts` it is loaded as CommonJS and dies on `ERR_REQUIRE_ESM` importing vite), and it aliases `server-only` to `src/test/server-only-stub.ts`, because the real package throws on import — correct inside a bundle, fatal in a node test of a server module. `.github/workflows/ci.yml` runs install → `verify:lessons` → `typecheck` → `lint` → `test`, offline, concurrency-cancelled.

TypeScript 7 ships **no JS API**, so typescript-eslint 8.71 refuses to load (`does not support TS 7.0`), and `@typescript/native` — named in the TS 7 announcement — is not published. The working arrangement: `typescript` is aliased to `npm:@typescript/typescript6@6.0.2` so tooling gets the 6.0 API (it satisfies typescript-eslint's `>=4.8.4 <6.1.0` peer), and the TS 7 compiler stays available as the devDependency `typescript-cli` (`npm:typescript@^7.0.2`) whose `tsc` binary is what `pnpm typecheck` runs. Consequence for the next person: any tool that imports `typescript` sees 6.0; `tsc` is 7. Lint is `eslint .` on a flat config (`eslint.config.mjs`) that spreads `eslint-config-next/core-web-vitals`, because Next 16 deleted `next lint`; `react-hooks/refs` and `react-hooks/set-state-in-effect` are demoted to warn, since the Monaco/voice bridges keep the latest props in a ref and 25 panels fetch on tab/persona/table change — the documented shape until data moves to server components.

## Styling

Design tokens are CSS variables in `app/globals.css` (light + `.dark`), exposed to Tailwind via `@theme inline` (`bg-surface`, `text-brand`, `text-on-brand`, …). Lesson typography is `.prose-lab`; widgets inside lessons use `.not-prose`. The theme is stored in `localStorage['postgres-lab:theme']` and applied before paint.
