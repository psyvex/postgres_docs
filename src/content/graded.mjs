/**
 * The one definition of "this block is graded", shared by the three things that must agree:
 * `scripts/verify-lessons.mjs` (CI runs the block and grades the assertion), the lesson page
 * (its progress bar denominator) and the share card (its block count).
 *
 * It is JavaScript with hand-written declarations, like `lib/learn/check.mjs`, because the CI
 * script runs on bare `node` and cannot import a `.ts` — a `.ts` here would mean the verifier
 * keeps its own copy of the rule again, which is how the page ended up counting 25 of `jsonb`'s
 * 40 graded blocks: its old regex was `<SqlBlock(?![^>]*\bstatic\b)[^>]*\bassert=`, and `[^>]*`
 * stops dead at the first `>` inside the SQL, so any block containing `WHERE n > 1`, `->>` or
 * `#>` vanished from the reader's progress bar while still being graded in CI.
 *
 * The rule, in words: a `<SqlBlock … sql={`…`} … />` that is self-closing, is not `static`, and
 * carries an `assert` array **on one line**. A block written any other way is not executed and
 * not graded, so it must not be counted in a denominator either — a progress bar that promises a
 * check the verifier will never run is worse than one that runs fewer.
 */

/** @typedef {{ attrs: string, sql: string, title: string, persona: string, isStatic: boolean, isGraded: boolean }} SqlBlockFragment */

/** Self-closing `<SqlBlock>` with a template-literal `sql`. Group 1 = attrs before `sql`, 2 = SQL, 3 = attrs after. */
export const SQL_BLOCK = /<SqlBlock\b([\s\S]*?)sql=\{`([\s\S]*?)`\}([\s\S]*?)\/>/g;

/** Asserts are authored on one line: `assert={[{ rows: 7 }, { error: 'permission denied' }]}`. No `/g` — this one is `.test()`ed. */
export const ASSERT_ATTR = /assert=\{(\[[^\n]*\])\}/;

/** Parse one match into the fields every consumer needs. */
const fragment = (m) => {
  const attrs = m[1] + m[3];
  return {
    attrs,
    sql: m[2],
    title: attrs.match(/title="([^"]*)"/)?.[1] ?? '(untitled)',
    persona: attrs.match(/\bas="([^"]*)"/)?.[1] ?? 'owner',
    isStatic: /\bstatic\b/.test(attrs),
    isGraded: ASSERT_ATTR.test(attrs),
  };
};

/** Every `<SqlBlock>` in a lesson, in file order — including the prose-only ones. */
export function sqlBlocks(mdx) {
  return [...mdx.matchAll(SQL_BLOCK)].map(fragment);
}

/** Every runnable, asserted block in a lesson, in file order — the order CI executes them in. */
export function gradedBlocks(mdx) {
  return sqlBlocks(mdx).filter((b) => !b.isStatic && b.isGraded);
}

/** How many blocks the reader can actually solve, which is the denominator their progress bar uses. */
export function countGradedBlocks(mdx) {
  return gradedBlocks(mdx).length;
}
