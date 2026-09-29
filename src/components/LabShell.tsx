'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Database, Radio, Terminal, RotateCcw } from 'lucide-react';
import { labs } from '@/lib/lab-config';
import { useLabStore } from '@/lib/store';

export function LabShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reset = useLabStore((state) => state.reset);
  return <main className="min-h-screen grid-bg">
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[#070b12]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-[var(--cyan)]"><Database size={18}/></span>
          <span><strong className="block text-sm tracking-wide">PostgreSQL Security Lab</strong><small className="block text-[11px] text-[var(--muted)]">Interactive developer session</small></span>
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-xs text-slate-400 hover:text-white"><RotateCcw size={13}/> Reset lab</button>
          <span className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-xs text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"/> Demo DB</span>
        </div>
      </div>
    </header>
    <div className="mx-auto grid max-w-[1500px] grid-cols-[220px_1fr] gap-5 p-6">
      <aside className="glass sticky top-24 h-[calc(100vh-7rem)] rounded-2xl p-3">
        <div className="mb-3 px-3 pt-2 text-[10px] font-semibold uppercase tracking-[.2em] text-[var(--muted)]">Labs</div>
        <nav className="space-y-1">
          {labs.map((lab) => <Link key={lab.id} href={`/postgres/${lab.id}`} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-xs transition hover:bg-white/[.04] ${pathname === `/postgres/${lab.id}` ? 'bg-white/[.06] text-white' : 'text-slate-400'}`}><span className="h-2 w-2 rounded-full" style={{ background: lab.color }}/>{lab.title}</Link>)}
        </nav>
        <div className="my-4 border-t border-[var(--line)]"/>
        <Link href="/postgres/playground" className="flex items-center gap-3 rounded-xl px-3 py-3 text-xs text-slate-400 hover:bg-white/[.04]"><Terminal size={15}/> SQL Playground</Link>
        <Link href="/postgres/presenter" className="flex items-center gap-3 rounded-xl px-3 py-3 text-xs text-slate-400 hover:bg-white/[.04]"><Radio size={15}/> Presenter Mode</Link>
      </aside>
      <section className="min-w-0">{children}</section>
    </div>
  </main>;
}
