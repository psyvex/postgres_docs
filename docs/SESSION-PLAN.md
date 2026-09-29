# Session run sheet: "PostgreSQL: RLS, Database Functions & Security"

Monday 5 October 2026, 16:00. Short, practical, interactive.

## Before the session

- [ ] `pnpm build && pnpm start` (production mode is smoother than dev on a projector)
- [ ] Open the app once so PGlite is cached, then reset demo data from the header menu
- [ ] Optional live DB: header → Live → local connection → *Load demo schema*
- [ ] Optional AI: `ANTHROPIC_API_KEY` in `.env.local`, then test *Explain* in the playground
- [ ] Browser zoom ~125%, light theme for projectors
- [ ] `pnpm verify:lessons` is green
- [ ] Open the app in a **new tab** right before starting so the audience sees the branded splash (it plays once per browser session)

## Flow (≈60 min)

| Time | Page | Beats |
|---|---|---|
| 0–5 | Home | The forgotten `WHERE` story; why put security in the database |
| 5–20 | Row-Level Security | Run as Alice with no RLS (sees Globex) → enable RLS (0 rows) → policy → **RlsBouncer** (switch users, turn RLS off) → WITH CHECK errors → who bypasses |
| 20–30 | Roles & Privileges | **PrivilegeGrid**: leak tasks to `app_anon` live, then revoke → column privileges → role layout |
| 30–40 | Functions & Procedures | `assign_task` business rule error → **FunctionMachine** (INVOKER/DEFINER, unpin search_path) → `public_task_count` as anon |
| 40–50 | Triggers | **TriggerPipeline** (BEFORE returns NULL, AFTER raises) → audit trigger: Bob's changes show up in `audit_log` |
| 50–55 | Security in Production | **InjectionDemo** with `' OR '1'='1` → **SecurityHeist** (start with no defenses, add layers) → checklist |
| 55–60 | Playground | Audience questions; answer live in SQL (+ AI panel) |

## If something breaks

- Weird state: header → *Reset demo data* (or the 🧪 button at the top of each lesson).
- Browser DB stuck: DevTools → Application → IndexedDB → delete `postgres-lab`, then reload.
- Live DB errors: switch back to *Browser DB*. Every example works there.
