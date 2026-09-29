'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { Loader2, RefreshCw } from 'lucide-react';
import { Icon, type IconName } from '@/components/icons';
import { DemoFrame } from '@/components/docs/Callout';
import { runSql, useDbStore } from '@/lib/db/store';
import { highlightSql } from '@/lib/sql/highlight';

const ROLES = [
  { name: 'app_anon', icon: 'anon', note: 'not logged in' },
  { name: 'app_member', icon: 'astronaut', note: 'normal user' },
  { name: 'app_admin', icon: 'owner', note: 'back-office' },
] satisfies { name: string; icon: IconName; note: string }[];
const TABLES = ['organizations', 'members', 'tasks', 'audit_log'];
const PRIVS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const;

type Grid = Record<string, boolean>; // key: role|table|priv
const key = (r: string, t: string, p: string) => `${r}|${t}|${p}`;

/** Live privilege matrix: reads has_table_privilege() and toggles real GRANT / REVOKE statements. */
export function PrivilegeGrid() {
  const revision = useDbStore((s) => s.revision);
  const [grid, setGrid] = useState<Grid | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [log, setLog] = useState<{ id: number; sql: string; ok: boolean }[]>([]);

  const load = useCallback(async () => {
    const checks = ROLES.flatMap((r) => TABLES.flatMap((t) => PRIVS.map((p) => `has_table_privilege('${r.name}', 'lab.${t}', '${p}') AS "${key(r.name, t, p)}"`)));
    const res = await runSql(`SELECT ${checks.join(', ')}`, { silent: true });
    if (!res.ok) return setError(res.error.includes('does not exist') ? 'Demo schema or roles missing — load the demo schema from the database menu.' : res.error);
    setError(null);
    setGrid(res.results.at(-1)!.rows[0] as Grid);
  }, []);

  useEffect(() => {
    load();
  }, [load, revision]);

  const toggle = async (role: string, table: string, priv: string) => {
    if (!grid) return;
    const k = key(role, table, priv);
    const sql = grid[k] ? `REVOKE ${priv} ON ${table} FROM ${role};` : `GRANT ${priv} ON ${table} TO ${role};`;
    setPending(k);
    const res = await runSql(sql);
    setLog((l) => [{ id: Date.now(), sql, ok: res.ok }, ...l].slice(0, 6));
    await load();
    setPending(null);
  };

  return (
    <DemoFrame
      icon="roles"
      title="Key ring: who can open which door?"
      subtitle="Click a lock to GRANT or REVOKE for real on the active database."
      controls={
        <button onClick={load} className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold">
          <RefreshCw className="h-3.5 w-3.5" /> Re-check
        </button>
      }
      footer={<>Checked with <code>has_table_privilege(role, table, privilege)</code> — the same test Postgres runs before touching a table.</>}
    >
      {error && <div className="mb-3 rounded-xl bg-warn-soft p-3 text-sm text-warn">{error}</div>}
      <div className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th />
                {TABLES.map((t) => (
                  <th key={t} colSpan={PRIVS.length} className="rounded-lg bg-surface-2 px-2 py-1.5 font-mono text-xs"><span className="inline-flex items-center gap-1"><Icon name="door" className="text-muted" /> {t}</span></th>
                ))}
              </tr>
              <tr>
                <th />
                {TABLES.flatMap((t) => PRIVS.map((p) => <th key={t + p} className="px-1 text-[10px] font-semibold text-muted">{p.slice(0, 3)}</th>))}
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r.name}>
                  <th className="whitespace-nowrap pr-2 text-left">
                    <div className="flex items-center gap-2">
                      <Icon name={r.icon} size={26} className="text-brand" />
                      <div>
                        <div className="font-mono text-xs font-bold">{r.name}</div>
                        <div className="text-[10px] font-normal text-muted">{r.note}</div>
                      </div>
                    </div>
                  </th>
                  {TABLES.flatMap((t) =>
                    PRIVS.map((p) => {
                      const k = key(r.name, t, p);
                      const on = grid?.[k];
                      return (
                        <td key={k} className="p-0">
                          <motion.button
                            whileTap={{ scale: 0.85 }}
                            onClick={() => toggle(r.name, t, p)}
                            disabled={!grid || pending !== null}
                            title={`${on ? 'REVOKE' : 'GRANT'} ${p} ON ${t} ${on ? 'FROM' : 'TO'} ${r.name}`}
                            className={clsx('grid h-9 w-full place-items-center rounded-lg border text-base transition', on ? 'border-good/40 bg-good-soft' : 'border-line bg-surface-2 grayscale hover:grayscale-0')}
                          >
                            {pending === k ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <motion.span key={String(on)} initial={{ rotate: -30, scale: 0.4 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}>
                                {grid ? <Icon name={on ? 'unlock' : 'lock'} size={18} className={on ? 'text-good' : 'text-muted'} /> : '·'}
                              </motion.span>
                            )}
                          </motion.button>
                        </td>
                      );
                    }),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="min-h-[72px] rounded-2xl bg-code-bg p-3 font-mono text-xs text-code-text">
          <div className="mb-2 text-[11px] font-semibold text-code-text/60">-- statements you just ran</div>
          <AnimatePresence initial={false}>
            {log.length === 0 && <div className="text-code-text/50">Click a lock…</div>}
            {log.map((l) => (
              <motion.div key={l.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className={clsx('py-0.5', !l.ok && 'text-bad line-through')}>
                {highlightSql(l.sql)}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </DemoFrame>
  );
}
