'use client';

import { useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { runSql } from '@/lib/db/store';
import { SEED_SQL } from '@/lib/db/seed';
import { Icon } from '@/components/icons';

/** Lesson starter: rebuilds the `lab` schema so every example behaves as written. */
export function ResetDemo() {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | string>('idle');
  const reset = async () => {
    setState('busy');
    const r = await runSql(SEED_SQL);
    setState(r.ok ? 'done' : r.error);
  };
  return (
    <div className="not-prose my-6 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-brand/40 bg-brand-soft/40 px-4 py-3 text-sm">
      <Icon name="lab" size={22} className="text-brand" />
      <span className="min-w-0 flex-1">
        Examples on this page build on each other. Start from a clean <code className="font-mono">lab</code> schema: 4 members, 2 organizations, 7 tasks.
      </span>
      <button onClick={reset} disabled={state === 'busy'} className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-xs font-bold text-on-brand">
        {state === 'busy' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
        {state === 'done' ? 'Fresh' : 'Reset demo data'}
      </button>
      {state !== 'idle' && state !== 'busy' && state !== 'done' && <span className="w-full text-xs text-bad">{state}</span>}
    </div>
  );
}
