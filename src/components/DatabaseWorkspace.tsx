'use client';

import { useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { databaseWorkspaceCopy, databaseWorkspaceTabs } from '@/config/database-workspace';
import { PostgresConnectionPanel } from './PostgresConnectionPanel';
import { TableBuilder } from './TableBuilder';

type Connection = { host: string; port: number; database: string; username: string; password: string; sslMode: string };
type Table = { schema: string; name: string; columns: Array<{ name: string; type: string; nullable: boolean }> ; policies: unknown[]; triggers: unknown[] };

export function DatabaseWorkspace() {
  const [tab, setTab] = useState('connection');
  const [connected, setConnected] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(false);

  async function refreshSchema() {
    if (!connection) return;
    setLoading(true);
    try {
      const response = await fetch('/api/postgres/schema', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(connection) });
      const data = await response.json();
      if (data.ok) setTables(data.tables);
    } finally { setLoading(false); }
  }

  return <section className="glass rounded-2xl p-5"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-300/10 p-2 text-cyan-300"><Database size={18}/></div><div><div className="text-sm font-semibold">{databaseWorkspaceCopy.title}</div><div className="text-[10px] text-slate-500">{connected ? databaseWorkspaceCopy.liveBadge : databaseWorkspaceCopy.disconnectedBadge}</div></div></div>{connected && <button onClick={refreshSchema} disabled={loading} className="rounded-xl border border-[var(--line)] px-3 py-2 text-[10px] text-slate-300"><RefreshCw size={12} className={`mr-1 inline ${loading ? 'animate-spin' : ''}`}/>{databaseWorkspaceCopy.refresh}</button>}</div><div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-[var(--line)] bg-black/10 p-1">{databaseWorkspaceTabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`rounded-lg px-3 py-2 text-[10px] transition ${tab === item.id ? 'bg-white/[.08] text-cyan-200' : 'text-slate-500'}`}>{item.label}</button>)}</div>{tab === 'connection' && <PostgresConnectionPanel onConnected={(nextConnection) => { setConnection(nextConnection); setConnected(true); setTab('schema'); }} onSchema={(nextTables) => setTables(nextTables)} />}{tab === 'schema' && <div className="space-y-2">{tables.length === 0 ? <div className="rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-[11px] text-slate-500">No tables loaded. Refresh the schema after connecting.</div> : tables.map((table) => <details key={`${table.schema}.${table.name}`} className="rounded-xl border border-[var(--line)] bg-black/10 p-4"><summary className="cursor-pointer text-xs text-slate-200">{table.schema}.{table.name}</summary><div className="mt-3 space-y-1">{table.columns.map((column) => <div key={column.name} className="flex justify-between text-[10px] text-slate-500"><span>{column.name}</span><span>{column.type}{column.nullable ? '' : ' · NOT NULL'}</span></div>)}<div className="pt-2 text-[10px] text-emerald-300">RLS policies: {table.policies.length}</div><div className="text-[10px] text-orange-300">Triggers: {table.triggers.length}</div></div></details>)}</div>}{tab === 'table' && <TableBuilder connection={connection ?? { host: '', port: 5432, database: '', username: '', password: '', sslMode: 'prefer' }} onCreated={refreshSchema} />}</section>;
}
