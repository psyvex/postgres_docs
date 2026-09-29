'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Play, Shield, XCircle } from 'lucide-react';
import { rlsScenarioCopy } from '@/config/rls-scenario';
import { compareScenarioRows, summarizeScenario, type ScenarioRow } from '@/lib/rls-scenario';

type Connection = { host: string; port: number; database: string; username: string; password: string; sslMode: string };

type Props = { connection: Connection; schema: string; table: string; role: string; candidateRows: ScenarioRow[]; query: string };

export function RlsScenarioLab({ connection, schema, table, role, candidateRows, query }: Props) {
  const [tenant, setTenant] = useState('tenant-a');
  const [returnedRows, setReturnedRows] = useState<ScenarioRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const comparison = useMemo(() => compareScenarioRows(candidateRows, returnedRows), [candidateRows, returnedRows]);
  const summary = summarizeScenario(candidateRows, returnedRows);

  async function run() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/postgres/rls/simulate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...connection, simulation: { schema, table, role, query, settings: [{ key: 'app.tenant_id', value: tenant }] } }) });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      setReturnedRows(data.rows ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Scenario failed.'); setReturnedRows([]); }
    finally { setLoading(false); }
  }

  return <div className="glass rounded-2xl p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-semibold">{rlsScenarioCopy.title}</div><div className="text-[10px] text-slate-500">{rlsScenarioCopy.subtitle}</div></div><Shield size={18} className="text-cyan-300"/></div><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]"><label className="text-[10px] text-slate-400">{rlsScenarioCopy.tenant}<input value={tenant} onChange={(e) => setTenant(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2 text-xs text-white"/></label><button onClick={run} disabled={loading} className="self-end rounded-xl bg-cyan-300 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-40"><Play size={13} className="mr-1 inline"/>{rlsScenarioCopy.run}</button></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-[var(--line)] p-3"><div className="text-lg font-semibold">{summary.candidate}</div><div className="text-[10px] text-slate-500">{rlsScenarioCopy.candidateRows}</div></div><div className="rounded-xl border border-emerald-300/20 p-3"><div className="text-lg font-semibold text-emerald-200">{summary.returned}</div><div className="text-[10px] text-slate-500">{rlsScenarioCopy.returnedRows}</div></div><div className="rounded-xl border border-red-300/20 p-3"><div className="text-lg font-semibold text-red-200">{summary.filtered}</div><div className="text-[10px] text-slate-500">{rlsScenarioCopy.filteredRows}</div></div></div>{error && <div className="mt-4 rounded-xl border border-red-300/20 bg-red-300/[.04] p-3 text-xs text-red-200">{error}</div>}<div className="mt-5 space-y-2">{comparison.map((item) => <div key={item.id} className={`flex items-center gap-3 rounded-xl border p-3 transition-all duration-500 ${item.visible ? 'border-emerald-300/20 bg-emerald-300/[.03]' : 'border-red-300/20 bg-red-300/[.03]'}`}>{item.visible ? <CheckCircle2 size={15} className="text-emerald-300"/> : <XCircle size={15} className="text-red-300"/>}<div className="min-w-0 flex-1"><div className="text-[10px] text-slate-300">Row {item.id}</div><pre className="mt-1 overflow-x-auto text-[9px] text-slate-500">{JSON.stringify(item.row)}</pre></div><span className="text-[9px]">{item.visible ? 'ALLOWED' : 'FILTERED'}</span></div>)}</div></div>;
}
