import type { RunResult } from '@/lib/db/types';

/**
 * Declarations for `check.mjs` — see the note there for why the implementation is JavaScript.
 * Keep this file and `check.mjs` in step; the verifier imports the `.mjs` directly.
 */
export type Check = {
  /** Exact row count of the last result table the learner sees. */
  rows?: number;
  /** Minimum row count of that table. */
  rowsAtLeast?: number;
  /** Rows affected by a statement that returns no table (`UPDATE 0`, `DELETE 3`). */
  affected?: number;
  /** The SQL must fail, with this text in the message. */
  error?: string;
  /** First row, first column of the last table, compared as text. */
  firstCell?: string | number | boolean | null;
  /** Column names of the last table, in order. */
  columns?: string[];
};

export type Grade = { passed: boolean; failures: string[] };

/** Authoring mistakes — a typo'd key is an empty check, which passes for everybody. */
export declare function checkProblems(checks: unknown): string[];

/** Grade a run against a block's checks. `skip` drops the session-setup statements, as `ResultView` does. */
export declare function gradeChecks(result: RunResult, checks: Check[], skip?: number): Grade;

/** What the block demands, in one line. */
export declare function describeChecks(checks: Check[]): string;
