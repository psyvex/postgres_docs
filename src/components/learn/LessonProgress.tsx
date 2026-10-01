'use client';

/**
 * The lesson header progress strip, shared by **every** lesson type.
 *
 * It used to have a sibling, `BreakLessonHeader`, which broke-it labs alone got: a skull badge
 * reading `n/8` where the 8 came from a hand-typed `challengeCount` in the registry and `n` was
 * the *lesson-wide* passed-check count clipped to it. Nothing in a lesson marks which block is
 * "challenge 3", so the badge lit its trophy after any 8 graded blocks passed — a denominator that
 * was invented, not measured. The one number a lesson genuinely has is its asserted-block count,
 * counted from the MDX by `content/graded.mjs` (the same rule CI executes), so every lesson now
 * reports that one honestly and `break` keeps only the visual accent, never a second count.
 *
 * A lesson with no graded blocks shows no bar, no count and no `0/0`: there is nothing to measure,
 * and a gauge whose needle can never move reads to the reader as a broken feature rather than as
 * "nothing here is graded". Every shipped lesson has at least one assert now, so the branch is
 * insurance for a new lesson rather than a description of an existing one — which is deliberate:
 * the alternative is a bar that lies, and the four lessons that used to land here (`triggers`,
 * `roles-and-privileges`, `functions-and-procedures`, `production-security`) each gained a check
 * their own prose already claimed instead. The manual complete toggle survives either way, since
 * marking a read-through lesson done is still meaningful.
 */
import clsx from 'clsx';
import { CheckCircle2, Circle, Skull, Trophy } from 'lucide-react';
import { useProgress, useToggleLesson } from '@/lib/learn/progress';

type Props = {
  slug: string;
  /** Graded blocks in this lesson, counted from its MDX at build time. */
  gradedCount: number;
  /** Break-it labs get the warn accent. It labels the lesson; it does not count anything. */
  variant?: 'default' | 'break';
};

export function LessonProgress({ slug, gradedCount, variant = 'default' }: Props) {
  const progress = useProgress();
  const { done, toggle } = useToggleLesson(slug);
  const passed = Object.keys(progress.checks).filter((k) => k.startsWith(`/learn/${slug}#`)).length;
  const isBreak = variant === 'break';
  const allSolved = gradedCount > 0 && passed >= gradedCount;
  const pct = gradedCount > 0 ? Math.round((passed / gradedCount) * 100) : 0;

  return (
    <div className="mt-3 flex items-center gap-3">
      {isBreak && (
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold"
          style={{
            borderColor: 'var(--warn)',
            backgroundColor: 'color-mix(in srgb, var(--warn) 10%, transparent)',
            color: 'var(--warn)',
          }}
          title={gradedCount > 0 ? `${passed} of ${gradedCount} graded challenges solved` : 'Graded challenges in this lab'}
        >
          <Skull className="h-3.5 w-3.5" />
          Break-it
        </span>
      )}

      {gradedCount > 0 && (
        <>
          {/* Progress bar */}
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className={clsx('h-full rounded-full transition-all duration-300', allSolved ? 'bg-good' : 'bg-good/70')}
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Count */}
          <span className="shrink-0 text-xs font-semibold tabular-nums text-muted">
            {passed}/{gradedCount}
          </span>

          {allSolved && <Trophy className="h-3.5 w-3.5 shrink-0 text-good" aria-label="All graded checks solved" />}
        </>
      )}

      {/* Mark complete */}
      <button
        onClick={toggle}
        title={done ? 'Mark lesson incomplete' : 'Mark lesson complete'}
        className={clsx(
          'flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors',
          done ? 'border-good/40 bg-good-soft text-good' : 'border-line text-muted hover:border-good/40 hover:text-good',
        )}
      >
        {done ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
        {done ? 'Done' : 'Complete'}
      </button>
    </div>
  );
}
