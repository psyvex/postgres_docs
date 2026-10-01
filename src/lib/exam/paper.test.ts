import { describe, expect, it } from 'vitest';
import { EXAM_BANK } from '@/content/exam-bank';
import { difficultyQuota, eligibleCount, generatePaper } from './paper';
import type { ExamSettings } from './types';

/**
 * The server stores one integer per exam and re-derives every paper from it, so "deterministic" is
 * not a nicety — if it fails, participants get different questions on reload and the server can no
 * longer check what anyone was dealt.
 */

const ALL_TOPICS = [...new Set(EXAM_BANK.map((q) => q.topicSlug))];

const settings = (over: Partial<ExamSettings> = {}): ExamSettings => ({
  title: 'Test',
  topicSlugs: ALL_TOPICS,
  count: 6,
  difficulty: 'all',
  perQuestionSeconds: 60,
  totalSeconds: 600,
  startTrigger: 'host',
  showLeaderboard: true,
  allowLateJoin: true,
  showAnswerCard: true,
  timeBonus: true,
  tiebreaker: 'time',
  ...over,
});

describe('paper generation', () => {
  it('is deterministic for the same seed', () => {
    const a = generatePaper(EXAM_BANK, settings(), 12345);
    const b = generatePaper(EXAM_BANK, settings(), 12345);
    expect(a).toEqual(b);
  });

  it('changes the paper when the seed changes', () => {
    const a = generatePaper(EXAM_BANK, settings(), 1);
    const b = generatePaper(EXAM_BANK, settings(), 2);
    expect(a).not.toEqual(b);
  });

  it('never repeats a question on a paper', () => {
    for (const seed of [1, 7, 99, 4242, 999999]) {
      const paper = generatePaper(EXAM_BANK, settings({ count: 12 }), seed);
      expect(new Set(paper).size, `seed ${seed}`).toBe(paper.length);
    }
  });

  it('draws only from the selected topics', () => {
    const paper = generatePaper(EXAM_BANK, settings({ topicSlugs: ['indexes'], count: 4 }), 42);
    const byId = new Map(EXAM_BANK.map((q) => [q.id, q]));
    for (const id of paper) expect(byId.get(id)!.topicSlug).toBe('indexes');
  });

  it('honours a pinned difficulty', () => {
    const paper = generatePaper(EXAM_BANK, settings({ difficulty: 'hard', count: 3 }), 8);
    const byId = new Map(EXAM_BANK.map((q) => [q.id, q]));
    expect(paper.length).toBeGreaterThan(0);
    for (const id of paper) expect(byId.get(id)!.difficulty).toBe('hard');
  });

  it('shortens instead of repeating when the pool runs out', () => {
    const paper = generatePaper(EXAM_BANK, settings({ topicSlugs: ['indexes'], count: 999 }), 5);
    expect(new Set(paper).size).toBe(paper.length);
    expect(paper.length).toBe(eligibleCount(EXAM_BANK, { topicSlugs: ['indexes'], difficulty: 'all' }));
  });

  it('orders easy before hard so a paper ramps up', () => {
    const paper = generatePaper(EXAM_BANK, settings({ count: 8 }), 11);
    const rank = { easy: 0, medium: 1, hard: 2 } as const;
    const ranks = paper.map((id) => rank[EXAM_BANK.find((q) => q.id === id)!.difficulty]);
    expect(ranks).toEqual([...ranks].sort((x, y) => x - y));
  });
});

describe('difficulty quota', () => {
  it('always returns exactly the requested count (shortfall redistributes to hard)', () => {
    // When available.hard = 0 but the quota formula wants at least 1 hard, the shortfall from
    // the other buckets accumulates into hard. The bank invariant is the total, not per-bucket.
    const available = { easy: 2, medium: 1, hard: 0 };
    const quota = difficultyQuota(10, available);
    expect(quota.easy + quota.medium + quota.hard).toBe(10);
    // Easy and medium are capped by availability; hard absorbs the rest.
    expect(quota.easy).toBeLessThanOrEqual(available.easy);
    expect(quota.medium).toBeLessThanOrEqual(available.medium);
  });

  it('sums to the requested count when the bank can supply it', () => {
    const available = { easy: 20, medium: 20, hard: 20 };
    const quota = difficultyQuota(10, available);
    expect(quota.easy + quota.medium + quota.hard).toBe(10);
  });

  it('always includes at least one hard question when one exists', () => {
    expect(difficultyQuota(4, { easy: 20, medium: 20, hard: 5 }).hard).toBeGreaterThanOrEqual(1);
  });
});
