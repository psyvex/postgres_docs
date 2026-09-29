'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BrandMark } from './BrandMark';
import { warmLocalDatabase } from '@/lib/db/local-adapter';
import { useDbStore } from '@/lib/db/store';

export const SPLASH_KEY = 'postgres-lab:splash-seen';
const MIN_MS = 2000; // long enough for the full Draw & Fill intro
const MAX_MS = 7000; // never block the app on a slow database start

/**
 * First-load splash: plays the Draw & Fill intro while PGlite boots, then fades into the app.
 * Shown once per browser session; the inline script in layout.tsx hides it before paint on later loads.
 */
export function SplashScreen() {
  const mode = useDbStore((s) => s.mode);
  const [visible, setVisible] = useState(true);
  const [status, setStatus] = useState('Starting PostgreSQL 18 in your browser…');

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SPLASH_KEY) === '1';
    } catch {}
    if (seen) return setVisible(false);

    let alive = true;
    const boot = mode === 'local' ? warmLocalDatabase() : Promise.resolve();
    if (mode !== 'local') setStatus('Connecting to your live database…');
    Promise.race([Promise.all([boot, wait(MIN_MS)]), wait(MAX_MS)])
      .then(() => alive && setStatus('Ready'))
      .catch(() => alive && setStatus('Ready'))
      .finally(() => {
        try {
          sessionStorage.setItem(SPLASH_KEY, '1');
        } catch {}
        setTimeout(() => alive && setVisible(false), 350);
      });
    return () => {
      alive = false;
    };
  }, [mode]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          id="splash"
          key="splash"
          role="status"
          aria-live="polite"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: 'blur(4px)' }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-bg"
        >
          <BrandMark size={132} mode="once" />
          <motion.div className="text-center" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3, duration: 0.4 }}>
            <div className="font-display text-4xl font-extrabold tracking-tight">Postgres Lab</div>
          </motion.div>
          <motion.div className="flex items-center gap-2 text-xs text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>
            {status !== 'Ready' && (
              <span className="flex gap-1" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-brand" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                ))}
              </span>
            )}
            {status}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
