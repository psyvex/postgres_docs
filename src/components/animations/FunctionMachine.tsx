'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import clsx from 'clsx';
import { Play } from 'lucide-react';
import { DemoFrame, Segmented, Toggle } from '@/components/docs/Callout';
import { Icon, type IconName } from '@/components/icons';

type Caller = 'member' | 'anon';
type Security = 'invoker' | 'definer';

const CALLERS: Record<Caller, { role: string; icon: IconName; canReadTasks: boolean }> = {
  member: { role: 'app_member', icon: 'member', canReadTasks: true },
  anon: { role: 'app_anon', icon: 'anon', canReadTasks: false },
};

const STAGES = ['call', 'badge', 'lookup', 'door', 'result'] as const;
type Stage = (typeof STAGES)[number];

export function FunctionMachine() {
  const [caller, setCaller] = useState<Caller>('anon');
  const [security, setSecurity] = useState<Security>('invoker');
  const [pinned, setPinned] = useState(true);
  const [stage, setStage] = useState<number>(-1);

  const c = CALLERS[caller];
  const effectiveRole = security === 'definer' ? 'postgres (owner)' : c.role;
  const allowed = security === 'definer' || c.canReadTasks;
  const hijacked = security === 'definer' && !pinned;

  useEffect(() => setStage(-1), [caller, security, pinned]);
  useEffect(() => {
    if (stage < 0 || stage >= STAGES.length - 1) return;
    const t = setTimeout(() => setStage((s) => s + 1), 900);
    return () => clearTimeout(t);
  }, [stage]);

  const at = (s: Stage) => stage >= STAGES.indexOf(s);
  const outcome = hijacked ? 'hijack' : allowed ? 'ok' : 'denied';

  const ddl = `CREATE FUNCTION count_org_tasks() RETURNS bigint
  LANGUAGE sql STABLE
  SECURITY ${security.toUpperCase()}${pinned ? `\n  SET search_path = lab, pg_temp` : ''}
AS $$ SELECT count(*) FROM tasks WHERE org_id = current_org_id() $$;`;

  return (
    <DemoFrame
      icon="functions"
      title="Whose badge does the function wear?"
      subtitle="SECURITY INVOKER runs with the caller's privileges; SECURITY DEFINER runs with the owner's."
      controls={
        <>
          <Segmented value={caller} onChange={setCaller} options={[{ value: 'member', label: 'app_member', icon: 'member' }, { value: 'anon', label: 'app_anon', icon: 'anon' }]} />
          <Segmented value={security} onChange={setSecurity} options={[{ value: 'invoker', label: 'INVOKER' }, { value: 'definer', label: 'DEFINER' }]} />
          <Toggle on={pinned} onChange={setPinned} label="pinned search_path" />
        </>
      }
      footer={
        outcome === 'hijack'
          ? 'Danger: SECURITY DEFINER without a pinned search_path: anyone who can create objects earlier in the path can make your privileged function call THEIR code.'
          : security === 'definer'
            ? 'DEFINER is a controlled "sudo": great for narrow, audited operations — dangerous if the body trusts anything the caller controls.'
            : 'INVOKER (the default) is the safe choice: the function can never do more than the caller could do directly.'
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <pre className="m-0 overflow-x-auto rounded-2xl bg-code-bg p-4 font-mono text-[12.5px] leading-relaxed text-code-text">{ddl}</pre>

        <div>
          <button onClick={() => setStage(0)} className="mb-4 flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-on-brand shadow-card">
            <Play className="h-4 w-4" /> <Icon name={c.icon} size={16} /> SELECT count_org_tasks();
          </button>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Station active={at('call')} title="1 · Caller" icon={c.icon}>
              <span className="font-mono">{c.role}</span>
            </Station>
            <Station active={at('badge')} title="2 · Badge swap" icon={security === 'definer' ? 'owner' : 'badge'}>
              runs as <b className="font-mono">{effectiveRole}</b>
            </Station>
            <Station active={at('lookup')} title="3 · Name lookup" icon={hijacked ? 'hijack' : 'compass'} tone={hijacked && at('lookup') ? 'bad' : undefined}>
              {pinned ? 'search_path pinned → lab.tasks' : 'search_path from caller…'}
            </Station>
            <Station active={at('door')} title="4 · tasks door" icon={outcome === 'denied' ? 'lock' : 'unlock'} tone={at('door') ? (outcome === 'ok' ? 'good' : 'bad') : undefined}>
              {allowed ? 'SELECT allowed' : `${c.role} has no SELECT`}
            </Station>
          </div>

          <motion.div
            initial={false}
            animate={{ opacity: at('result') ? 1 : 0.25, y: at('result') ? 0 : 8 }}
            className={clsx(
              'mt-4 flex items-center rounded-2xl border p-4 text-sm',
              !at('result') && 'border-line',
              at('result') && outcome === 'ok' && 'border-good/40 bg-good-soft text-good',
              at('result') && outcome === 'denied' && 'border-bad/40 bg-bad-soft text-bad',
              at('result') && outcome === 'hijack' && 'border-bad/40 bg-bad-soft text-bad',
            )}
          >
            {at('result') && <Icon name={outcome === 'ok' ? 'ok' : outcome === 'denied' ? 'fail' : 'burst'} size={18} className="mr-2" />}
            {!at('result') ? 'Result appears here…' : outcome === 'ok' ? 'count_org_tasks = 4' : outcome === 'denied' ? 'ERROR: permission denied for table tasks' : 'Attacker code ran with owner privileges'}
          </motion.div>
        </div>
      </div>
    </DemoFrame>
  );
}

function Station({ active, title, icon, children, tone }: { active: boolean; title: string; icon: IconName; children: React.ReactNode; tone?: 'good' | 'bad' }) {
  return (
    <motion.div
      animate={{ opacity: active ? 1 : 0.35, scale: active ? 1 : 0.96 }}
      className={clsx('rounded-2xl border p-3 text-center text-xs', tone === 'good' ? 'border-good/40 bg-good-soft' : tone === 'bad' ? 'border-bad/40 bg-bad-soft' : 'border-line bg-surface-2')}
    >
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{title}</div>
      <motion.div key={icon + String(active)} initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} className="my-1 flex justify-center">
        <Icon name={icon} size={32} className={tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-brand'} />
      </motion.div>
      <div>{children}</div>
    </motion.div>
  );
}
