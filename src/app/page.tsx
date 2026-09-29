'use client';

import { useState } from 'react';
import { ArrowRight, Database, ShieldCheck, Users, Zap, Radio, Play, RotateCcw, Terminal, LockKeyhole, Workflow } from 'lucide-react';

const topics = [
  { id: 'rls', title: 'Row-Level Security', icon: ShieldCheck, color: 'var(--cyan)', desc: 'See PostgreSQL filter rows in real time.' },
  { id: 'roles', title: 'Roles & Permissions', icon: Users, color: 'var(--purple)', desc: 'Understand table privileges vs row policies.' },
  { id: 'functions', title: 'Database Functions', icon: Zap, color: 'var(--green)', desc: 'Move reusable logic close to the data.' },
  { id: 'triggers', title: 'Triggers', icon: Workflow, color: 'var(--orange)', desc: 'Watch database events become automation.' },
];

const rows = [
  { id: '101', tenant: 'Acme', amount: '$120.00' },
  { id: '102', tenant: 'Acme', amount: '$340.00' },
  { id: '201', tenant: 'Globex', amount: '$900.00' },
  { id: '202', tenant: 'Globex', amount: '$75.00' },
];

export default function Home() {
  const [tenant, setTenant] = useState<'Acme' | 'Globex'>('Acme');
  const [rlsEnabled, setRlsEnabled] = useState(true);
  const [running, setRunning] = useState(false);
  const [query, setQuery] = useState('SELECT * FROM orders;');

  const visibleRows = rlsEnabled ? rows.filter(r => r.tenant === tenant) : rows;

  const runQuery = () => {
    setRunning(true);
    window.setTimeout(() => setRunning(false), 900);
  };

  return (
    <main className="min-h-screen grid-bg">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[#070b12]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-[var(--cyan)]"><Database size={18}/></div>
            <div><div className="text-sm font-semibold tracking-wide">PostgreSQL Security Lab</div><div className="text-[11px] text-[var(--muted)]">Interactive developer session</div></div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-xs text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"/> Demo DB connected</div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] grid-cols-[220px_1fr] gap-5 p-6">
        <aside className="glass sticky top-24 h-[calc(100vh-7rem)] rounded-2xl p-3">
          <div className="mb-3 px-3 pt-2 text-[10px] font-semibold uppercase tracking-[.2em] text-[var(--muted)]">Labs</div>
          <nav className="space-y-1">
            {topics.map(t => {
              const Icon=t.icon;
              return <button key={t.id} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-white/[.04] ${t.id==='rls'?'bg-white/[.05]':''}`}>
                <Icon size={16} style={{color:t.color}}/><span className="text-xs text-slate-300">{t.title}</span><ArrowRight size={13} className="ml-auto opacity-0 transition group-hover:opacity-60"/>
              </button>
            })}
          </nav>
          <div className="my-4 border-t border-[var(--line)]"/>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/[.04]"><Terminal size={16} className="text-slate-400"/><span className="text-xs text-slate-300">SQL Playground</span></button>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/[.04]"><Radio size={16} className="text-slate-400"/><span className="text-xs text-slate-300">Presenter Mode</span></button>
        </aside>

        <section className="min-w-0 space-y-5">
          <div className="glass relative overflow-hidden rounded-2xl p-7 glow-cyan">
            <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl"/>
            <div className="relative max-w-3xl">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.2em] text-[var(--cyan)]"><LockKeyhole size={14}/> Lab 01 · Row-Level Security</div>
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">Who can see which rows?</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Explore tenant isolation as if PostgreSQL were sitting beside you. Change the user context, run a query, then deliberately break the policy.</p>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
            <div className="glass rounded-2xl p-5">
              <div className="mb-4 flex items-center justify-between"><div><div className="text-sm font-semibold">Request context</div><div className="text-xs text-[var(--muted)]">This becomes the database session context.</div></div><div className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-[10px] text-slate-400">session #42</div></div>
              <div className="grid grid-cols-2 gap-3">
                {(['Acme','Globex'] as const).map(t => <button key={t} onClick={()=>setTenant(t)} className={`rounded-xl border p-4 text-left transition ${tenant===t?'border-cyan-400/40 bg-cyan-400/[.07]':'border-[var(--line)] bg-black/10 hover:bg-white/[.03]'}`}><div className="flex items-center justify-between"><span className="text-sm font-medium">{t}</span>{tenant===t&&<span className="text-[10px] text-cyan-300">ACTIVE</span>}</div><div className="mt-1 text-xs text-[var(--muted)]">tenant_id = {t==='Acme'?'a1':'b2'}</div></button>)}
              </div>

              <div className="my-5 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-black/20 p-3">
                <div className={`grid h-9 w-9 place-items-center rounded-lg ${rlsEnabled?'bg-emerald-400/10 text-emerald-300':'bg-red-400/10 text-red-300'}`}><ShieldCheck size={17}/></div>
                <div className="flex-1"><div className="text-xs font-medium">RLS policy</div><div className="text-[11px] text-[var(--muted)]">tenant_isolation</div></div>
                <button onClick={()=>setRlsEnabled(v=>!v)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${rlsEnabled?'bg-emerald-400/10 text-emerald-300':'bg-red-400/10 text-red-300'}`}>{rlsEnabled?'Enabled':'Broken'}</button>
              </div>

              <div className="rounded-xl border border-[var(--line)] bg-[#05080d] p-4">
                <div className="mb-3 flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-slate-500">SQL editor</span><button onClick={()=>setQuery('SELECT * FROM orders;')} className="text-[10px] text-slate-500 hover:text-white">reset</button></div>
                <textarea value={query} onChange={e=>setQuery(e.target.value)} spellCheck={false} className="h-24 w-full resize-none bg-transparent font-mono text-xs leading-6 text-slate-200 outline-none" />
                <div className="mt-2 flex justify-end"><button onClick={runQuery} disabled={running} className="flex items-center gap-2 rounded-lg bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"><Play size={13}/>{running?'Executing…':'Run Query'}</button></div>
              </div>
            </div>

            <div className="glass rounded-2xl p-5">
              <div className="mb-4 flex items-center justify-between"><div><div className="text-sm font-semibold">Query result</div><div className="text-xs text-[var(--muted)]">{visibleRows.length} row{visibleRows.length===1?'':'s'} visible to {tenant}</div></div><button onClick={()=>setRlsEnabled(true)} className="rounded-lg border border-[var(--line)] p-2 text-slate-400 hover:text-white"><RotateCcw size={14}/></button></div>
              <div className="overflow-hidden rounded-xl border border-[var(--line)]">
                <div className="grid grid-cols-[1fr_1fr_1fr] bg-white/[.025] px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500"><span>order_id</span><span>tenant</span><span>amount</span></div>
                {visibleRows.map((r,i)=><div key={r.id} className="grid grid-cols-[1fr_1fr_1fr] border-t border-[var(--line)] px-4 py-3 text-xs transition hover:bg-white/[.025]" style={{animation:`float ${2+i*.2}s ease-in-out infinite`}}><span className="font-mono text-slate-300">{r.id}</span><span className={r.tenant===tenant?'text-emerald-300':'text-red-300'}>{r.tenant}</span><span className="text-slate-300">{r.amount}</span></div>)}
              </div>
              <div className={`mt-4 rounded-xl border p-4 ${rlsEnabled?'border-emerald-400/20 bg-emerald-400/[.04]':'border-red-400/25 bg-red-400/[.05]'}`}>
                <div className="flex items-center gap-2 text-xs font-semibold">{rlsEnabled?'🛡️ Policy enforced':'⚠️ Potential data leak'}</div>
                <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">{rlsEnabled?'PostgreSQL is applying tenant_isolation before rows reach the application.':'RLS is disabled. The query can see rows belonging to every tenant.'}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[['1','Change context','Switch between tenants and observe the result.'],['2','Break it','Disable RLS and watch the isolation boundary disappear.'],['3','Explain it','Use the visual flow to explain USING and session context.']].map(([n,t,d])=><div key={n} className="glass rounded-xl p-4"><div className="mb-3 grid h-7 w-7 place-items-center rounded-lg bg-white/[.05] text-xs font-semibold text-slate-300">{n}</div><div className="text-xs font-semibold">{t}</div><div className="mt-1 text-[11px] leading-5 text-[var(--muted)]">{d}</div></div>)}
          </div>
        </section>
      </div>
    </main>
  );
}
