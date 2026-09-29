'use client';

import { sqlExamples } from '@/config/sql-examples';
import { useLabStore } from '@/lib/store';

export function SqlExamples() {
  const lab = useLabStore((state) => state.activeLab);
  const setSql = useLabStore((state) => state.setSql);
  return <div className="flex flex-wrap gap-2">{sqlExamples[lab].map((example) => <button key={example.label} title={example.explanation} onClick={() => setSql(example.sql)} className="rounded-lg border border-[var(--line)] bg-white/[.02] px-3 py-2 text-[11px] text-slate-400 transition hover:border-cyan-400/30 hover:bg-cyan-400/[.04] hover:text-cyan-200">{example.label}</button>)}</div>;
}
