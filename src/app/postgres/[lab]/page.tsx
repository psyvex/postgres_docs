'use client';

import { useEffect } from 'react';
import { notFound, useParams } from 'next/navigation';
import { labs, demoData, type LabId } from '@/lib/lab-config';
import { useLabStore } from '@/lib/store';
import { LabShell } from '@/components/LabShell';
import { SqlWorkbench } from '@/components/SqlWorkbench';
import { ResultTable } from '@/components/ResultTable';
import { DatabaseFlow } from '@/components/DatabaseFlow';

export default function LabPage() {
  const params = useParams<{ lab: string }>();
  const lab = labs.find((item) => item.id === params.lab);
  if (!lab) return notFound();
  return <LabView lab={lab.id} />;
}

function LabView({ lab }: { lab: LabId }) {
  const definition = labs.find((item) => item.id === lab)!;
  const setLab = useLabStore((state) => state.setLab);
  const tenantId = useLabStore((state) => state.activeTenantId);
  const setTenant = useLabStore((state) => state.setTenant);
  const rlsEnabled = useLabStore((state) => state.rlsEnabled);
  const toggleRls = useLabStore((state) => state.toggleRls);
  const result = useLabStore((state) => state.result);

  useEffect(() => { setLab(lab); }, [lab, setLab]);

  return <LabShell>
    <div className="space-y-5">
      <header className="glass rounded-2xl p-7">
        <div className="text-[11px] font-semibold uppercase tracking-[.2em]" style={{ color: definition.color }}>{definition.eyebrow} · {definition.title}</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">{definition.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">{definition.description}</p>
      </header>

      {lab === 'rls' && <DatabaseFlow />}

      <div className="grid gap-5 xl:grid-cols-[.95fr_1.05fr]">
        <div className="space-y-5">
          {lab === 'rls' && <div className="glass rounded-2xl p-5"><div className="mb-4 text-sm font-semibold">Session context</div><div className="grid grid-cols-2 gap-3">{demoData.tenants.map((tenant) => <button key={tenant.id} onClick={() => setTenant(tenant.id)} className={`rounded-xl border p-4 text-left transition ${tenantId === tenant.id ? 'border-cyan-400/40 bg-cyan-400/[.07]' : 'border-[var(--line)] hover:bg-white/[.03]'}`}><div className="text-sm font-medium">{tenant.name}</div><div className="mt-1 text-[11px] text-[var(--muted)]">tenant_id = {tenant.id}</div></button>)}</div><div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--line)] p-3"><div><div className="text-xs font-medium">Row-Level Security</div><div className="text-[11px] text-[var(--muted)]">tenant_isolation policy</div></div><button onClick={toggleRls} className={`rounded-lg px-3 py-1.5 text-xs ${rlsEnabled ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300'}`}>{rlsEnabled ? 'Enabled' : 'Break RLS'}</button></div></div>}
          <SqlWorkbench />
        </div>
        <div className="glass rounded-2xl p-5"><div className="mb-4 text-sm font-semibold">Execution result</div><ResultTable />{result?.status === 'error' && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[.04] p-4 text-xs text-red-300">Try the lab's example query, then modify it.</div>}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">{definition.steps.map((step, index) => <div key={step.title} className="glass rounded-xl p-4"><div className="mb-3 grid h-7 w-7 place-items-center rounded-lg bg-white/[.05] text-xs font-semibold">{index + 1}</div><div className="text-xs font-semibold">{step.title}</div><div className="mt-1 text-[11px] leading-5 text-[var(--muted)]">{step.description}</div></div>)}</div>
    </div>
  </LabShell>;
}
