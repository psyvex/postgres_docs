'use client';

import { useState } from 'react';
import { CheckCircle2, Database, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { databaseConnectionDefaults, databaseConnectionFields, sslModes } from '@/config/database';

type Config = { host: string; port: number; database: string; username: string; password: string; sslMode: string };

type Props = { onConnected?: (config: Config) => void; onSchema?: (tables: any[]) => void };

export function PostgresConnectionPanel({ onConnected, onSchema }: Props) {
  const [config, setConfig] = useState<Config>({ host: '', port: databaseConnectionDefaults.port, database: '', username: '', password: '', sslMode: databaseConnectionDefaults.sslMode });
  const [status, setStatus] = useState<{ ok: boolean; message: string; latencyMs?: number } | null>(null);
  const [loading, setLoading] = useState(false);

  async function testConnection() {
    setLoading(true); setStatus(null);
    try {
      const response = await fetch('/api/postgres/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(config) });
      const data = await response.json();
      if (data.ok) { setStatus({ ok: true, message: `${data.database} · ${data.user}`, latencyMs: data.latencyMs }); onConnected?.(config); }
      else setStatus({ ok: false, message: data.error });
    } catch { setStatus({ ok: false, message: 'Unable to reach the server.' }); }
    finally { setLoading(false); }
  }

  async function inspectSchema() {
    setLoading(true);
    try {
      const response = await fetch('/api/postgres/schema', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(config) });
      const data = await response.json();
      if (data.ok) { onSchema?.(data.tables); onConnected?.(config); setStatus({ ok: true, message: `${data.tables.length} tables loaded` }); }
      else setStatus({ ok: false, message: data.error });
    } catch { setStatus({ ok: false, message: 'Schema inspection failed.' }); }
    finally { setLoading(false); }
  }

  return <div className="glass rounded-2xl p-5"><div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-cyan-300/10 p-2 text-cyan-300"><Database size={18}/></div><div><div className="text-sm font-semibold">PostgreSQL connection</div><div className="text-[10px] text-slate-500">Credentials are sent to the server only for the requested database operation.</div></div></div><div className="grid gap-3 sm:grid-cols-2">{databaseConnectionFields.map((field) => <label key={field.id} className="text-[10px] text-slate-400">{field.label}<input type={field.type} placeholder={field.placeholder} value={(config as any)[field.id]} onChange={(event) => setConfig((current) => ({ ...current, [field.id]: field.id === 'port' ? Number(event.target.value) : event.target.value }))} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-cyan-300/40"/></label>)}</div><label className="mt-3 block text-[10px] text-slate-400">SSL Mode<select value={config.sslMode} onChange={(event) => setConfig((current) => ({ ...current, sslMode: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2 text-xs text-white outline-none">{sslModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></label><div className="mt-4 flex flex-wrap gap-2"><button onClick={testConnection} disabled={loading} className="rounded-xl bg-cyan-300 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={14}/> : 'Test Connection'}</button><button onClick={inspectSchema} disabled={loading} className="rounded-xl border border-[var(--line)] px-4 py-2 text-[10px] text-slate-300 disabled:opacity-50"><RefreshCw size={13} className="mr-1 inline"/>Inspect Schema</button></div>{status && <div className={`mt-4 flex items-center gap-2 rounded-xl border p-3 text-xs ${status.ok ? 'border-emerald-300/20 bg-emerald-300/[.05] text-emerald-200' : 'border-red-300/20 bg-red-300/[.05] text-red-200'}`}>{status.ok ? <CheckCircle2 size={15}/> : <XCircle size={15}/>}<span>{status.message}{status.latencyMs !== undefined ? ` · ${status.latencyMs}ms` : ''}</span></div>}</div>;
}
