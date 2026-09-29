'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { KeyRound } from 'lucide-react';
import { Segmented } from '@/components/docs/Callout';
import { runSql, useDbStore } from '@/lib/db/store';
import type { RunResult } from '@/lib/db/types';
import { quoteIdent, type TableInfo } from '@/lib/db/introspect';
import { personaContext, withContext } from '@/lib/sql/session';
import { highlightSql } from '@/lib/sql/highlight';
import { ResultView } from '@/components/sql/ResultView';
import { Icon } from '@/components/icons';
import { PersonaSelect } from '@/components/sql/PersonaSelect';
import { BrandLoader } from '@/components/brand/BrandMark';

type Tab = 'data' | 'structure' | 'security';
const PAGE = 200;

export function TableBrowser({ table }: { table: TableInfo }) {
  const revision = useDbStore((s) => s.revision);
  const [tab, setTab] = useState<Tab>('data');
  const [persona, setPersona] = useState('owner');
  const [data, setData] = useState<{ result: RunResult; skip: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const qualified = `${quoteIdent(table.schema)}.${quoteIdent(table.name)}`;

  useEffect(() => {
    if (tab !== 'data') return;
    let alive = true;
    setLoading(true);
    const order = table.columns.find((c) => c.isPk)?.name;
    const { sql, skip } = withContext(`SELECT * FROM ${qualified}${order ? ` ORDER BY ${quoteIdent(order)}` : ''} LIMIT ${PAGE}`, personaContext(persona));
    runSql(sql, { silent: true }).then((result) => {
      if (alive) {
        setData({ result, skip });
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [tab, persona, qualified, table.columns, revision]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <div className="font-mono text-sm font-bold">{table.schema}.{table.name}</div>
        <span className={clsx('rounded px-1.5 py-0.5 text-[10px] font-bold', table.rlsEnabled ? 'bg-good-soft text-good' : 'bg-surface-2 text-muted')}>
          {table.rlsEnabled ? `RLS ${table.rlsForced ? 'forced' : 'on'}` : 'RLS off'}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {tab === 'data' && (
            <PersonaSelect value={persona} onChange={setPersona} prefix="View as" />
          )}
          <Segmented value={tab} onChange={setTab} options={[{ value: 'data', label: 'Data' }, { value: 'structure', label: 'Structure' }, { value: 'security', label: `Security (${table.policies.length + table.triggers.length})` }]} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {tab === 'data' && (loading && !data ? <BrandLoader size={44} label="Loading rows…" className="py-10" /> : data && <ResultView result={data.result} skip={data.skip} />)}

        {tab === 'structure' && (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr><th className="py-1.5">Column</th><th>Type</th><th>Nullable</th></tr>
            </thead>
            <tbody>
              {table.columns.map((c) => (
                <tr key={c.name} className="border-t border-line">
                  <td className="py-1.5 font-mono text-xs font-semibold">
                    <span className="inline-flex items-center gap-1">{c.isPk && <KeyRound className="h-3 w-3 text-warn" />}{c.name}</span>
                  </td>
                  <td className="font-mono text-xs text-brand">{c.type}</td>
                  <td className="text-xs">{c.nullable ? 'yes' : <b>NOT NULL</b>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'security' && (
          <div className="space-y-4">
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted flex items-center gap-1"><Icon name="rls" /> Policies</h3>
              {table.policies.length === 0 && <p className="text-sm text-muted">{table.rlsEnabled ? 'RLS is on with no policies → default deny for non-owners.' : 'No policies.'}</p>}
              <div className="space-y-2">
                {table.policies.map((p) => (
                  <pre key={p.name} className="m-0 overflow-x-auto rounded-xl bg-code-bg p-3 font-mono text-xs text-code-text">
                    {highlightSql(`CREATE POLICY ${p.name} ON ${table.name}\n  AS ${p.permissive} FOR ${p.command} TO ${p.roles.join(', ')}${p.using ? `\n  USING (${p.using})` : ''}${p.check ? `\n  WITH CHECK (${p.check})` : ''};`)}
                  </pre>
                ))}
              </div>
            </section>
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted flex items-center gap-1"><Icon name="trigger" /> Triggers</h3>
              {table.triggers.length === 0 && <p className="text-sm text-muted">No triggers.</p>}
              <ul className="space-y-1">
                {table.triggers.map((t) => (
                  <li key={t.name} className="rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs">
                    <b>{t.name}</b> · {t.timing} {t.events} → {t.fn}()
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
