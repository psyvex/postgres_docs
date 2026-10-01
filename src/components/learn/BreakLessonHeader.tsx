'use client';

/**
 * Lesson header for break-it labs: a challenge badge (n/m solved) overlaid on the normal
 * progress bar, so the learner sees both the lesson progress and how many challenges they've cracked.
 *
 * The challenge count uses the same `assert=` blocks as the lesson: one `assert` = one
 * challenge. Passing it solves both the challenge and the lesson check simultaneously.
 */
import { useProgress } from '@/lib/learn/progress';
import { LessonProgress } from './LessonProgress';
import { Skull, Trophy } from 'lucide-react';

type Props = {
  slug: string;
  totalChecks: number;
  challengeTotal: number;
};

export function BreakLessonHeader({ slug, totalChecks, challengeTotal }: Props) {
  const progress = useProgress();
  const passedChecks = Object.keys(progress.checks).filter((k) => k.startsWith(`/learn/${slug}#`)).length;
  const solved = passedChecks; // same numerator as LessonProgress
  const challengesSolved = Math.min(solved, challengeTotal); // cannot exceed challenge count

  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      {/* Challenge badge */}
      <div
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold"
        style={{
          borderColor: 'var(--warn)',
          backgroundColor: 'color-mix(in srgb, var(--warn) 10%, transparent)',
          color: 'var(--warn)',
        }}
        title={`${challengesSolved} of ${challengeTotal} challenges solved`}
      >
        <Skull className="h-3.5 w-3.5" />
        <span>Break-it</span>
        <span className="font-mono tabular-nums opacity-75">
          {challengesSolved}/{challengeTotal}
        </span>
        {challengesSolved === challengeTotal && (
          <Trophy className="h-3.5 w-3.5 text-good" />
        )}
      </div>

      {/* Lesson progress bar (covers all checks including challenges) */}
      <div className="flex-1">
        <LessonProgress slug={slug} totalChecks={totalChecks} />
      </div>
    </div>
  );
}
