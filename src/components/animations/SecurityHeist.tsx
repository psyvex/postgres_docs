'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import clsx from 'clsx';
import { Play } from 'lucide-react';
import { Icon, type IconName } from '@/components/icons';
import { DemoFrame, Toggle } from '@/components/docs/Callout';

const DEFENSES = [
  { id: 'params', label: 'Parameterized queries' },
  { id: 'leastPriv', label: 'App connects as least-privilege role' },
  { id: 'rls', label: 'RLS on tenant tables' },
  { id: 'searchPath', label: 'Pinned search_path + no CREATE on public' },
  { id: 'tls', label: 'TLS + SCRAM, pg_hba locked down' },
] as const;
type DefenseId = (typeof DEFENSES)[number]['id'];

const ATTACKS: { name: string; icon: IconName; how: string; blockedBy: DefenseId[]; impact: string }[] = [
  { name: 'SQL injection', icon: 'injection', how: "search box: ' OR 1=1 --", blockedBy: ['params'], impact: 'dumps every row' },
  { name: 'Injection → DROP TABLE', icon: 'bomb', how: "'; DROP TABLE tasks; --", blockedBy: ['params', 'leastPriv'], impact: 'deletes production data' },
  { name: 'Tenant hopping', icon: 'tenantHop', how: 'forgets WHERE org_id = … in one endpoint', blockedBy: ['rls'], impact: "reads another customer's data" },
  { name: 'search_path hijack', icon: 'hijack', how: 'shadows a function used by a SECURITY DEFINER', blockedBy: ['searchPath'], impact: 'runs code as the owner' },
  { name: 'Network sniffing', icon: 'sniff', how: 'reads credentials on the wire', blockedBy: ['tls'], impact: 'steals the DB password' },
];

export function SecurityHeist() {
  const [on, setOn] = useState<Record<DefenseId, boolean>>({ params: false, leastPriv: false, rls: false, searchPath: false, tls: false });
  const [step, setStep] = useState(-1);

  useEffect(() => setStep(-1), [on]);
  useEffect(() => {
    if (step < 0 || step >= ATTACKS.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), 800);
    return () => clearTimeout(t);
  }, [step]);

  const blocked = (a: (typeof ATTACKS)[number]) => a.blockedBy.some((d) => on[d]);
  const finished = step >= ATTACKS.length;
  const breaches = ATTACKS.filter((a) => !blocked(a)).length;

  return (
    <DemoFrame
      icon="hijack"
      title="Database heist: can the attacker get in?"
      subtitle="Switch on defenses, then launch the attack wave. Defense in depth means one miss isn't fatal."
      controls={
        <button onClick={() => setStep(0)} className="flex items-center gap-2 rounded-xl bg-bad px-4 py-2 text-sm font-bold text-white shadow-card">
          <Play className="h-4 w-4" /> Launch attacks
        </button>
      }
      footer={
        finished ? (
          <span className={clsx('flex items-center gap-1.5 font-semibold', breaches === 0 ? 'text-good' : 'text-bad')}>
            <Icon name={breaches === 0 ? 'trophy' : 'danger'} size={16} />
            {breaches === 0 ? 'Vault secured — every attack was stopped by at least one layer.' : `${breaches} breach${breaches === 1 ? '' : 'es'}. Turn on more layers and try again.`}
          </span>
        ) : (
          'Tip: some attacks are stopped by two different layers — that is defense in depth.'
        )
      }
    >
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-xs font-bold text-muted"><Icon name="production" /> Your defenses</div>
          {DEFENSES.map((d) => (
            <div key={d.id}>
              <Toggle on={on[d.id]} onChange={(v) => setOn((o) => ({ ...o, [d.id]: v }))} label={d.label} />
            </div>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {ATTACKS.map((a, i) => {
            const shown = step > i;
            const ok = blocked(a);
            return (
              <motion.div
                key={a.name}
                animate={shown ? (ok ? { scale: [1, 0.95, 1] } : { x: [0, -6, 6, -4, 0] }) : { opacity: step === i ? 1 : 0.6 }}
                className={clsx('flex flex-col rounded-2xl border p-3 text-sm', !shown ? 'border-line bg-surface-2' : ok ? 'border-good/40 bg-good-soft' : 'border-bad/40 bg-bad-soft')}
              >
                <Icon name={shown ? (ok ? 'production' : 'burst') : a.icon} size={32} className={!shown ? 'text-muted' : ok ? 'text-good' : 'text-bad'} />
                <div className="mt-1 font-bold">{a.name}</div>
                <div className="mt-1 font-mono text-[11px] text-muted">{a.how}</div>
                {shown && <div className={clsx('mt-auto pt-2 text-xs font-semibold', ok ? 'text-good' : 'text-bad')}>{ok ? `Blocked by ${a.blockedBy.filter((d) => on[d]).map((d) => DEFENSES.find((x) => x.id === d)!.label.split(' ')[0]).join(' + ')}` : `Breach: ${a.impact}`}</div>}
              </motion.div>
            );
          })}
        </div>
      </div>
    </DemoFrame>
  );
}
