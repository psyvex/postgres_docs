'use client';

/**
 * Lesson-level progress bar: "3 of 8 checks solved" with a bar and a Mark complete toggle.
 * Rendered in the lesson header, below the track · minutes · version meta row.
 */
import clsx from 'clsx';
import { CheckCircle2, Circle } from 'lucide-react';
import { useProgress } from '@/lib/learn/progress';
import { useToggleLesson } from '@/lib/learn/progress';

type Props = {
  slug: string;
  /** Total checkable blocks in this lesson, passed from the server at render time. */
  totalChecks: number;
};

export function LessonProgress({ slug, totalChecks }: Props) {
  const progress = useProgress();
  const { done, toggle } = useToggleLesson(slug);
  const passedChecks = Object.keys(progress.checks).filter((k) => k.startsWith(`/learn/${slug}#`)).length;
  const pct = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

  return (
    <div className="mt-3 flex items-center gap-3">
      {/* Progress bar */}
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-good transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Count */}
      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted">
        {passedChecks}/{totalChecks}
      </span>

      {/* Mark complete */}
      <button
        onClick={toggle}
        title={done ? 'Mark lesson incomplete' : 'Mark lesson complete'}
        className={clsx(
          'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors',
          done ? 'border-good/40 bg-good-soft text-good' : 'border-line text-muted hover:border-good/40 hover:text-good',
        )}
      >
        {done ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
        {done ? 'Done' : 'Complete'}
      </button>
    </div>
  );
}
