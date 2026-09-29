'use client';

import { ChevronDown, ChevronRight, Database, FolderTree, FunctionSquare, Table2, Zap } from 'lucide-react';
import { useState } from 'react';

const groups = [
  { id: 'schemas', label: 'Schemas', icon: FolderTree, children: ['public'] },
  { id: 'tables', label: 'Tables', icon: Table2, children: ['orders', 'customers', 'audit_log'] },
  { id: 'functions', label: 'Functions', icon: FunctionSquare, children: ['set_current_tenant', 'audit_order_change'] },
  { id: 'triggers', label: 'Triggers', icon: Zap, children: ['orders_audit_trigger'] },
] as const;

export function DatabaseExplorer() { const [open, setOpen] = useState<Record<string, boolean>>({ schemas: true, tables: true }); return <section className="flex h-full min-h-0 flex-col bg-[var(--surface)]"><div className="border-b border-[var(--border)] px-3 py-3"><div className="flex items-center gap-2 text-xs font-semibold"><Database size={14} className="text-[var(--accent)]"/> Database</div><div className="mt-1 truncate text-[10px] text-[var(--muted)]">postgres · public</div></div><div className="min-h-0 flex-1 overflow-auto p-2">{groups.map(({ id, label, icon: Icon, children }) => <div key={id} className="mb-1"><button onClick={() => setOpen((state) => ({ ...state, [id]: !state[id] }))} className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">{open[id] ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}<Icon size={13}/>{label}<span className="ml-auto text-[9px] opacity-60">{children.length}</span></button>{open[id] && <div className="ml-5 border-l border-[var(--border)] pl-2">{children.map((child) => <button key={child} className="flex w-full rounded-md px-2 py-1.5 text-left text-[11px] text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">{child}</button>)}</div>}</div>)}</div></section>; }
