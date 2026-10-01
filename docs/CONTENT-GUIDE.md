# Content guide

## Add a topic

1. Add an entry to `src/content/registry.ts` (`status: 'ready'`, `references` pointing at `postgresql.org/docs/current/...`).
2. Create `src/content/topics/<slug>.mdx`. Don't add a `# Title`: the page header renders the icon and title from the registry.
3. Add the import to `src/content/load.ts`.
4. Run `pnpm verify:lessons <slug>`.

Planned topics are already listed in the registry with `status: 'planned'`; flip them when ready.

Nothing else to remember for the plumbing: `status: 'ready'` is also what publishes the lesson. The page's `<title>`, description, canonical, `sitemap.xml` entry and 1200×630 share card are all generated from the same entry — `title` becomes the headline, `tagline` the preview text, `track` the chip on the card, and `minutes` the line in its corner. The block count on the card and the lesson's progress denominator are **not** fields: they are counted from your `.mdx` by `src/content/graded.mjs` — a self-closing `<SqlBlock>` that is not `static` and has an `assert` array on one line — which is the same rule CI runs the lesson against. So the way to give a lesson a bigger denominator is to write more graded blocks, not to edit a number, and the way to break the header is to write an `assert` the regex cannot see (wrapped across lines, or a children-form block), which grades nothing in CI and counts nothing in the UI. `status: 'break'` changes only the accent — skull on the card and in the header — never the count. Fill every field; a missing `tagline` shows up as an empty preview, not a build error.

## Writing rules

- **Target the current PostgreSQL major version (18).** When a feature is version-specific, say so with `<Callout type="version">` (e.g. "PG 15+").
- Every claim that isn't obvious gets a link to the official docs. Prefer `/docs/current/` URLs.
- Start each lesson with `<ResetDemo />`. Examples should build on each other in page order, since `verify:lessons` runs them in that order.
- One analogy (`<Callout type="fun">`), at least one animation, a cheat sheet or table, and a "Check yourself" section.
- **Measure every number you assert.** Before a block ships, its `assert` has been run against a real engine — probe scripts in `scripts/`, then `pnpm verify:lessons`. Assertions written from memory are wrong often enough (~3 per lesson so far) that authoring from memory is the slow path. Write what Postgres answers, not what it should.
- **The lab runs each block as one implicit transaction** (`SESSION_PREFIX + sql`). Three consequences that shape what is teachable: `VACUUM` and `CREATE INDEX CONCURRENTLY` always fail with "cannot run inside a transaction block"; a bare `ROLLBACK` in the **middle** of a block also discards the prefix `SET search_path = lab, public`, so later statements answer `relation "…" does not exist` (put `ROLLBACK` last, or use `ROLLBACK TO savepoint`); and `pg_stat_*` counters are a photo, not a live feed — end a writing block with `SELECT pg_stat_force_next_flush()` (PG 16+) and read the counters in the **next** block.
- When the lab cannot demonstrate something, say so in the lesson (`<Callout type="warn">`) and teach the query anyway. A block that quietly shows `0` forever is worse than a paragraph that names the limitation.

## Components available in MDX

| Component | Use |
|---|---|
| `<SqlBlock sql={\`...\`} title="" as="alice" expect="" />` | Runnable example. `as` = owner, alice, bob, carol, anon. `expect` starting with `ERROR` marks an intentional failure for the verifier. `static` = display only (use `lang` for ts/conf). |
| `<Callout type="tip｜note｜warn｜danger｜fun｜version">` | Asides |
| `<ResetDemo />` | Rebuilds the `lab` schema |
| `<Icon name="rls" />` | Inline icon; names in `src/components/icons/index.tsx`. Don't use emoji. |
| `<Yes>text</Yes>`, `<No>text</No>` | Green/red markers for comparison tables |
| `<RlsBouncer />`, `<PrivilegeGrid />`, `<FunctionMachine />`, `<TriggerPipeline />`, `<SecurityHeist />`, `<InjectionDemo />`, `<ScanRace />`, `<MvccExplainer />`, `<PartitionPruner />` | Interactive explainers |

Inside `sql={\`...\`}` avoid backticks and `${`. Write `\\` for a literal backslash.

## Add an animation

Create `src/components/animations/<Name>.tsx` (`'use client'`), wrap it in `<DemoFrame>` (from `components/docs/Callout`), use `Segmented` / `Toggle` for controls and `motion` for movement, then register it in `src/mdx-components.tsx`. Prefer animations that run **real SQL** via `runSql()` (like `PrivilegeGrid` and `InjectionDemo`) when the concept allows it.

Rules the existing eight explainers all follow:

- **Reset state in the control handler, not in an effect** — `pick = (next) => { setMode(next); setStage(-1); }`. An effect that resets on mode change costs an extra render per click.
- **Bulk visuals are plain DOM.** 1,031 heap tiles are `<span>`s switched by class with `aria-hidden`, and every number they encode is also present as text. `motion` is for the handful of things that actually move.
- **Design tokens only** (`bg-surface`, `border-line`, `bg-brand`/`text-on-brand`, `bg-good-soft`, …). No hex literals — lesson pages render in both themes.
- **No locale-dependent formatting.** Lesson pages are prerendered, and Node's default locale here prints 100000 as `1,00,000` while the browser prints `100,000`; React throws #418 on the mismatch, and only on production builds. Use literals, or `toLocaleString('en-US')`. Check the built HTML, not the source: `grep -o "1,00,000" .next/server/app/learn/*.html`.
- **A header comment records the measured numbers behind the demo, and what was left out on purpose** (timings that measured 13 ms and 21 ms on the same database are excluded from `ScanRace` for exactly that reason). Synthetic values — the transaction ids in `MvccExplainer` — are labelled synthetic there, next to the real measured range they imitate.
- **The demo must not contradict the lesson.** `MvccExplainer` is a two-session scene, because one connection cannot show the isolation levels disagreeing — which is what the lesson's own Callout says.
- **The label is part of the claim.** `PartitionPruner` displayed `330 rows returned` for a `count(*)`, which returns **one row whose value is 330** — right number, wrong noun, in a lesson about reading plans. It now says `330 — what count(*) returns`, kept apart from `9,871 rows read`. Read explainer output in the built page, not in the source: this one only renders after you press Run.
- **Measured distributions beat tidy ones.** `PartitionPruner` shows each partition's real count (Feb 9,541 … Jul 10,199), not a round 10,000, and says so in its subtitle. An unbalanced archive is the normal case; a demo that draws equal bars quietly teaches that data arrives evenly.
