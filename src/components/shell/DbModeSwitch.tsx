'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useMotionPresets } from '@/lib/motion';
import clsx from 'clsx';
import { Database, HardDrive, Loader2, PlugZap, RotateCcw } from 'lucide-react';
import { useDbStore, runSql } from '@/lib/db/store';
import { resetLocalDatabase } from '@/lib/db/local-adapter';
import { SEED_SQL } from '@/lib/db/seed';
import { useT } from '@/lib/i18n/useT';
import { fmt } from '@/lib/i18n/fmt';

type Status = { tone: 'good' | 'bad' | 'muted'; text: string } | null;
type Guard = { remoteAllowed: boolean; tokenRequired: boolean; tokenConfigured: boolean };

export function DbModeSwitch() {
  const { t } = useT();
  const { mode, connection, serverToken, setMode, setConnection, setServerToken, bump } = useDbStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [guard, setGuard] = useState<Guard | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { panel } = useMotionPresets();

  // The token field is only asked for when the server actually demands it, so a local
  // deployment never sees a field it cannot fill.
  useEffect(() => {
    if (!open || guard) return;
    let alive = true;
    fetch('/api/db/query')
      .then((r) => (r.ok ? (r.json() as Promise<Guard>) : null))
      .then((json) => alive && json && setGuard(json))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [open, guard]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !panelRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const act = async (label: string, fn: () => Promise<Status>) => {
    setBusy(true);
    setStatus({ tone: 'muted', text: label });
    try {
      setStatus(await fn());
    } catch (e) {
      setStatus({ tone: 'bad', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const testLive = () =>
    act(t.mode.connecting, async () => {
      const r = await runSql('SELECT version() AS version', { silent: true });
      return r.ok ? { tone: 'good', text: String(r.results.at(-1)?.rows[0]?.version).split(' on ')[0] } : { tone: 'bad', text: r.error };
    });

  const seedLive = () => {
    if (!confirm(fmt(t.dbMode.liveSeedConfirm, { db: connection.database }))) return;
    act(t.dbMode.loadingSchema, async () => {
      const r = await runSql(SEED_SQL);
      return r.ok ? { tone: 'good', text: t.dbMode.demoLoaded } : { tone: 'bad', text: r.error };
    });
  };

  const resetLocal = () => {
    if (!confirm(t.dbMode.resetConfirm)) return;
    act(t.dbMode.resetWorking, async () => {
      await resetLocalDatabase();
      bump();
      return { tone: 'good', text: t.dbMode.resetLocalDone };
    });
  };

  // One string for three jobs: the chip's text at `sm` and up, its accessible name, and its tooltip.
  const chipLabel = mode === 'local' ? t.dbMode.browserChip : `${t.mode.live} · ${connection.database}`;

  return (
    <div className="relative" ref={panelRef}>
      {/*
        Below `sm` the chip is a dot and nothing else, because its word is what breaks the 320 px row:
        the header needs 329 px of content in English and **373** px in Spanish, in a 309 px viewport.
        The previous fix here shortened the word (`Browser DB` → `Browser`), which is a budget spent in
        one language and re-spent by every other locale — `Navegador` is longer than the English short
        form, so the same row overflowed again the moment the interface language changed. A dot costs the
        same pixels wherever the UI is read. The mode and the database name are not lost, only moved out
        of the width budget: they are the button's accessible name and tooltip, and the first line of the
        panel the dot opens.
      */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={chipLabel}
        title={chipLabel}
        className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold shadow-card hover:border-brand"
      >
        <span className={clsx('h-2 w-2 shrink-0 rounded-full', mode === 'local' ? 'bg-good' : 'bg-accent')} />
        <span className="hidden sm:inline">{chipLabel}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            {...panel}
            className="absolute end-0 mt-2 w-[min(92vw,380px)] rounded-2xl border border-line bg-surface p-4 shadow-card"
          >
            <div className="grid grid-cols-2 gap-2">
              <ModeCard active={mode === 'local'} onClick={() => setMode('local')} icon={<HardDrive className="h-4 w-4" />} title={t.dbMode.optBrowser} note={t.dbMode.modeCardBrowserNote} />
              <ModeCard active={mode === 'live'} onClick={() => setMode('live')} icon={<Database className="h-4 w-4" />} title={t.dbMode.optLive} note={t.dbMode.modeCardLiveNote} />
            </div>

            {mode === 'local' ? (
              <div className="mt-4 space-y-3 text-sm">
                <p className="text-muted">{t.dbMode.browserNote}</p>
                <button disabled={busy} onClick={resetLocal} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:bg-surface-2">
                  <RotateCcw className="h-3.5 w-3.5" /> {t.dbMode.resetShort}
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-2 text-sm">
                <div className="grid grid-cols-[1fr_88px] gap-2">
                  <Field label={t.dbMode.hostLabel} value={connection.host} onChange={(host) => setConnection({ host })} />
                  <Field label={t.dbMode.portLabel} value={String(connection.port)} onChange={(p) => setConnection({ port: Number(p) || 5432 })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t.dbMode.databaseLabel} value={connection.database} onChange={(database) => setConnection({ database })} />
                  <Field label={t.dbMode.userLabel} value={connection.user} onChange={(user) => setConnection({ user })} />
                </div>
                <Field label={t.dbMode.passwordLabel} type="password" value={connection.password} onChange={(password) => setConnection({ password })} />
                {guard?.tokenRequired && (
                  <>
                    <Field label={t.dbMode.serverTokenLabel} type="password" value={serverToken} onChange={setServerToken} />
                    {/* Remote mode without a token refuses every query; say so before the learner hits it. */}
                    {!guard.tokenConfigured && (
                      <p className="rounded-lg bg-bad-soft px-3 py-2 text-[11px] leading-snug text-bad">
                        This server sets <code className="font-mono">ALLOW_REMOTE_DB=true</code> with no <code className="font-mono">DB_QUERY_TOKEN</code>, so remote queries are refused. Set a token in <code className="font-mono">.env.local</code> and paste it above.
                      </p>
                    )}
                  </>
                )}
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={connection.ssl} onChange={(e) => setConnection({ ssl: e.target.checked })} /> {t.dbMode.requireSsl}
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button disabled={busy} onClick={testLive} className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-on-brand">
                    <PlugZap className="h-3.5 w-3.5" /> {t.dbMode.testConnection}
                  </button>
                  <button disabled={busy} onClick={seedLive} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:bg-surface-2">
                    {t.dbMode.loadDemoSchema}
                  </button>
                </div>
              </div>
            )}

            {/* The one global door to the storage page; the header has no room for it at 320 px. */}
            <Link href="/settings" className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs font-semibold text-muted transition hover:text-brand">
              {t.dbMode.storageLink}
              <span aria-hidden>→</span>
            </Link>

            {status && (
              <div className={clsx('mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs', status.tone === 'good' && 'bg-good-soft text-good', status.tone === 'bad' && 'bg-bad-soft text-bad', status.tone === 'muted' && 'bg-surface-2 text-muted')}>
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span className="break-words">{status.text}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ModeCard({ active, onClick, icon, title, note }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; note: string }) {
  return (
    <button onClick={onClick} className={clsx('rounded-xl border p-3 text-start transition', active ? 'border-brand bg-brand-soft' : 'border-line hover:bg-surface-2')}>
      <div className="flex items-center gap-2 text-sm font-bold">{icon}{title}</div>
      <div className="mt-1 text-[11px] leading-snug text-muted">{note}</div>
    </button>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-muted">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-0.5 w-full rounded-lg border border-line bg-bg px-2.5 py-1.5 font-mono text-xs outline-none focus:border-brand" dir="ltr" />
    </label>
  );
}
