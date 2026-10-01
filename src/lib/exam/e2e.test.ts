import { describe, expect, it } from 'vitest';
import { EXAM_BANK } from '@/content/exam-bank';

/**
 * End-to-end checks for the exam, run against a live server.
 *
 * Skipped unless `EXAM_BASE` is set, so `pnpm test` stays a hermetic unit run. The unit suite already
 * proves a paper is derived correctly and that every bank item grades on real Postgres; what it cannot
 * prove is anything that only exists across an HTTP boundary — that the host cookie is genuinely
 * required, that answers and oracles never cross into a response meant for a participant, that two
 * browsers get two different papers, and that a rejected submission is actually rejected.
 *
 * Run it with: pnpm dev  &&  EXAM_BASE=http://localhost:3000 pnpm test
 */
const BASE = process.env.EXAM_BASE;
const live = Boolean(BASE);

const answerById = new Map(EXAM_BANK.map((q) => [q.id, q.answerSql]));
const ALL_SLUGS = [...new Set(EXAM_BANK.map((q) => q.topicSlug))];

/** A browser: remembers the cookies the server sets, because the whole authorisation model is cookies. */
class Agent {
  cookies = new Map<string, string>();

  async req(path: string, init: RequestInit = {}) {
    const cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), ...(cookie ? { cookie } : {}) },
    });
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(';');
      const eq = pair.indexOf('=');
      this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    const text = await res.text();
    try {
      return { status: res.status, body: JSON.parse(text) as Record<string, unknown> };
    } catch {
      return { status: res.status, body: {} as Record<string, unknown> };
    }
  }
}

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe.skipIf(!live)('exam end to end', () => {
  it('runs a whole exam: create, join, start, answer, rank', async () => {
    const host = new Agent();
    const ada = new Agent();
    const grace = new Agent();

    // ── create ──────────────────────────────────────────────────────────────
    const created = await host.req('/api/exam/create', json({
      title: 'E2E', topicSlugs: ALL_SLUGS, count: 5, difficulty: 'all',
      perQuestionSeconds: 120, totalSeconds: 900, startTrigger: 'host',
      showLeaderboard: true, allowLateJoin: true, showAnswerCard: true,
      timeBonus: false, tiebreaker: 'time',
    }));
    expect(created.status).toBe(200);
    const code = created.body.code as string;
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect(created.body.count).toBe(5);

    // ── join ────────────────────────────────────────────────────────────────
    expect((await ada.req(`/api/exam/${code}/join`, json({ displayName: 'Ada' }))).status).toBe(200);
    expect((await grace.req(`/api/exam/${code}/join`, json({ displayName: 'Grace' }))).status).toBe(200);

    // ── only the host can start ───────────────────────────────────────────────
    expect((await ada.req(`/api/exam/${code}/start`, { method: 'POST' })).status).toBe(403);
    expect((await host.req(`/api/exam/${code}/start`, { method: 'POST' })).status).toBe(200);

    // ── two browsers, two papers ──────────────────────────────────────────────
    const stateA = (await ada.req(`/api/exam/${code}/state`)).body;
    const stateG = (await grace.req(`/api/exam/${code}/state`)).body;
    expect(stateA.status).toBe('active');
    const paperA = stateA.paper as string[];
    const paperG = stateG.paper as string[];
    expect(paperA).toHaveLength(5);
    expect(new Set(paperA).size).toBe(5);
    expect(paperA.join()).not.toBe(paperG.join());

    // ── the question carries no answer ────────────────────────────────────────
    const q = await ada.req(`/api/exam/${code}/question/0`);
    expect(q.status).toBe(200);
    const question = q.body.question as Record<string, unknown>;
    expect(question.answerSql).toBeUndefined();
    expect(question.explanation).toBeUndefined();
    expect(question.checks).toBeUndefined();
    expect(question.setupSql).toBeUndefined();
    expect(q.body.deadline as number).toBeGreaterThan(Date.now());

    // ── the reference answer scores, and scores over the same scenario ─────────
    const firstId = paperA[0];
    const right = await ada.req(`/api/exam/${code}/question/0`, json({ sql: answerById.get(firstId) }));
    expect(right.body.correct).toBe(true);
    expect(right.body.score).toBeGreaterThan(0);

    // ── a wrong answer scores nothing ─────────────────────────────────────────
    const wrong = await grace.req(`/api/exam/${code}/question/0`, json({ sql: 'SELECT 42' }));
    expect(wrong.body.correct).toBe(false);
    expect(wrong.body.score).toBe(0);

    // ── one answer per question: the verdict is replayed, not re-graded ─────────
    // A second attempt that returned a fresh grade would hand out oracle hints for free while the
    // leaderboard silently ignored them, so the recorded answer has to come back instead.
    const again = await ada.req(`/api/exam/${code}/question/0`, json({ sql: 'SELECT 1' }));
    expect(again.body.duplicate).toBe(true);
    expect(again.body.correct).toBe(true);
    expect(again.body.score).toBe(right.body.score);

    // ── transaction control cannot escape the grading transaction ───────────────
    const commit = await grace.req(`/api/exam/${code}/question/1`, json({ sql: 'COMMIT' }));
    expect(commit.status).toBe(400);

    // ── the shared database survived everyone's answers ─────────────────────────
    // Answers run inside a transaction that is rolled back, which is the only reason question two can
    // trust its scenario. If a participant's DELETE or COMMIT stuck, the next reference answer fails.
    const nextId = paperA[1];
    const second = await ada.req(`/api/exam/${code}/question/1`, json({ sql: answerById.get(nextId) }));
    expect(second.body.correct).toBe(true);

    // ── leaderboard reflects the scores, and not the reasons ────────────────────
    const board = ((await ada.req(`/api/exam/${code}/state`)).body.leaderboard ?? []) as Array<Record<string, unknown>>;
    const adaRow = board.find((r) => r.displayName === 'Ada');
    const graceRow = board.find((r) => r.displayName === 'Grace');
    expect(adaRow?.totalScore).toBeGreaterThan(0);
    expect(graceRow?.totalScore).toBe(0);
    expect(JSON.stringify(board)).not.toContain('checks');
  }, 120_000);

  it('refuses an exam with no topics and one with no matching questions', async () => {
    const host = new Agent();
    expect((await host.req('/api/exam/create', json({ title: 'x', topicSlugs: [] }))).status).toBe(400);
    expect((await host.req('/api/exam/create', json({ title: 'x', topicSlugs: ['not-a-topic'] }))).status).toBe(400);
  });

  it('does not leak another participant paper or detail', async () => {
    const host = new Agent();
    const ada = new Agent();
    const grace = new Agent();
    const created = await host.req('/api/exam/create', json({
      title: 'E2E-iso', topicSlugs: ALL_SLUGS, count: 3, difficulty: 'all',
      perQuestionSeconds: 120, totalSeconds: 900, startTrigger: 'host',
    }));
    const code = created.body.code as string;
    await ada.req(`/api/exam/${code}/join`, json({ displayName: 'Ada' }));
    await grace.req(`/api/exam/${code}/join`, json({ displayName: 'Grace' }));
    await host.req(`/api/exam/${code}/start`, { method: 'POST' });

    // An anonymous visitor cannot read a question at all.
    const anon = await new Agent().req(`/api/exam/${code}/question/0`);
    expect(anon.status).toBe(403);

    // Everyone is on the same clock, so question indices line up; each caller still gets *their own*
    // question at that index, and only their own failure detail.
    const a = (await ada.req(`/api/exam/${code}/question/0`)).body.question as Record<string, unknown>;
    const g = (await grace.req(`/api/exam/${code}/question/0`)).body.question as Record<string, unknown>;
    expect(typeof a.id).toBe('string');
    expect(typeof g.id).toBe('string');

    const wrong = await grace.req(`/api/exam/${code}/question/0`, json({ sql: 'SELECT 1' }));
    expect(typeof wrong.body.detail).toBe('string');
    // The state frame is what everyone else reads; it must not carry anyone's failure text.
    const frame = JSON.stringify((await ada.req(`/api/exam/${code}/state`)).body);
    expect(frame).not.toContain(String(wrong.body.detail));
  }, 120_000);
});
