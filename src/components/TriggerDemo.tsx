'use client';

import { useMemo, useState } from 'react';
import { DatabaseZap, Play, Plus, Trash2 } from 'lucide-react';
import { triggerDemoCopy, triggerDemoDefaults } from '@/config/trigger-demo';
import { buildTriggerEventStatement, type TriggerExecutionRequest } from '@/lib/trigger-execution';
import { updatePayload, type TriggerPayload } from '@/lib/trigger-demo';

type Connection = TriggerExecutionRequest['connection'];

export function TriggerDemo({ connection }: { connection?: Connection }) {
  const [schema, setSchema] = useState(triggerDemoDefaults.schema);
  const [table, setTable] = useState(triggerDemoDefaults.table);
  const [payload, setPayload] = useState<TriggerPayload>(triggerDemoDefaults.payload);
  const [result, setResult] = useState<{ ok: boolean; rows?: Record<string, unknown>[]; rowCount?: number | null; error?: string } | null>(null);
  const [running, setRunning] = useState(false);
  const sql = useMemo(() => { try { return buildTriggerEventStatement({ connection: connection as Connection, schema, table, event: 'INSERT', payload }); } catch (error) { return error instanceof Error ? error.message : ''; } }, [connection, schema, table, payload]);
  const fire = async () => {
    if (!connection) { setResult({ ok: false, error: triggerDemoCopy.connectionRequired }); return; }
    setRunning(true); setResult(null);
    try {
      const response = await fetch('/api/postgres/trigger-event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...connection, schema, table, event: 'INSERT', payload }) });
      setResult(await response.json());
    } catch (error) { setResult({ ok: false, error: error instanceof Error ? error.message : 'Trigger event failed.' }); }
    finally { setRunning(false); }
  };
  return <div className="glass rounded-2xl p-5"><div className="flex items-start justify-between"><div><div className="text-sm font-semibold">{triggerDemoCopy.title}</div><div className="text-[10px] text-slate-500">Fire a database event and inspect the trigger chain.</div></div><DatabaseZap size={18} className="text-cyan-300"/></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-[10px] text-slate-400">Schema<input value={schema} onChange={(e) => setSchema(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2 text-xs text-white"/></label><label className="text-[10px] text-slate-400">Table<input value={table} onChange={(e) => setTable(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2 text-xs text-white"/></label></div><div className="mt-5 flex items-center justify-between"><div className="text-[10px] font-semibold text-slate-400">{triggerDemoCopy.payload}</div><button onClick={() => setPayload((current) => ({ ...current, [`field_${Object.keys(current).length + 1}`]: '' }))} className="text-[10px] text-cyan-300"><Plus size={12} className="mr-1 inline"/>Add field</button></div><div className="mt-2 space-y-2">{Object.entries(payload).map(([key, value]) => <div key={key} className="grid grid-cols-[1fr_1fr_auto] gap-2"><input value={key} onChange={(e) => { const next = { ...payload }; delete next[key]; next[e.target.value] = value; setPayload(next); }} className="rounded-lg border border-[var(--line)] bg-black/20 px-2 py-2 text-xs text-white"/><input value={value == null ? 'null' : String(value)} onChange={(e) => setPayload((current) => updatePayload(current, key, e.target.value))} className="rounded-lg border border-[var(--line)] bg-black/20 px-2 py-2 text-xs text-white"/><button onClick={() => setPayload((current) => { const next = { ...current }; delete next[key]; return next; })} className="text-slate-500"><Trash2 size={14}/></button></div>)}</div><div className="mt-5 rounded-xl border border-[var(--line)] bg-black/20 p-4"><div className="mb-2 text-[10px] font-semibold text-slate-400">{triggerDemoCopy.generatedSql}</div><pre className="overflow-x-auto text-[10px] leading-5 text-cyan-100">{sql}</pre></div><button onClick={fire} disabled={running || !connection} className="mt-4 rounded-xl bg-cyan-300 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-40"><Play size={13} className="mr-1 inline"/>{running ? 'Running…' : triggerDemoCopy.execute}</button>{result && <div className={`mt-4 rounded-xl border p-4 ${result.ok ? 'border-emerald-300/20' : 'border-red-300/20'}`}><div className="text-xs font-semibold">{result.ok ? triggerDemoCopy.result : 'Event failed'}</div>{result.error && <div className="mt-2 text-[10px] text-red-200">{result.error}</div>}{result.ok && <pre className="mt-2 overflow-x-auto text-[9px] text-slate-400">{JSON.stringify({ rowCount: result.rowCount, rows: result.rows }, null, 2)}</pre>}</div>}</div>;
}
