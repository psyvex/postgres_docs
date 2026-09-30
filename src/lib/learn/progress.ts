/**
 * Learner progress: which lesson checks have passed, and which lessons are finished.
 *
 * Plain localStorage JSON, following the file's own conventions: guarded for SSR (nothing here
 * touches `window` at module scope, so a server render sees an empty progress and the client fills
 * it in — the same "render uncounted first" rule the cache controls use), written with an
 * unversioned key, tolerant of a corrupt payload, and broadcast on the `storage` event so a second
 * tab agrees.
 *
 * Deliberately not zustand/persist: the app's store persists a live database connection, and the
 * `storage` event is known not to fire for its own writes. Progress is 2 small maps that the lesson
 * page, the home page and the sidebar all read, so it gets its own tiny subscription instead of
 * dragging the database store into every lesson page.
 *
 * Keys are `#`-joined paths, not object nesting, so a check id containing dots (a lesson slug has
 * none, but a title has plenty) cannot be mistaken for a path.
 */
import { useCallback, useEffect, useState } from 'react';

const KEY = 'postgres-lab:progress';

export type Progress = {
  /** lesson slug → ISO timestamp it was marked complete */
  lessons: Record<string, string>;
  /** `<pathname>#<block title>` → ISO timestamp its checks passed */
  checks: Record<string, string>;
};

export const emptyProgress = (): Progress => ({ lessons: {}, checks: {} });

/** Singleton empty object for server-side / default render */
export const PROGRESS_EMPTY: Progress = { lessons: {}, checks: {} };

/** Defensive read: a hand-edited or half-written value must never take a lesson page down. */
export function parseProgress(raw: string | null): Progress {
  if (!raw) return emptyProgress();
  try {
    const v = JSON.parse(raw) as Partial<Progress> | null;
    if (!v || typeof v !== 'object') return emptyProgress();
    return {
      lessons: typeof v.lessons === 'object' && v.lessons ? (v.lessons as Record<string, string>) : {},
      checks: typeof v.checks === 'object' && v.checks ? (v.checks as Record<string, string>) : {},
    };
  } catch {
    return emptyProgress();
  }
}

/** The check key a lesson block writes: the page it is on, plus the block's title. */
export function checkKey(pathname: string, title: string): string {
  return `${pathname.replace(/\/$/, '')}#${title}`;
}

// Local subscribers: `storage` fires in *other* tabs only, so a write needs its own notify.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export function readProgress(): Progress {
  if (typeof window === 'undefined') return emptyProgress();
  try {
    return parseProgress(window.localStorage.getItem(KEY));
  } catch {
    return emptyProgress();
  }
}

function commit(next: Progress) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode / quota: progress is a convenience, never a reason to break the lesson.
  }
  notify();
}

export function markLesson(slug: string, done: boolean) {
  const next = readProgress();
  if (done) next.lessons[slug] = new Date().toISOString();
  else delete next.lessons[slug];
  commit(next);
}

export function markCheck(key: string, done: boolean) {
  const next = readProgress();
  if (done) next.checks[key] = new Date().toISOString();
  else delete next.checks[key];
  commit(next);
}

export function clearProgress() {
  commit(emptyProgress());
}

/**
 * Subscribe to progress. Returns the current value and re-renders on any write in this tab
 * (`notify`) or in another (`storage`). Components read it, they do not cache it.
 */
export function useProgress(): Progress {
  const [progress, setProgress] = useState<Progress>(emptyProgress);

  useEffect(() => {
    const sync = () => setProgress(readProgress());
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) sync();
    };
    listeners.add(sync);
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return progress;
}

/** Toggle helper for a "mark complete" button; returns the new state. */
export function useToggleLesson(slug: string) {
  const progress = useProgress();
  const done = slug in progress.lessons;
  const toggle = useCallback(() => markLesson(slug, !done), [slug, done]);
  return { done, toggle };
}
