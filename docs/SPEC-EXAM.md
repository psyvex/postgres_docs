# Postgres Visual Exam — Design Spec

## Status

Draft v1. Awaiting approval.

---

## 1. What this is

A live quiz tool that turns the Postgres-lab lesson content into timed, competitive exams. The host creates an exam from the question bank, distributes a short code, and watches a real-time leaderboard. Every question is visual: an animated explainer, a result table, a query plan, or a live SQL output — not multiple choice, not fill-in-the-blank. The participant types a SQL query as their answer.

**Target users:** instructors running a Postgres workshop or course; teams doing group knowledge reviews; conference workshop attendees who compete on the same material.

---

## 2. Exam lifecycle

```
IDLE → CREATED → WAITING → ACTIVE → FINISHED
```

- **IDLE** — host fills settings on `/exam/create`.
- **CREATED** — host receives a 6-character code (e.g. `PG-3K9X2`). Participants join at `/exam/join`.
- **WAITING** — participants see a live count. Host presses **Start now**, or the exam auto-starts at a scheduled `startAt` time.
- **ACTIVE** — one question at a time. Per-question countdown. When the timer expires or all participants have answered, the question closes and the next opens.
- **FINISHED** — final leaderboard locked and shown to all.

---

## 3. Exam settings

Host fills these before generating the code:

| Setting | Type | Notes |
|---|---|---|
| Topics | multi-select | One or more lesson topic slugs |
| Question count | number | How many to draw from the bank |
| Per-question time | number (seconds) | Default 60 |
| Difficulty | easy / medium / hard / all | Filter on question metadata |
| Start trigger | "Host starts" or a datetime | |
| Show leaderboard | boolean | Live rankings during exam |
| Allow late join | boolean | Can participants join after start? |
| Show answer card | boolean | Explanation shown after each question |
| Tiebreaker | time or accuracy | Sort order when scores tie |

### The exam code

6 uppercase alphanumeric characters, generated server-side, stored with the exam. ~2B combinations — collision negligible at workshop scale. The code is the access token; anyone with it joins. Host is identified by the session that created the exam (no separate PIN in v1).

---

## 4. The question bank

### How explainers work

All 13 `src/components/animations/*.tsx` components export a single default export and take **zero props**. They are closed state machines — their data lives in module-level constants (`QUERIES`, `POLICIES`, `HEAP_PAGES`, etc.). They cannot be paused at a specific stage from outside the component.

The exam does not try to embed explainer components as props. Instead, each question specifies a **scenario key** — a literal description of which stage of which explainer to render, and which ground-truth row from that explainer's oracle table is the correct answer.

### Scenario key examples

- `ScanRace:index-pages` — the ScanRace explainer frozen at the moment showing index I/O. Ground truth: `QUERIES.user7.indexPages = 4`.
- `MvccExplainer:3` — the MVCC explainer at transaction stage 3. Ground truth: `TRANSACTIONS[3].sessionB_rows = 0`.
- `RlsBouncer:alice-sees-bobs-rows` — the RLS Bouncer scenario. Ground truth: `POLICIES.test(task, user) = true`.
- `PrivilegeGrid:app-anon-orgs` — the Privilege Grid. Ground truth: live `has_table_privilege('app_anon', 'lab.organizations', 'SELECT') = true`.

The ground truth is either a literal in the explainer's source (for static scenarios) or a PGlite live query (for dynamic ones). The question's `answerSql` is the SQL the participant types. The `check` object is the oracle.

### Three question patterns

**Pattern A — Count/Value** *(ScanRace, PartitionPruner)*
Explainer shows a number. Question asks for it. Participant types SQL producing that value. `check: { firstCell: 'N' }` grades it.

**Pattern B — State/Scenario** *(MvccExplainer, TriggerPipeline)*
Explainer freezes at a transaction stage. Question asks what a session sees. Participant types SQL demonstrating correct isolation behaviour. `check: { rows: N }` or `check: { error: '...' }` grades it.

**Pattern C — Success/Failure** *(RlsBouncer, PrivilegeGrid, InjectionDemo)*
Explainer shows a permission matrix. Question asks whether an operation succeeds. Participant types SQL. `check: { rows: N }` or `check: { error: 'permission denied' }` grades it.

### Question schema

```ts
type ExamQuestion = {
  id: string;
  type: 'count-value' | 'state-scenario' | 'success-failure';
  topicSlug: string;
  difficulty: 'easy' | 'medium' | 'hard';

  /** Which explainer and what stage to render */
  scenarioKey: string;       // e.g. 'ScanRace:index-pages'
  scenarioDescription: string; // e.g. 'Four index pages lit up in orange'

  /** The question text shown to the participant */
  question: string;

  /** SQL that runs before the participant's answer — sets up the scenario state.
   *  For Pattern B this might be BEGIN + transaction commands.
   *  For Pattern C this might be GRANT / REVOKE statements. */
  setupSql: string;

  /** The grading oracle — what gradeChecks(result, [check]) expects */
  check: Check;  // rows | rowsAtLeast | firstCell | error | columns | affected

  /** What the answer card shows after the question closes */
  answerCard: {
    answer: string;          // "The correct answer is: 4"
    explanation: string;    // "ScanRace shows that Postgres read 4 pages from the index…"
    correctSql: string;     // the expected answer SQL
  };

  timeSeconds: number;
  points: number;
  timeBonus: boolean;  // if true, faster answers earn bonus points
};
```

### Bank storage

`src/content/exam-bank.ts` — TypeScript array of `ExamQuestion`. Structured for drop-in replacement with a database table when the bank exceeds ~500 questions.

**Phase 2 (future):** AI-assisted generation from topic + difficulty prompts. Human review required before questions enter the bank.

**Phase 3 (future):** Per-participant randomisation — answer SQL uses `floor(random() * N)` constants so the correct query differs per participant, but `check: { rows: N }` stays stable.

### Oracle types

Each explainer's ground truth falls into one of two categories:

**Static oracle** — the answer is a literal in the explainer's source code. Pattern A questions use these. The grader never queries the DB for these; the `check` is a hardcoded expectation.

**PGlite oracle** — the answer requires running SQL against the seeded lab state. Patterns B and C use these. The grader creates a fresh PGlite per exam session (separate from the browser's shared IndexedDB PGlite), seeds it with `SEED_SQL` from `seed.ts`, runs the `setupSql`, then runs the participant's `answerSql`, then calls `gradeChecks(result, [check])`.

---

## 5. Grading

### Mechanics (reuses existing code)

```ts
import { gradeChecks } from '@/lib/learn/check.mjs';
import { PGlite } from '@electric-sql/pglite';
import { SEED_SQL } from '@/lib/db/seed'; // extracted from seed.ts at build time
import { PERSONAS } from './exam-personas'; // { owner, alice, bob, carol, anon }

async function gradeSubmission(submission: {
  questionId: string;
  answerSql: string;
  persona?: string;  // 'alice' | 'bob' | 'carol' | 'anon' | 'owner'
}): Promise<{ correct: boolean; score: number; bonus: number }> {
  const db = await PGlite.create();
  await db.exec(SEED_SQL);
  await db.exec('RESET ALL');

  const { setupSql, check, points, timeSeconds, timeBonus, timeMs } = getQuestion(submission.questionId);

  if (setupSql) {
    await db.exec(setupSql);
  }

  // Persona prefix — same logic as verify-lessons.mjs
  const persona = PERSONAS[submission.persona ?? 'owner'];
  const prefix = [
    'SET search_path = lab, public',
    persona.memberId != null && `SET app.member_id = '${persona.memberId}'`,
    persona.orgId != null && `SET app.org_id = '${persona.orgId}'`,
    persona.role && `SET ROLE ${persona.role}`,
  ].filter(Boolean);

  const result = await db.exec([...prefix, submission.answerSql].join(';\n'));

  const { passed } = gradeChecks(result, [check]);

  // Cleanup — same finally block as CI
  await db.exec('ROLLBACK; RESET ROLE; RESET ALL;').catch(() => undefined);

  const correct = passed;
  const score = correct ? points : 0;
  const bonus = correct && timeBonus
    ? Math.floor(points * Math.max(0, timeSeconds * 1000 - timeMs) / (timeSeconds * 1000))
    : 0;

  return { correct, score, bonus };
}
```

`gradeChecks` is the same function from `src/lib/learn/check.mjs`. `checkProblems([check])` is called at build/import time — malformed checks fail at startup, not at runtime.

### Score computation

```
correct = gradeChecks(result, [check]).passed
score   = correct ? points + bonus : 0
bonus   = timeBonus && timeRemaining > 0
            ? floor(points * timeRemaining / timeSeconds)
            : 0
```

No partial credit. Either the check passes or it doesn't.

### Tiebreaker

- `tiebreaker = 'time'`: sort by `totalScore DESC, totalTimeMs ASC`
- `tiebreaker = 'accuracy'`: sort by `totalScore DESC, wrongCount ASC`

---

## 6. Real-time architecture

### The constraint

Next.js 16 Route Handlers run on the Web `Request`/`Response` API. **WebSockets are not supported** on Vercel serverless — "the connection closes on timeout, or after the response is generated" (Next.js bundled docs, `backend-for-frontend.md`). SSE (server-sent events) works. The streaming guide covers the mechanism.

### Approach: SSE + in-memory state

Each participant holds one SSE connection to `GET /api/exam/[code]/stream`. The server keeps a module-level `Map<code, ExamState>` for active exams. When a submission arrives or the timer fires, the server updates the state and pushes an event to all connected streams for that exam.

```ts
type SSEEvent =
  | { type: 'participant-joined';   count: number }
  | { type: 'exam-started' }
  | { type: 'question';             index: number; question: SerialisedQuestion; timeSeconds: number }
  | { type: 'submission-result';    participantId: string; correct: boolean; score: number }
  | { type: 'leaderboard';         entries: LeaderboardEntry[] }
  | { type: 'question-closed';     answerCard: AnswerCard }
  | { type: 'exam-finished';       finalBoard: LeaderboardEntry[] };
```

`SerialisedQuestion` is `ExamQuestion` with `answerSql` and the internal `check` fields removed — the `answerCard` with `correctSql` is sent only after the question closes.

### Serverless in-memory caveat

Single-region hobby Vercel: one server instance, one `Map` — works fine for a workshop.

Multi-instance or globally-distributed: participants may hit different instances, and the leaderboard becomes stale.

**Mitigations (in order of complexity):**

1. **Accept it for v1.** Document the limitation. A 50-person workshop on hobby Vercel works fine.
2. **Polling** — `GET /api/exam/[code]/state?since=timestamp`. Client polls every 2–5 seconds. Same in-memory constraint.
3. **Upstash Redis** — exam state in Redis. Free tier: 10K commands/day. SSE fans out via Redis pub/sub. Production path.
4. **Ably / Pusher** — third-party real-time. Free Ably: 6M messages/month, 75 concurrent connections. Enough for a 50-person workshop.

---

## 7. Data model

```ts
type Exam = {
  id: string;
  code: string;               // 6-char uppercase alphanumeric, UNIQUE
  status: 'created' | 'waiting' | 'active' | 'finished';
  createdBy: string;          // session / cookie id
  settings: ExamSettings;
  questionIds: string[];      // shuffled subset drawn from bank
  startedAt: string | null;
  finishedAt: string | null;
  currentQuestionIndex: number;
};

type ExamSettings = {
  topicSlugs: string[];
  count: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'all';
  perQuestionTime: number;
  startTrigger: 'host' | string; // 'host' or ISO datetime
  showLeaderboard: boolean;
  allowLateJoin: boolean;
  showAnswerCard: boolean;
  tiebreaker: 'time' | 'accuracy';
};

type Participant = {
  id: string;
  examCode: string;
  displayName: string;
  joinedAt: string;
  submissions: Record<number, Submission>;
  totalScore: number;
  totalTimeMs: number;
  wrongCount: number;
};

type Submission = {
  questionIndex: number;
  sql: string;
  submittedAt: string;
  timeMs: number;
  correct: boolean;
  score: number;
  bonus: number;
};

type LeaderboardEntry = {
  rank: number;
  participantId: string;
  displayName: string;
  totalScore: number;
  questionScores: Record<number, number>;
};
```

### Storage

- **Dev / self-hosted:** `src/lib/exam-store.ts` — module-level `Map`. SSR-safe reads (returns empty on server; client initialises from API).
- **Production:** Upstash Redis. Key pattern:
  - `exam:{code}` → JSON `Exam`
  - `exam:{code}:participants` → Hash `participantId → JSON Participant`
  - `exam:{code}:submissions:{participantId}` → Hash `questionIndex → JSON Submission`

---

## 8. API design

```
POST   /api/exam/create                          → { code: string }
GET    /api/exam/[code]                         → Exam
POST   /api/exam/[code]/join                    → { participantId: string }
GET    /api/exam/[code]/examiner                → { exam, participants[] }   (host only)
POST   /api/exam/[code]/start                   → {}                         (host only)
GET    /api/exam/[code]/question/[index]        → SerialisedQuestion
POST   /api/exam/[code]/question/[index]        → { correct, score, bonus }
GET    /api/exam/[code]/leaderboard             → LeaderboardEntry[]
GET    /api/exam/[code]/stream                  → text/event-stream (SSE)
GET    /api/exam/[code]/results                 → { participant, allResults, finalBoard }
POST   /api/exam/[code]/finish                  → {}                         (host only)
```

### SSE stream events

```
event: participant-joined
data: {"count": 5}

event: exam-started
data: {}

event: question
data: {"index":0,"question":{"id":"...","scenarioKey":"ScanRace:index-pages","scenarioDescription":"Four index pages lit up in orange","question":"How many index pages did Postgres read?","timeSeconds":60},"timeSeconds":60}

event: leaderboard
data: {"entries":[{"rank":1,"participantId":"...","displayName":"P3","totalScore":100}]}

event: question-closed
data: {"answerCard":{"answer":"4","explanation":"ScanRace shows that Postgres read 4 pages from the index…","correctSql":"SELECT 4"}}

event: exam-finished
data: {"finalBoard":[...]}
```

---

## 9. UI/UX

### Pages — two, not eight

Shipped as two routes. The eight screens above are all still here; they are **states of one page**, not
URLs. Nobody navigating to an exam wants a different address per phase of it, and splitting them meant
eight places for the paper, the clock and the join cookie to disagree.

| Route | Who | Carries |
|---|---|---|
| `/exam` | Host, participant | Create form → code reveal, plus the join card (was `/exam/create` + `/exam/join`) |
| `/exam/[code]` | Host, participant | Waiting room, lobby, active question, leaderboard, results — chosen by `status` and `isHost` from the same `/state` frame |

One `/state` frame feeds both views, which is what makes the host console and the participant view
provably the same exam: they are reading one response, not two endpoints that must be kept in sync.
The room polls it every 3 s and treats SSE as an enhancement, so a lost event costs a delayed
leaderboard, never a wrong one.

### Active view (participant)

```
┌─────────────────────────────────────────────────────────┐
│  Question 3 of 20                           ⏱ 00:42    │
│─────────────────────────────────────────────────────────│
│  How many index pages did Postgres read?                │
│─────────────────────────────────────────────────────────│
│                                                         │
│    [ ScanRace frozen at index-pages stage ]             │
│    [ Four index pages lit in orange     ]                │
│    [ I/O bar reads "4 pages"           ]                │
│                                                         │
│─────────────────────────────────────────────────────────│
│  SELECT _ FROM _ WHERE _;                              │
│─────────────────────────────────────────────────────────│
│                                          [ Submit ]     │
└─────────────────────────────────────────────────────────┘
```

### Host leaderboard view

```
┌─────────────────────────────────────────────────────────┐
│  🏆 Live Leaderboard                   Q3 of 20         │
│─────────────────────────────────────────────────────────│
│  1. Participant 7                   340 pts            │
│  2. Participant 3                   290 pts  ↑1        │
│  3. Participant 1                   280 pts  ↓1        │
│  ...                                                      │
│─────────────────────────────────────────────────────────│
│  12 participants · 4 watching                           │
└─────────────────────────────────────────────────────────┘
```

### Design decisions

- **No authentication.** Code is the access token. Anyone with it is a participant. Host is the creator of the exam session.
- **No participant accounts.** Display name or "Participant N". No login.
- **SQL input only.** Single-line input, not a code editor. The question is visual; the answer is a query.
- **No timer extension.** Exam settings are host-side; the participant view shows the configured time.
- **The answer card is the teaching moment.** After each question, everyone sees the correct SQL and explanation.

---

## 10. Security

- **Malicious participant SQL.** Every submission runs against a dedicated PGlite instance that is seeded fresh per exam, not the browser's shared IndexedDB PGlite. All writes are wrapped in `BEGIN; …; ROLLBACK;` — nothing commits. DDL cannot break other questions because each question gets a fresh instance.
- **Code enumeration.** 6-char alphanumeric ≈ 2B combinations. Rate-limit `/api/exam/[code]/join`.
- **Host identity.** No auth in v1. Anyone with the code can start the exam. Future: session cookie on create.
- **Leaderboard integrity.** A participant can watch the SSE stream and see all submissions before the timer closes. Acceptable for a workshop tool.

---

## 11. Out of scope for v1

- Participant accounts or login
- Exam retakes
- Partial credit
- Persistent exam history
- Mobile UI
- AI question generation
- Per-participant randomisation
- Third-party real-time service integration

---

## 12. Implementation order

**Core loop (steps 1–6):**
1. `src/lib/exam-store.ts` — in-memory Map store
2. `POST /api/exam/create` + `GET /api/exam/[code]`
3. `POST /api/exam/[code]/join` + `/exam/lobby/[code]`
4. `src/content/exam-bank.ts` — first 20 questions (3 per topic × 6 topics, Pattern A only for v1)
5. `GET /api/exam/[code]/question/[index]` + `POST` submission grading via `gradeChecks`
6. `GET /api/exam/[code]/stream` — SSE endpoint with in-memory state

**UX (steps 7–10):**
7. Participant exam view + per-question timer
8. Host waiting room + start trigger
9. Live leaderboard
10. Answer card + results view + `/exam/create` settings form

**Polish (steps 11–12):**
11. Host summary + CSV export
12. Pattern B and C questions (require `setupSql` + scenario state management)

---

## 13. Key files

What shipped. One deliberate change from the first draft of this spec: everything server-only lives
under `src/lib/exam/server/`, so a client import of the store or the pool is a build error rather than
a silent bundle leak. The `leaderboard` and `results` endpoints became one `state` frame (below), and
the eight pages collapsed to two (§9).

| File | Role |
|---|---|
| `src/content/exam-bank.ts` | The question bank — scenario, oracle, reference answer per item |
| `src/content/exam-bank.test.ts` | The self-proving validator: runs every item on real PGlite, rejects a control answer |
| `src/lib/exam/types.ts` | Shared types plus the timing arithmetic (`questionDeadline`, `questionOpensAt`, `examEndsAt`, `questionsThatFit`) |
| `src/lib/exam/paper.ts` | Deterministic per-participant paper — seeded shuffle, difficulty quota |
| `src/lib/exam/personas.ts` | The five lab roles, mirroring `scripts/verify-lessons.mjs` |
| `src/lib/exam/server/db.ts` | PGlite pool + per-session mutex; `gradeAgainstScenario` runs setup and answer in one rolled-back transaction |
| `src/lib/exam/server/grader.ts` | Wraps `gradeChecks`; time bonus; authoring-time oracle check |
| `src/lib/exam/server/store.ts` | In-process exam store: papers, clock advance, submissions, leaderboard |
| `src/lib/exam/timing.test.ts` | Pins the clock — a one-term off-by-one there made question 0 unanswerable |
| `src/lib/exam/e2e.test.ts` | Live-server checks; skipped unless `EXAM_BASE` is set |
| `src/app/api/exam/create/route.ts` | Create + host cookie |
| `src/app/api/exam/[code]/route.ts` | Exam metadata |
| `src/app/api/exam/[code]/join/route.ts` | Join + participant cookie |
| `src/app/api/exam/[code]/start/route.ts` | Host-gated start |
| `src/app/api/exam/[code]/state/route.ts` | The polled frame: status, deadline, paper, leaderboard, `me` |
| `src/app/api/exam/[code]/stream/route.ts` | SSE tick; emits only on change |
| `src/app/api/exam/[code]/question/[index]/route.ts` | This participant's question GET and answer POST |
| `src/app/exam/page.tsx` / `src/app/exam/[code]/page.tsx` | The two pages |
| `src/components/exam/ExamSetup.tsx` | Create form, code reveal, join card |
| `src/components/exam/ExamRoom.tsx` | Host console, participant view, stimulus renderer |
| `docs/SPEC-EXAM.md` | This file |

---

## Appendix A — Verified constraints

- `src/lib/learn/check.mjs` exports `checkProblems`, `gradeChecks`, `describeChecks`. Contains 2 NUL bytes inside a string literal — invisible to grep, visible to `node`. The file is `.mjs` because the CI verifier runs on bare `node`.
- `gradeChecks(result, checks, skip)` takes an **array**. Single-element call: `gradeChecks(result, [check])`.
- `gradeChecks` accepts `{ rows, rowsAtLeast, affected, error, firstCell, columns }` as `checks` items.
- All 13 explainers (`ScanRace`, `MvccExplainer`, `RlsBouncer`, `PrivilegeGrid`, `TriggerPipeline`, `PartitionPruner`, `InjectionDemo`, `SecurityHeist`, `FunctionMachine`, `PitrTimeline`, `JsonTree`, `ProjectFiles`, `StackTabs`) take **zero props**. They are closed state machines; they cannot be frozen at a specific stage from outside.
- `ScanRace` ground truth: `QUERIES.user7.indexPages = 4`, `QUERIES.user7.match = 2000`, `QUERIES.user7.removed = 98000`, `QUERIES.user7.hotLeaves = 2`.
- `PrivilegeGrid` and `InjectionDemo` are wired to live `useDbStore` / `runSql` — their ground truth requires a live PGlite query.
- `MvccExplainer` and `RlsBouncer` are pure state machines with hardcoded scenarios — their ground truth is static.
- `scripts/verify-lessons.mjs` proves PGlite runs in Node.js. It creates one fresh PGlite per lesson file, seeds with `SEED_SQL` from `seed.ts`, applies persona prefix (`SET search_path`, `SET app.member_id`, `SET app.org_id`, `SET ROLE`), runs `gradeChecks`, then runs `ROLLBACK; RESET ROLE; RESET ALL` in a `finally`. The exam grader reuses this exact pattern.
- `src/app/api/db/query/route.ts` is the user's own database route — gated by `DB_QUERY_TOKEN` and `ALLOW_REMOTE_DB`. Not used by the exam grader.
- `src/lib/db/local-adapter.ts` is browser-only (IndexedDB, WASM). Exam grader uses `@electric-sql/pglite` directly in Node.js.
- **The first `questionDeadline` was off by one term, and every caller inherited it.** It returned `startedAt + i * window` — the moment question *i* opens — while the scheduler, the countdown and the late-answer guard all read it as when question *i* closes. Consequence: question 0 was past its deadline the instant the exam started, so it could never be answered and its countdown read `00:00`. Found by the live e2e run, not by any unit test, because the arithmetic was individually plausible everywhere it was used. Now `questionDeadline` adds `i + 1` and `questionOpensAt` exists so nobody re-derives the opening time by subtracting a window. Pinned in `timing.test.ts`.
- **A second submission must not be graded, only replayed.** `recordSubmission` is first-answer-wins, but the POST handler used to grade and answer anyway — so the participant got a fresh `detail` (a look at the oracle) for an attempt the leaderboard silently discarded. Unlimited attempts with feedback is an oracle-shopping exploit, and it also burned a database round-trip per try. The handler now checks `findSubmission` first and replays the recorded verdict with `duplicate: true`.
- **Grading reads `lastTable(result)`, so setup and answer must be separate `exec` calls.** One combined call makes a no-table answer get graded against *setup's* table and pass wrongly. `gradeAgainstScenario` therefore runs `BEGIN` + setup, then the answer in its own `exec`.
- **`SET LOCAL ROLE` must come after setup, not before.** Setup is DDL (`CREATE POLICY`, `GRANT`, `CREATE TRIGGER`); a persona like `lab_app_member` cannot alter what it does not own, so switching first makes every Pattern B/C question fail at setup. `SET LOCAL` (not `SET`) so the role dies with the rolled-back transaction.
- **Concurrent submissions need a pool *and* a mutex.** One PGlite instance is one session, so two participants submitting at the same moment interleave on it. Empirically confirmed: an un-awaited concurrent call produced `PGlite is closed` and `SendReadyForQuery` errors. Each pooled session carries a promise-chain queue.
- **A participant-issued `COMMIT` would end the grading transaction early** and make their writes permanent in the shared database, poisoning the scenario for everyone after them. Refused by regex, along with `BEGIN`/`END`/`ROLLBACK`/`SAVEPOINT`.
- **A wrong oracle cannot be allowed to ship, so the bank proves itself.** `exam-bank.test.ts` executes every item's reference answer on a real PGlite and asserts it passes, then asserts `SELECT 42` *fails* — a question a control answer passes is a question with no content. This is what makes a >1000-item bank credible: authoring mistakes are caught by execution, not by reading.
- WebSockets not supported on Vercel serverless (Next.js bundled docs: "WebSockets won't work because the connection closes on timeout, or after the response is generated"). SSE is the supported real-time mechanism.
- Next.js 16 Route Handlers: not cached by default; cannot share data between requests on serverless; long-running handlers may be terminated.
