'use client';

import { Database, ShieldCheck, UserRound } from 'lucide-react';
import { useLabStore } from '@/lib/store';
import { demoData } from '@/lib/lab-config';

export function DatabaseFlow() {
  const activeTenantId = useLabStore((state) => state.activeTenantId);
  const rlsEnabled = useLabStore((state) => state.rlsEnabled);
  const tenant = demoData.tenants.find((item) => item.id === activeTenantId) ?? demoData.tenants[0];
  return <div className="glass relative overflow-hidden rounded-2xl p-6">
    <div className="mb-5 flex items-center justify-between"><div><div className="text-sm font-semibold">Request path</div><div className="text-xs text-[var(--muted)]">A visual model of the authorization boundary.</div></div><span className={`rounded-full px-2 py-1 text-[10px] ${rlsEnabled ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300'}`}>{rlsEnabled ? 'policy active' : 'policy bypassed'}</span></div>
    <div className="relative grid grid-cols-4 items-center gap-3">
      <Node icon={<UserRound size={18}/>} label={tenant.name} sub="session context" tone="cyan"/>
      <Connector active/>
      <Node icon={<ShieldCheck size={18}/>} label="RLS" sub={rlsEnabled ? 'USING policy' : 'disabled'} tone={rlsEnabled ? 'green' : 'red'}/>
      <Connector active={rlsEnabled}/>
      <Node icon={<Database size={18}/>} label="orders" sub={rlsEnabled ? 'filtered rows' : 'all rows'} tone="purple"/>
    </div>
  </div>;
}

function Node({ icon, label, sub, tone }: { icon: React.ReactNode; label: string; sub: string; tone: 'cyan'|'green'|'purple'|'red' }) {
  const cls = { cyan: 'border-cyan-400/30 bg-cyan-400/[.06] text-cyan-300', green: 'border-emerald-400/30 bg-emerald-400/[.06] text-emerald-300', purple: 'border-violet-400/30 bg-violet-400/[.06] text-violet-300', red: 'border-red-400/30 bg-red-400/[.06] text-red-300' }[tone];
  return <div className={`relative z-10 rounded-xl border p-4 text-center ${cls} animate-float`}><div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-lg bg-black/20">{icon}</div><div className="text-xs font-semibold text-white">{label}</div><div className="mt-1 text-[10px] text-slate-500">{sub}</div></div>;
}

function Connector({ active }: { active: boolean }) {
  return <div className="absolute hidden h-px w-[17%] bg-[var(--line)] md:block" style={{ left: '23%', top: '50%' }}><span className={`block h-full w-full ${active ? 'flow-line bg-cyan-300' : ''}`}/></div>;
}
