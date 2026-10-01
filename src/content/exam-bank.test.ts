import { describe, expect, it } from 'vitest';
import { checkProblems, gradeChecks } from '@/lib/learn/check';
import { gradeAgainstScenario } from '@/lib/exam/server/db';
import { EXAM_BANK } from './exam-bank';
import { isPublished, topics } from './registry';

/**
 * The bank is not allowed to contain a wrong answer.
 *
 * A lesson block that lies is caught by `verify:lessons`, which runs every block against a live
 * PGlite. An exam question can lie the same way — an oracle that does not match what its own
 * `answerSql` produces — and nothing else would notice, because grading only ever runs the
 * *participant's* SQL, never the reference answer. So this file does for the bank what the lesson
 * verifier does for prose: it executes every item for real and asserts the outcome.
 *
 * Each question is checked three ways:
 *   1. the oracle is well-formed (an empty or typo'd check passes for everybody)
 *   2. the reference answer passes it, under its own persona and setup
 *   3. an unrelated answer fails it — an oracle that accepts everything is worthless
 */

/** A control answer. No question here expects 42, so it must fail every oracle. */
const CONTROL_SQL = 'SELECT 42';

const ids = EXAM_BANK.map((q) => q.id);
const published = topics.filter(isPublished).map((t) => t.slug);

describe('exam bank', () => {
  it('has unique ids', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('draws only from published topics', () => {
    for (const q of EXAM_BANK) {
      expect(published, `${q.id} references unpublished topic "${q.topicSlug}"`).toContain(q.topicSlug);
    }
  });

  it('states a positive point value on every item', () => {
    for (const q of EXAM_BANK) {
      expect(q.points, q.id).toBeGreaterThan(0);
    }
  });

  it('gives every item a non-empty prompt and explanation', () => {
    for (const q of EXAM_BANK) {
      expect(q.prompt.trim().length, q.id).toBeGreaterThan(0);
      expect(q.explanation.trim().length, q.id).toBeGreaterThan(0);
    }
  });

  it('ships at least three items per topic so a paper can be drawn without repeats', () => {
    const byTopic = new Map<string, number>();
    for (const q of EXAM_BANK) byTopic.set(q.topicSlug, (byTopic.get(q.topicSlug) ?? 0) + 1);
    for (const [slug, n] of byTopic) expect(n, `topic ${slug}`).toBeGreaterThanOrEqual(3);
  });

  // ── Execution ───────────────────────────────────────────────────────────────

  it('has a well-formed oracle on every item', () => {
    for (const q of EXAM_BANK) {
      expect(checkProblems(q.checks), `${q.id} has a malformed check`).toEqual([]);
    }
  });

  it.each(EXAM_BANK.map((q) => [q.id, q] as const))(
    'reference answer passes: %s',
    async (_id, q) => {
      const { result } = await gradeAgainstScenario(q.setupSql, q.answerSql, q.persona);
      // An oracle with an `error` check *wants* the statement to fail, so a failed run is the
      // expected shape there. Everywhere else a failure is a broken setup, and saying so beats a
      // bare assertion — an author needs to know whether setup broke or the expectation is wrong.
      const expectsError = q.checks.some((c) => 'error' in c);
      if (!result.ok && !expectsError) throw new Error(`${q.id}: reference answer failed to run — ${result.error}`);
      const grade = gradeChecks(result, q.checks);
      if (!grade.passed) throw new Error(`${q.id}: ${grade.failures.join('; ')}`);
    },
  );

  it.each(EXAM_BANK.map((q) => [q.id, q] as const))(
    'oracle rejects an unrelated answer: %s',
    async (_id, q) => {
      const { result } = await gradeAgainstScenario(q.setupSql, CONTROL_SQL, q.persona);
      const grade = gradeChecks(result, q.checks);
      expect(grade.passed, `${q.id} accepted "${CONTROL_SQL}", so its oracle does not discriminate`).toBe(false);
    },
  );
});
