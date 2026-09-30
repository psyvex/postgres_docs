'use client';

import { useProgress } from '@/lib/learn/progress';

interface ProgressStatsProps {
  totalLessons: number;
  totalChecks: number;
}

export function ProgressStats({ totalLessons, totalChecks }: ProgressStatsProps) {
  const progress = useProgress();
  const completedLessons = Object.keys(progress.lessons).length;
  const passedChecks = Object.keys(progress.checks).length;

  const lessonsFraction = totalLessons > 0 ? completedLessons / totalLessons : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3 text-sm">
        {completedLessons === 0 ? (
          <span className="text-muted">not started</span>
        ) : (
          <span>
            <span className="font-semibold text-good">{completedLessons}</span>
            <span className="text-muted"> of {totalLessons} lessons</span>
          </span>
        )}
        <span className="text-muted">·</span>
        <span>
          <span className="font-semibold">{passedChecks}</span>
          <span className="text-muted"> of {totalChecks} checks solved</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-good transition-all duration-500"
          style={{ width: `${lessonsFraction * 100}%` }}
        />
      </div>
    </div>
  );
}
