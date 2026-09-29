# Content guide

## Add a topic

1. Add an entry to `src/content/registry.ts` (`status: 'ready'`, `references` pointing at `postgresql.org/docs/current/...`).
2. Create `src/content/topics/<slug>.mdx`. Don't add a `# Title`: the page header renders the icon and title from the registry.
3. Add the import to `src/content/load.ts`.
4. Run `pnpm verify:lessons <slug>`.

Planned topics are already listed in the registry with `status: 'planned'`; flip them when ready.

## Writing rules

- **Target the current PostgreSQL major version (18).** When a feature is version-specific, say so with `<Callout type="version">` (e.g. "PG 15+").
- Every claim that isn't obvious gets a link to the official docs. Prefer `/docs/current/` URLs.
- Start each lesson with `<ResetDemo />`. Examples should build on each other in page order, since `verify:lessons` runs them in that order.
- One analogy (`<Callout type="fun">`), at least one animation, a cheat sheet or table, and a "Check yourself" section.

## Components available in MDX

| Component | Use |
|---|---|
| `<SqlBlock sql={\`...\`} title="" as="alice" expect="" />` | Runnable example. `as` = owner, alice, bob, carol, anon. `expect` starting with `ERROR` marks an intentional failure for the verifier. `static` = display only (use `lang` for ts/conf). |
| `<Callout type="tip｜note｜warn｜danger｜fun｜version">` | Asides |
| `<ResetDemo />` | Rebuilds the `lab` schema |
| `<Icon name="rls" />` | Inline icon; names in `src/components/icons/index.tsx`. Don't use emoji. |
| `<Yes>text</Yes>`, `<No>text</No>` | Green/red markers for comparison tables |
| `<RlsBouncer />`, `<PrivilegeGrid />`, `<FunctionMachine />`, `<TriggerPipeline />`, `<SecurityHeist />`, `<InjectionDemo />` | Interactive explainers |

Inside `sql={\`...\`}` avoid backticks and `${`. Write `\\` for a literal backslash.

## Add an animation

Create `src/components/animations/<Name>.tsx` (`'use client'`), wrap it in `<DemoFrame>` (from `components/docs/Callout`), use `Segmented` / `Toggle` for controls and `motion` for movement, then register it in `src/mdx-components.tsx`. Prefer animations that run **real SQL** via `runSql()` (like `PrivilegeGrid` and `InjectionDemo`) when the concept allows it.
