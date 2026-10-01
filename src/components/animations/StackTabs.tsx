'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { useMotionPresets } from '@/lib/motion';

const PREFIX = 'postgres-lab:stack:';

/** The store has no cross-instance events — clicks re-render the tab group that owns them. */
function subscribeNoop() {
  return () => {};
}

/**
 * A named tab group for MDX lessons. Each child is one panel; `tabs[i]` activates
 * `children[i]`, so the two must be the same length and order.
 *
 * `persistKey` is the lesson slug (e.g. "rls"). When set, the selected tab survives
 * navigation via localStorage; the key is registered in `lib/storage/keys.ts` so
 * /settings describes it rather than labelling it "Not described".
 *
 * Persistence reads through `useSyncExternalStore` with an explicit server snapshot
 * (the `useT` idiom, `lib/i18n/useT.ts`): the hydration render always shows
 * `tabs[0]`, matching the prerendered HTML, and React swaps to the stored tab right
 * after. A `useState(() => localStorage.getItem(...))` initializer would differ
 * between server and client on the very first render — React #418.
 *
 * Panels unmount when hidden, so a `SqlBlock` inside a closed tab costs nothing
 * until the reader opens it.
 */
export function StackTabs({
  tabs,
  persistKey,
  children,
}: {
  tabs: { id: string; label: string }[];
  persistKey?: string;
  children: React.ReactNode;
}) {
  const { tab: swap } = useMotionPresets();
  const defaultId = tabs[0]?.id ?? '';
  const storageKey = persistKey ? PREFIX + persistKey : null;

  const getSnapshot = useCallback(() => {
    if (!storageKey) return null;
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null; // private mode / disabled storage
    }
  }, [storageKey]);

  const stored = useSyncExternalStore(subscribeNoop, getSnapshot, () => null);
  // Clicks win over storage within this mount; storage wins across mounts.
  const [picked, setPicked] = useState<string | null>(null);
  const candidate = picked ?? stored;
  const active = candidate && tabs.some((t) => t.id === candidate) ? candidate : defaultId;

  const switchTo = (id: string) => {
    setPicked(id);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, id);
      } catch {
        // ignore — the tab still switches for this session
      }
    }
  };

  const panels = Array.isArray(children) ? children : [children];
  const activeIndex = tabs.findIndex((t) => t.id === active);
  const panel = activeIndex >= 0 ? panels[activeIndex] : null;

  return (
    <div className="my-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      {/* Tab strip — same visual language as the Playground bottom-panel tabs (border-b-2 active) */}
      <div
        className="flex items-center gap-0 overflow-x-auto border-b border-line bg-surface-2 px-3"
        role="tablist"
        aria-label="Implementation stack"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            aria-controls={`stack-panel-${active === t.id ? t.id : ''}`}
            onClick={() => switchTo(t.id)}
            className={clsx(
              'shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-3 py-2 text-xs font-semibold transition-colors',
              active === t.id
                ? 'border-brand text-brand'
                : 'border-transparent text-muted hover:text-text',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={active}
          id={`stack-panel-${active}`}
          role="tabpanel"
          className="min-w-0 px-4 py-4"
          {...swap}
        >
          {panel}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
