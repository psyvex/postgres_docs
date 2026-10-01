import 'server-only';
import { checkProblems, gradeChecks } from '@/lib/learn/check';
import { gradeAgainstScenario } from './db';
import type { ExamQuestion } from '@/lib/exam/types';

/**
 * Turns a participant's SQL into a score. Deliberately thin: the pass/fail decision belongs to
 * `gradeChecks`, the same module the lesson cards and the CI verifier use, so an answer cannot pass
 * an exam while failing the lesson it was drawn from.
 */

export type GradeResult = {
  correct: boolean;
  score: number;
  /** Why it failed, in the grader's words. Shown to that participant only, never broadcast. */
  detail?: string;
};

/**
 * Time bonus. Answering with two thirds of the window left earns a third of the question's value
 * again; the bonus is half-proportional to time remaining, so speed is worth something but never
 * more than being right. `timeMs` is measured by the server, never reported by the browser.
 */
export function scoreFor(points: number, timeMs: number, timeSeconds: number, timeBonus: boolean): number {
  if (!timeBonus) return points;
  const windowMs = timeSeconds * 1000;
  const remaining = Math.max(0, windowMs - timeMs);
  return points + Math.floor((points * remaining) / windowMs / 2);
}

export type GradeInput = {
  question: ExamQuestion;
  sql: string;
  /** Server-measured milliseconds since the question opened. */
  timeMs: number;
  timeSeconds: number;
  timeBonus: boolean;
};

export async function gradeSubmission({ question, sql, timeMs, timeSeconds, timeBonus }: GradeInput): Promise<GradeResult> {
  const { result } = await gradeAgainstScenario(question.setupSql, sql, question.persona);
  const grade = gradeChecks(result, question.checks);

  if (!grade.passed) {
    return { correct: false, score: 0, detail: grade.failures.join('; ') };
  }
  return { correct: true, score: scoreFor(question.points, timeMs, timeSeconds, timeBonus) };
}

/**
 * Authoring-time validation of one question's oracle.
 *
 * A malformed check is a bank bug, not a participant error, and it fails in the worst available way:
 * an empty or typo'd check passes for everybody, silently awarding points. `checkProblems` catches
 * unknown keys and empty checks; the bank test runs it over every item in the file.
 */
export function authoringProblems(checks: unknown): string[] {
  return checkProblems(checks);
}
