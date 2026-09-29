'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { loadTables, type TableInfo } from '@/lib/db/introspect';
import { useDbStore } from '@/lib/db/store';
import { Icon } from '@/components/icons';
import { BrandLoader } from '@/components/brand/BrandMark';

/** Live summary of the demo schema so learners see RLS / policies / triggers appear as they run lessons. */
export function MiniSchema() {
  const revision = useDbStore((s) => s.revision);
  const mode = useDbStore((s) => s.mode);
  const [tables, setTables] = useState<TableInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadTables()
      .then((t) => alive && (setTables(t.filter((x) => x.schema === 'lab')), setError(null)))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [revision, mode]);

  return (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Live schema · lab</div>
      {error && <div className="text-xs text-bad">{error}</div>}
      {!tables && !error && <BrandLoader size={36} label="Starting database…" className="py-4 text-xs" />}
      <ul className="space-y-1.5">
        {tables?.map((t) => (
          <li key={t.name} className="rounded-xl border border-line bg-surface p-2">
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
              {t.name}
              <span className={clsx('ml-auto rounded px-1 text-[10px]', t.rlsEnabled ? 'bg-good-soft text-good' : 'bg-surface-2 text-muted')}>{t.rlsEnabled ? `RLS${t.rlsForced ? '+F' : ''}` : 'no RLS'}</span>
            </div>
            {(t.policies.length > 0 || t.triggers.length > 0) && (
              <div className="mt-1 flex flex-wrap gap-1">
                {t.policies.map((p) => <span key={p.name} className="inline-flex items-center gap-0.5 rounded bg-brand-soft px-1 font-mono text-[10px] text-brand"><Icon name="rls" /> {p.name}</span>)}
                {t.triggers.map((tg) => <span key={tg.name} className="inline-flex items-center gap-0.5 rounded bg-accent-soft px-1 font-mono text-[10px] text-accent"><Icon name="trigger" /> {tg.name}</span>)}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
