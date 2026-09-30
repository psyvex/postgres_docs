'use client';

import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { Database, RotateCcw, Trash2 } from 'lucide-react';
import { resetLocalDatabase } from '@/lib/db/local-adapter';
import { useDbStore } from '@/lib/db/store';
import { eraseAll, formatBytes, listEntries, removeKey, type StorageEntry, type StorageGroup } from '@/lib/storage/keys';

const GROUPS: { id: StorageGroup; title: string; note: string }[] = [
  { id: 'sql', title: 'Your SQL and the answers about it', note: 'These hold statements you typed, and the AI cache also carries the schema text it was shown.' },
  { id: 'translations', title: 'Lesson translations', note: 'One entry per lesson, language and lesson version. Deleting one costs an API call to rebuild.' },
  { id: 'progress', title: 'Lesson progress', note: 'Deleting this resets every progress bar to zero.' },
  { id: 'connection', title: 'Database connection', note: 'Which database the playground is pointed at. Passwords and server tokens are never stored.' },
  { id: 'appearance', title: 'Appearance and layout', note: 'Theme, panel sizes, copilot position, text size, preferred language.' },
  { id: 'other', title: 'Other', note: 'Keys this build does not describe.' },
];

export function StoragePanel() {
  const [entries, setEntries] = useState<StorageEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dbBytes, setDbBytes] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const bump = useDbStore((s) => s.bump);

  const refresh = useCallback(() => {
    setEntries(listEntries());
    setReady(true);
  }, []);

  // The read is deferred a frame, for two reasons: the prerendered HTML cannot contain values the
  // server cannot compute, so the server and the client's first paint must agree on the empty state;
  // and `setEntries` straight from the effect body is the cascading-render shape React warns about.
  useEffect(() => {
    let alive = true;
    const id = requestAnimationFrame(() => {
      refresh();
      // The browser database lives in IndexedDB, not localStorage — measure it separately.
      if (!('storage' in navigator) || !navigator.storage.estimate) return;
      navigator.storage
        .estimate()
        .then((e) => alive && setDbBytes(e.usage ?? 0))
        .catch(() => undefined);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, [refresh]);

  const total = entries.reduce((n, e) => n + e.bytes, 0);

  const onErase = () => {
    if (!window.confirm('Erase everything this site stored in this browser? Your SQL, history, AI answers, translations and progress all go. The in-browser database is not touched by this button.')) return;
    const n = eraseAll();
    setMessage(`Erased ${n} key${n === 1 ? '' : 's'}.`);
    refresh();
  };

  const onResetDb = () => {
    if (!window.confirm('Reset the in-browser database to the demo data? Your changes will be lost.')) return;
    setBusy(true);
    resetLocalDatabase()
      .then(() => {
        bump();
        setDbBytes(null);
        setMessage('Browser database reset. Reloading the page will re-seed it.');
        return navigator.storage.estimate().then((e) => setDbBytes(e.usage ?? 0));
      })
      .catch((e: unknown) => setMessage(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Storage &amp; privacy</h1>
          <p className="mt-1 text-sm text-muted">
            Everything Postgres Lab keeps in this browser, listed so it can be inspected and erased. Nothing here leaves the device: the database is
            WASM Postgres in IndexedDB, and only the text you send to the assistant goes to a server.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:bg-surface-2">
            Re-read
          </button>
          <button onClick={onErase} className="flex items-center gap-1.5 rounded-lg bg-bad px-3 py-1.5 text-xs font-bold text-on-brand hover:opacity-90">
            <Trash2 className="h-3.5 w-3.5" /> Erase all
          </button>
        </div>
      </div>

      {message && <p className="mt-4 rounded-lg bg-good-soft px-3 py-2 text-xs font-semibold text-good">{message}</p>}

      <section className="mt-6 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Database className="h-4 w-4 text-accent" /> Browser database (IndexedDB)
          </div>
          <span className="font-mono text-xs text-muted">{dbBytes === null ? 'measuring…' : formatBytes(dbBytes)}</span>
        </div>
        <p className="mt-2 text-xs leading-snug text-muted">
          A real PostgreSQL 18 server compiled to WebAssembly, with the demo schema in the <code className="font-mono">lab</code> schema.
          It is the biggest thing this site stores, and erasing <em>local storage</em> does not touch it.
        </p>
        <button onClick={onResetDb} disabled={busy} className="mt-3 flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:bg-surface-2 disabled:opacity-60">
          <RotateCcw className="h-3.5 w-3.5" /> Reset demo data
        </button>
      </section>

      <p className="mt-6 text-xs text-muted">
        {ready ? `${entries.length} keys · ${formatBytes(total)}` : 'Reading…'} — quota is roughly 5 MB per site, and the AI cache is what fills it first.
      </p>

      {GROUPS.map((g) => {
        const rows = entries.filter((e) => e.info.group === g.id);
        if (!rows.length) return null;
        return (
          <section key={g.id} className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <header className="border-b border-line px-4 py-3">
              <h2 className="text-sm font-bold">{g.title}</h2>
              <p className="mt-0.5 text-[11px] leading-snug text-muted">{g.note}</p>
            </header>
            <ul>
              {rows.map((e) => (
                <li key={e.key} className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold">{e.info.label}</span>
                      {e.info.private && <span className="rounded-full bg-warn-soft px-1.5 py-0.5 text-[10px] font-bold text-warn">contains your SQL</span>}
                      <span className="truncate font-mono text-[10px] text-muted">{e.key}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted">{e.info.detail}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted">{formatBytes(e.bytes)}</span>
                  <button
                    onClick={() => {
                      removeKey(e.key);
                      setMessage(`Deleted ${e.key}`);
                      refresh();
                    }}
                    aria-label={`Delete ${e.key}`}
                    className={clsx('shrink-0 rounded-lg border border-line p-1.5 text-muted hover:border-bad hover:text-bad')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {ready && !entries.length && <p className="mt-4 rounded-2xl border border-line bg-surface p-4 text-sm text-muted">Nothing is stored in this browser yet.</p>}
    </div>
  );
}
