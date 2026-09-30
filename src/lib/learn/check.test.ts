import { describe, expect, it } from 'vitest';
import { checkProblems, describeChecks, gradeChecks } from './check';

// Helpers ---------------------------------------------------------------------

/** A successful SELECT returning `rows` rows with column `cols` (default one string column "v"). */
const sel = (rows: number, cols: string[] = ['v']): import('@/lib/db/types').RunResult => ({
  ok: true,
  durationMs: 2,
  results: [{ columns: cols, rows: Array.from({ length: rows }, (_, i) => ({ v: String(i + 1) })), rowCount: rows }],
});

/** A successful DML returning `affected` rows with no table. */
const cmd = (affected: number): import('@/lib/db/types').RunResult => ({
  ok: true,
  durationMs: 1,
  results: [{ columns: [], rows: [], rowCount: affected }],
});

/** A failing statement. */
const fail = (error: string): import('@/lib/db/types').RunResult => ({
  ok: false,
  error,
  durationMs: 0,
});

const PASS = { passed: true, failures: [] };

// `checkProblems` ----------------------------------------------------------------

describe('checkProblems', () => {
  it('passes a valid check array', () => {
    expect(checkProblems([{ rows: 4 }, { error: 'permission denied' }])).toEqual([]);
  });

  // `toContain` on an array is element equality, so match the whole sentence.
  it('catches a non-array', () => {
    expect(checkProblems(null)).toEqual(['assert must be an array of check objects']);
    expect(checkProblems({ rows: 4 })).toEqual(['assert must be an array of check objects']);
  });

  it('catches an empty array', () => {
    expect(checkProblems([])[0]).toMatch(/^assert is empty/);
  });

  it('catches unknown keys', () => {
    expect(checkProblems([{ rows: 4, rowCount: 4 }])).toEqual(['assert[0] has unknown key(s): rowCount']);
    expect(checkProblems([{ rowCounts: 4 }])[0]).toMatch(/has no usable key \(got: rowCounts\)/);
  });

  it('catches wrong types', () => {
    expect(checkProblems([{ rows: '4' }])).toEqual(['assert[0].rows must be a number']);
    expect(checkProblems([{ affected: '0' }])).toEqual(['assert[0].affected must be a number']);
    expect(checkProblems([{ columns: 'v' }])).toEqual(['assert[0].columns must be an array of names']);
  });
});

// `describeChecks` ----------------------------------------------------------------

describe('describeChecks', () => {
  it('describes every check type', () => {
    expect(describeChecks([{ rows: 4 }, { affected: 2 }, { error: 'denied' }, { firstCell: 7 }, { columns: ['a', 'b'] }]))
      .toBe('exactly 4 rows; 2 rows affected; fails with "denied"; first cell 7; columns a, b');
  });

  it('is empty for non-arrays', () => expect(describeChecks(null as unknown as never)).toBe(''));

  it('pluralises correctly', () => {
    expect(describeChecks([{ rows: 1 }, { affected: 0 }])).toBe('exactly 1 row; 0 rows affected');
  });
});

// `gradeChecks` — success paths ----------------------------------------------------------------

describe('gradeChecks: rows', () => {
  it('passes when the row count matches', () => {
    expect(gradeChecks(sel(4), [{ rows: 4 }])).toEqual(PASS);
  });

  it('fails when the row count is wrong', () => {
    const r = gradeChecks(sel(4), [{ rows: 7 }]);
    expect(r.passed).toBe(false);
    expect(r.failures[0]).toContain('expected exactly 7 row(s), got 4');
  });

  it('fails when no statement returned a table', () => {
    const r = gradeChecks(cmd(0), [{ rows: 0 }]);
    expect(r.passed).toBe(false);
    expect(r.failures[0]).toContain('expected 0 row(s), but no statement returned a table');
  });

  it('passes rowsAtLeast when the count is at least the threshold', () => {
    expect(gradeChecks(sel(3), [{ rowsAtLeast: 3 }])).toEqual(PASS);
    expect(gradeChecks(sel(10), [{ rowsAtLeast: 3 }])).toEqual(PASS);
  });

  it('fails rowsAtLeast when the count is below the threshold', () => {
    const r = gradeChecks(sel(2), [{ rowsAtLeast: 3 }]);
    expect(r.passed).toBe(false);
    expect(r.failures[0]).toContain('expected at least 3 row(s), got 2');
  });

  it('skips leading session-setup statements', () => {
    // The RLS lesson's alice query runs with prefix (skip=3) — the SELECT is last with columns.
    const r: import('@/lib/db/types').RunResult = {
      ok: true,
      durationMs: 1,
      results: [
        { columns: ['?column?'], rows: [{ '?column?': '1' }], rowCount: null },
        { columns: ['id'], rows: [{ id: 1 }, { id: 2 }], rowCount: 2 }, // last table
      ],
    };
    expect(gradeChecks(r, [{ rows: 2 }], 1)).toEqual(PASS); // skip 1 → finds id table
    expect(gradeChecks(r, [{ rows: 1 }], 1)).toMatchObject({ passed: false });
  });
});

describe('gradeChecks: affected', () => {
  it('passes when the affected count matches', () => {
    expect(gradeChecks(cmd(0), [{ affected: 0 }])).toEqual(PASS);
    expect(gradeChecks(cmd(3), [{ affected: 3 }])).toEqual(PASS);
  });

  it('fails when every statement returned a table (nothing to count)', () => {
    const r = gradeChecks(sel(2), [{ affected: 2 }]);
    expect(r.passed).toBe(false);
    expect(r.failures[0]).toContain('expected 2 row(s) affected, but every statement returned a table');
  });

  it('fails when the affected count is wrong', () => {
    const r = gradeChecks(cmd(1), [{ affected: 0 }]);
    expect(r.passed).toBe(false);
    expect(r.failures[0]).toContain('expected 0 row(s) affected, got 1');
  });
});

describe('gradeChecks: columns', () => {
  it('passes when the column names match', () => {
    expect(gradeChecks(sel(0, ['id', 'title']), [{ columns: ['id', 'title'] }])).toEqual(PASS);
  });

  it('fails when the names are wrong', () => {
    const r = gradeChecks(sel(0, ['id', 'title']), [{ columns: ['name', 'title'] }]);
    expect(r.passed).toBe(false);
    expect(r.failures[0]).toContain('expected columns [name, title], got [id, title]');
  });

  it('fails when no statement returned a table', () => {
    const r = gradeChecks(cmd(0), [{ columns: ['id'] }]);
    expect(r.passed).toBe(false);
    expect(r.failures[0]).toContain('no statement returned a table');
  });
});

describe('gradeChecks: firstCell', () => {
  // `sel(n)` fills column v with '1', '2', … so the first cell of a 1-row result is '1'.
  it('passes when the first cell matches (compared as text)', () => {
    expect(gradeChecks(sel(1), [{ firstCell: '1' }])).toEqual(PASS);
    expect(gradeChecks(sel(1), [{ firstCell: 1 }])).toEqual(PASS); // a bigint arrives as a string
  });

  it('grades the last table, not the first', () => {
    // "Bob deletes a done task, then a todo task": the second DELETE … RETURNING is what is on screen.
    const r: import('@/lib/db/types').RunResult = {
      ok: true,
      durationMs: 1,
      results: [
        { columns: ['id'], rows: [{ id: 3 }], rowCount: 1 },
        { columns: ['id'], rows: [{ id: 4 }], rowCount: 1 },
      ],
    };
    expect(gradeChecks(r, [{ firstCell: 4, rows: 1 }])).toEqual(PASS);
  });

  it('fails when the first cell is wrong', () => {
    const r = gradeChecks(sel(1), [{ firstCell: '99' }]);
    expect(r.passed).toBe(false);
    expect(r.failures[0]).toContain('expected first cell "99", got "1"');
  });

  it('fails when there is no first row', () => {
    const r = gradeChecks(sel(0), [{ firstCell: 'x' }]);
    expect(r.passed).toBe(false);
    expect(r.failures[0]).toContain('expected first cell "x", but there is no first row');
  });
});

// `gradeChecks` — error paths ----------------------------------------------------------------

describe('gradeChecks: error', () => {
  it('passes when the statement fails with matching text', () => {
    expect(gradeChecks(fail('ERROR: permission denied for table tasks'), [{ error: 'permission denied' }])).toEqual(PASS);
    expect(gradeChecks(fail('permission denied for table tasks'), [{ error: 'PERMISSION DENIED' }])).toEqual(PASS); // case-insensitive
  });

  it('fails when the statement succeeded', () => {
    const r = gradeChecks(sel(0), [{ error: 'denied' }]);
    expect(r.passed).toBe(false);
    expect(r.failures[0]).toContain('expected it to fail with "denied", but it succeeded');
  });

  it('fails when the error message does not contain the expected text', () => {
    const r = gradeChecks(fail('syntax error at end of input'), [{ error: 'permission denied' }]);
    expect(r.passed).toBe(false);
    expect(r.failures[0]).toContain('expected the error to contain "permission denied", got "syntax error at end of input"');
  });

  it('reports success in error context (not silently skipped)', () => {
    // A success check mixed with an error check.
    const r = gradeChecks(sel(0), [{ error: 'denied' }, { rows: 0 }]);
    expect(r.passed).toBe(false);
    expect(r.failures[0]).toContain('expected it to fail');
  });
});

// `gradeChecks` — multi-statement ----------------------------------------------------------

describe('gradeChecks: multi-statement', () => {
  it('grades the last statement that has a table', () => {
    // "Bob tries to delete a done task, then a todo task"
    // Both DELETEs have no columns. Grade finds the last no-column statement for `affected`.
    const r: import('@/lib/db/types').RunResult = {
      ok: true,
      durationMs: 1,
      results: [
        { columns: [], rows: [], rowCount: 0 }, // DELETE 1: done → blocked, 0 affected
        { columns: [], rows: [], rowCount: 1 }, // DELETE 2: todo → allowed, 1 affected
      ],
    };
    expect(gradeChecks(r, [{ affected: 1 }])).toEqual(PASS);
    expect(gradeChecks(r, [{ affected: 0 }])).toMatchObject({ passed: false });
  });
});

// `gradeChecks` — authoring guard ----------------------------------------------------------

describe('gradeChecks: authoring guard', () => {
  it('reports problems from checkProblems rather than silently passing', () => {
    // A typo'd key is caught here, not passed as a no-op.
    // Every key unknown → "no usable key" (this check would silently pass as a no-op).
    expect(gradeChecks(sel(4), [{ rowCount: 4 } as never]).failures[0]).toMatch(/has no usable key/);
    // Partly known → the unknown key is named, and the known one is still graded.
    expect(gradeChecks(sel(4), [{ rows: 4, rowCount: 4 } as never]).failures).toEqual([
      'assert[0] has unknown key(s): rowCount',
    ]);
  });
});
