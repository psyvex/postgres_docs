import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { countGradedBlocks } from './graded';

/**
 * Server-only facts about a lesson's source file, read once at build time.
 *
 * The page and the share card both call this, so the card's "40 graded checks" and the page's
 * `n/40` progress bar can never disagree — both come from one `readFileSync` and one rule.
 * The `try` fallback is for `next dev` with a missing file (a registry row written before the
 * lesson exists): the page still renders, the bar shows nothing countable, and the card shows
 * no count rather than a fabricated one.
 */
export function lessonMeta(slug: string) {
  try {
    const raw = readFileSync(path.join(process.cwd(), 'src/content/topics', `${slug}.mdx`), 'utf8');
    return {
      /** Feeds the AI answer cache: a re-translated or edited lesson must not replay an old memo. */
      version: createHash('sha1').update(raw).digest('hex').slice(0, 12),
      length: raw.length,
      /** Blocks with a one-line `assert` that a learner can actually solve. */
      gradedCount: countGradedBlocks(raw),
    };
  } catch {
    return { version: 'dev', length: 20_000, gradedCount: 0 };
  }
}
