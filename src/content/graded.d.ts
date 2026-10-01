/**
 * Declarations for `graded.mjs`. Keep in sync with the implementation — the rule lives in one
 * file and these types describe it. Same shape as `lib/learn/check.mjs`: the CI verifier imports
 * the `.mjs` path directly (bare `node` cannot read TypeScript), and app code imports `./graded`
 * without an extension, which `moduleResolution: "bundler"` types from this file and resolves at
 * build time to the `.mjs`.
 */

/** One parsed SqlBlock, sufficient for every consumer. */
export interface SqlBlockFragment {
  /** Raw attribute string before `sql`, merged with the string after. */
  attrs: string;
  /** The SQL text inside the backtick template. */
  sql: string;
  /** Human label, or '(untitled)'. */
  title: string;
  /** The persona (`as="alice"`, etc.), or `'owner'`. */
  persona: string;
  /** True when the block has `static` in its attributes. */
  isStatic: boolean;
  /** True when the block has a one-line `assert` array. */
  isGraded: boolean;
}

/** Every `<SqlBlock>` in a lesson, in file order, including the prose-only (`static`) ones. */
export function sqlBlocks(mdx: string): SqlBlockFragment[];

/** Every runnable, asserted block in a lesson, in file order. */
export function gradedBlocks(mdx: string): SqlBlockFragment[];

/** Count of `gradedBlocks(mdx).length`. */
export function countGradedBlocks(mdx: string): number;
