import { describe, expect, it } from 'vitest';
import { examEndsAt, questionDeadline, questionOpensAt, questionsThatFit, type ExamSettings } from '@/lib/exam/types';

/**
 * The clock is the only part of the exam that keeps running when nobody is looking, and it is derived
 * rather than stored — so these numbers are the schedule. They were worth pinning down after a one-term
 * off-by-one in `questionDeadline` made question 0 expire the instant the exam started: every consumer
 * reads these as closing times, and nothing downstream could tell the difference.
 */
const START = 1_000_000;
const settings = (over: Partial<ExamSettings> = {}): ExamSettings => ({
  title: 't', topicSlugs: [], count: 5, difficulty: 'all',
  perQuestionSeconds: 60, totalSeconds: 600, startTrigger: 'host',
  showLeaderboard: true, allowLateJoin: true, showAnswerCard: true,
  timeBonus: false, tiebreaker: 'time', ...over,
});

describe('question window', () => {
  it('gives the first question its full window', () => {
    expect(questionOpensAt(START, 0, 60)).toBe(START);
    expect(questionDeadline(START, 0, 60)).toBe(START + 60_000);
  });

  it('windows are contiguous — each closes as the next opens', () => {
    for (const i of [0, 1, 7]) {
      expect(questionDeadline(START, i, 60)).toBe(questionOpensAt(START, i + 1, 60));
    }
  });

  it('no question ever opens before the exam starts', () => {
    for (const i of [0, 1, 2]) expect(questionOpensAt(START, i, 30)).toBeGreaterThanOrEqual(START);
  });
});

describe('examEndsAt', () => {
  it('ends on the pace when the pace is the tighter bound', () => {
    expect(examEndsAt(START, settings({ count: 3, perQuestionSeconds: 60, totalSeconds: 600 }), 3))
      .toBe(START + 180_000);
  });

  it('ends on the ceiling when the ceiling is the tighter bound', () => {
    expect(examEndsAt(START, settings({ count: 30, perQuestionSeconds: 60, totalSeconds: 120 }), 30))
      .toBe(START + 120_000);
  });

  it('ends exactly when the last question closes', () => {
    const s = settings({ count: 4, perQuestionSeconds: 45, totalSeconds: 3600 });
    expect(examEndsAt(START, s, 4)).toBe(questionDeadline(START, 3, 45));
  });
});

describe('questionsThatFit', () => {
  it('caps the request at what the ceiling allows', () => {
    expect(questionsThatFit({ count: 30, totalSeconds: 600, perQuestionSeconds: 60 })).toBe(10);
  });

  it('leaves the request alone when it already fits', () => {
    expect(questionsThatFit({ count: 4, totalSeconds: 600, perQuestionSeconds: 60 })).toBe(4);
  });

  it('never returns zero, even for an impossible request', () => {
    // A zero here would render an exam with no questions and no explanation; one question at least
    // starts, and the create route clamps the same way.
    expect(questionsThatFit({ count: 10, totalSeconds: 60, perQuestionSeconds: 300 })).toBe(1);
  });

  it('agrees with examEndsAt about what a full paper means', () => {
    const s = settings({ count: 7, perQuestionSeconds: 30, totalSeconds: 600 });
    const fit = questionsThatFit(s);
    expect(examEndsAt(START, { ...s, count: fit }, fit)).toBe(questionDeadline(START, fit - 1, s.perQuestionSeconds));
  });
});
