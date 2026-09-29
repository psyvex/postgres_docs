'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import clsx from 'clsx';
import { Play, RotateCcw } from 'lucide-react';
import { DemoFrame, Segmented, Toggle } from '@/components/docs/Callout';
import { ElephantBouncer, Icon, type IconName } from '@/components/icons';

// Mirrors the seed data so the animation works even before the database loads.
const TASKS = [
  { id: 1, org: 1, assignee: 1, title: 'Design fuel tank' },
  { id: 2, org: 1, assignee: 2, title: 'Order rocket fuel' },
  { id: 3, org: 1, assignee: 2, title: 'Fix landing page typo' },
  { id: 4, org: 1, assignee: null, title: 'Add pricing page' },
  { id: 5, org: 2, assignee: 4, title: 'Login screen' },
  { id: 6, org: 2, assignee: 3, title: 'Push notifications' },
  { id: 7, org: 2, assignee: 3, title: 'Secret launch plan' },
] as const;

const USERS = {
  alice: { name: 'Alice', icon: 'astronaut', member: 1, org: 1, orgName: 'Acme' },
  bob: { name: 'Bob', icon: 'member', member: 2, org: 1, orgName: 'Acme' },
  carol: { name: 'Carol', icon: 'scientist', member: 3, org: 2, orgName: 'Globex' },
  anon: { name: 'Anonymous', icon: 'anon', member: null, org: null, orgName: '—' },
} as const satisfies Record<string, { name: string; icon: IconName; member: number | null; org: number | null; orgName: string }>;

type UserKey = keyof typeof USERS;
type PolicyKey = 'org' | 'assignee';
type RowState = 'queue' | 'gate' | 'pass' | 'fail';

const POLICIES: Record<PolicyKey, { sql: string; label: string; test: (t: (typeof TASKS)[number], u: (typeof USERS)[UserKey]) => boolean; explain: (t: (typeof TASKS)[number], u: (typeof USERS)[UserKey]) => string }> = {
  org: {
    label: 'Same organization',
    sql: 'USING (org_id = current_org_id())',
    test: (t, u) => u.org !== null && t.org === u.org,
    explain: (t, u) => `${t.org} = ${u.org ?? 'NULL'}`,
  },
  assignee: {
    label: 'Only my tasks',
    sql: 'USING (assignee_id = current_member_id())',
    test: (t, u) => u.member !== null && t.assignee === u.member,
    explain: (t, u) => `${t.assignee ?? 'NULL'} = ${u.member ?? 'NULL'}`,
  },
};

const STEP_MS = 850;

export function RlsBouncer() {
  const [user, setUser] = useState<UserKey>('alice');
  const [policy, setPolicy] = useState<PolicyKey>('org');
  const [rls, setRls] = useState(true);
  const [cursor, setCursor] = useState(-1); // index of the row at the gate; -1 = idle
  const [states, setStates] = useState<RowState[]>(TASKS.map(() => 'queue'));

  const u = USERS[user];
  const p = POLICIES[policy];
  const verdicts = useMemo(() => TASKS.map((t) => !rls || p.test(t, u)), [rls, p, u]);

  const reset = () => {
    setCursor(-1);
    setStates(TASKS.map(() => 'queue'));
  };
  useEffect(reset, [user, policy, rls]);

  // Drive the animation: each tick moves the current row through the gate and brings the next one in.
  useEffect(() => {
    if (cursor < 0) return;
    const timer = setTimeout(() => {
      setStates((prev) => prev.map((s, i) => (i === cursor ? (verdicts[i] ? 'pass' : 'fail') : i === cursor + 1 ? 'gate' : s)));
      setCursor((c) => (c + 1 < TASKS.length ? c + 1 : -1));
    }, STEP_MS);
    return () => clearTimeout(timer);
  }, [cursor, verdicts]);

  const start = () => {
    setStates(TASKS.map((_, i) => (i === 0 ? 'gate' : 'queue')));
    setCursor(0);
  };

  const gateRow = TASKS.findIndex((_, i) => states[i] === 'gate');
  const running = cursor >= 0;
  const finished = !running && states.every((s) => s === 'pass' || s === 'fail');
  const passed = states.filter((s) => s === 'pass').length;

  const rowsIn = (state: RowState) => TASKS.map((t, i) => ({ t, i })).filter(({ i }) => states[i] === state);

  return (
    <DemoFrame
      icon="rls"
      title="The RLS bouncer"
      subtitle="Every row must show its ID at the door. The policy decides who gets in."
      controls={
        <>
          <Segmented value={user} onChange={setUser} options={(Object.keys(USERS) as UserKey[]).map((k) => ({ value: k, label: USERS[k].name, icon: USERS[k].icon }))} />
          <Segmented value={policy} onChange={setPolicy} options={(Object.keys(POLICIES) as PolicyKey[]).map((k) => ({ value: k, label: POLICIES[k].label }))} />
          <Toggle on={rls} onChange={setRls} label={rls ? 'RLS on' : 'RLS off'} tone={rls ? 'good' : 'bad'} />
        </>
      }
      footer={
        <span className="font-mono">
          {rls ? (
            <>Postgres rewrites <b>SELECT * FROM tasks</b> → <b>SELECT * FROM tasks WHERE {p.sql.replace(/^USING /, '')}</b> for {u.name}</>
          ) : (
            <>RLS disabled: <b>SELECT * FROM tasks</b> returns every row to everyone.</>
          )}
        </span>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={start} disabled={running} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-on-brand shadow-card disabled:opacity-50">
          <Play className="h-4 w-4" /> <Icon name={u.icon} size={16} /> {u.name} runs SELECT * FROM tasks
        </button>
        {finished && (
          <button onClick={reset} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold">
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        )}
        <code className="rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs">
          app.org_id = {u.org ?? 'unset'} · app.member_id = {u.member ?? 'unset'}
        </code>
      </div>

      <LayoutGroup>
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(220px,0.8fr)_1fr]">
          <Zone title="tasks table (on disk)" icon="package" tone="muted">
            {rowsIn('queue').map(({ t }) => <RowCard key={t.id} task={t} />)}
          </Zone>

          <div className="flex flex-col items-center justify-start gap-3 rounded-2xl border-2 border-dashed border-line p-4">
            <motion.div
              animate={
                !rls ? { rotate: [0, -4, 4, 0] } : gateRow >= 0 ? { scale: [1, 1.08, 1] } : { scale: 1 }
              }
              transition={{ repeat: !rls ? Infinity : 0, duration: !rls ? 2.4 : 0.4 }}
              aria-hidden
            >
              <ElephantBouncer asleep={!rls} size={92} />
            </motion.div>
            <div className="text-center text-xs font-semibold text-muted">{rls ? 'Policy bouncer' : 'Bouncer is asleep (RLS off)'}</div>
            {rls && <code className="rounded-lg bg-code-bg px-2 py-1 text-center font-mono text-[11px] text-code-text">{p.sql}</code>}
            <div className="min-h-[92px] w-full">
              <AnimatePresence mode="popLayout">
                {gateRow >= 0 && (
                  <motion.div key={TASKS[gateRow].id} className="space-y-2">
                    <RowCard task={TASKS[gateRow]} highlight />
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                      className={clsx('rounded-lg px-2 py-1 text-center font-mono text-xs font-bold', verdicts[gateRow] ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad')}
                    >
                      <Icon name={verdicts[gateRow] ? 'ok' : 'fail'} className="mr-1" />
                      {rls ? `${p.explain(TASKS[gateRow], u)} → ${verdicts[gateRow] ? 'true · come in' : 'false · not on the list'}` : 'no check · come in'}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="w-full">
              <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-muted"><Icon name="trash" /> filtered out</div>
              <div className="flex flex-wrap gap-1">
                {rowsIn('fail').map(({ t }) => (
                  <motion.span layoutId={`row-${t.id}`} key={t.id} animate={{ x: [0, -6, 6, -3, 0] }} className="rounded-md bg-bad-soft px-1.5 py-0.5 font-mono text-[11px] text-bad line-through">
                    #{t.id}
                  </motion.span>
                ))}
              </div>
            </div>
          </div>

          <Zone title={`result for ${u.name} — ${passed} row${passed === 1 ? '' : 's'}`} icon="ok" tone="good">
            {rowsIn('pass').map(({ t }) => <RowCard key={t.id} task={t} />)}
            {finished && passed === 0 && <div className="rounded-xl bg-surface-2 p-3 text-center text-sm text-muted">No rows. Not an error — RLS silently hides what you can’t see.</div>}
          </Zone>
        </div>
      </LayoutGroup>
    </DemoFrame>
  );
}

function Zone({ title, icon, tone, children }: { title: string; icon: IconName; tone: 'muted' | 'good'; children: React.ReactNode }) {
  return (
    <div className={clsx('min-h-[280px] rounded-2xl border p-3', tone === 'good' ? 'border-good/30 bg-good-soft/40' : 'border-line bg-surface-2/60')}>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold"><Icon name={icon} size={15} className={tone === 'good' ? 'text-good' : 'text-muted'} /> {title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RowCard({ task, highlight }: { task: (typeof TASKS)[number]; highlight?: boolean }) {
  return (
    <motion.div
      layoutId={`row-${task.id}`}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className={clsx('flex items-center gap-2 rounded-xl border bg-surface px-3 py-2 text-sm shadow-card', highlight ? 'border-brand' : 'border-line')}
    >
      <span className="font-mono text-[11px] text-muted">#{task.id}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
      <span className={clsx('rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold', task.org === 1 ? 'bg-brand-soft text-brand' : 'bg-warn-soft text-warn')}>org {task.org}</span>
      <span className="flex items-center gap-0.5 font-mono text-[10px] text-muted"><Icon name="user" />{task.assignee ?? '–'}</span>
    </motion.div>
  );
}
