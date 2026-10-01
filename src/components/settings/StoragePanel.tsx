'use client';

import { useCallback, useEffect, useState } from 'react';
import { Database, HardDrive, RotateCcw, Trash2 } from 'lucide-react';
import { resetLocalDatabase } from '@/lib/db/local-adapter';
import { useDbStore } from '@/lib/db/store';
import { clearOfflineCaches, readOfflineReport, type OfflineReport } from '@/lib/pwa/offline';
import { eraseAll, formatBytes, listEntries, removeKey, type StorageEntry, type StorageGroup } from '@/lib/storage/keys';
import { useT } from '@/lib/i18n/useT';
import { fmt } from '@/lib/i18n/fmt';
import { DEFAULT_UI_LANG } from '@/lib/i18n/languages';
import { setUiLang } from '@/lib/i18n/store';
import { UiLanguageCard } from './UiLanguageCard';

const GROUP_IDS: StorageGroup[] = ['sql', 'translations', 'progress', 'connection', 'appearance', 'other'];

export function StoragePanel() {
  const { t } = useT();
  const [entries, setEntries] = useState<StorageEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dbBytes, setDbBytes] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState<OfflineReport | null>(null);
  const [offlineBusy, setOfflineBusy] = useState(false);
  const { bump } = useDbStore();

  // Read one frame after mount: `useState(() => listEntries())` would return [] on the server
  // (there is no localStorage during prerender) and a populated list on the client — a React #418
  // shape. The rAF defers the first setState so the prerendered HTML and the first client render
  // agree on `entries: []`. `setEntries` from inside the rAF callback (not the effect body) also
  // keeps this off the `react-hooks/set-state-in-effect` warning list.
  const refresh = useCallback(() => {
    setEntries(listEntries());
    setReady(true);
    setMessage(null);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(refresh);
    return () => cancelAnimationFrame(id);
  }, [refresh]);

  // CacheStorage is not localStorage, so listEntries() cannot see the largest thing this site
  // stores once the offline worker is installed. Read it beside the quota, same ready gate.
  const refreshOffline = useCallback(() => {
    readOfflineReport().then(setOffline).catch(() => setOffline({ caches: [] }));
  }, []);

  useEffect(() => {
    if (!ready) return;
    navigator.storage?.estimate?.().then((e) => setDbBytes(e.usage ?? 0)).catch(() => undefined);
    refreshOffline();
  }, [ready, refreshOffline]);

  const total = entries.reduce((n, e) => n + e.bytes, 0);

  // Erase all: wipe storage, reset the interface-language cache to English, and sync `<html lang dir>`.
  const onErase = () => {
    if (!window.confirm(t.storage.eraseConfirm)) return;
    const n = eraseAll();
    setUiLang(DEFAULT_UI_LANG);
    setMessage(fmt(t.storage.erased, { count: n }));
    refresh();
  };

  const onResetDb = () => {
    if (!window.confirm(t.settings.resetDbConfirm)) return;
    setBusy(true);
    resetLocalDatabase()
      .then(() => {
        bump();
        setDbBytes(null);
        setMessage(t.settings.dbReset);
        return navigator.storage.estimate().then((e) => setDbBytes(e.usage ?? 0));
      })
      .catch((e: unknown) => setMessage(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  // No confirm: this deletes downloaded files, not anything the reader made. Reloading with the
  // network back refills the cache, which is the whole point of the card.
  const onClearOffline = () => {
    setOfflineBusy(true);
    clearOfflineCaches()
      .then(() => {
        setMessage(t.storage.offlineCleared);
        return refreshOffline();
      })
      .catch((e: unknown) => setMessage(e instanceof Error ? e.message : String(e)))
      .finally(() => setOfflineBusy(false));
  };

  // null while the read is in flight or if CacheStorage refused it: the card then says measuring
  // rather than printing 0 files for a copy that exists. No byte figure here, see lib/pwa/offline.
  const offlineFiles = offline?.caches.reduce((n, c) => n + c.entries, 0) ?? null;

  // Group headings read from the dictionary; notes stay as authored technical prose.
  const groupTitle: Record<StorageGroup, string> = {
    sql: t.storage.groupSql,
    translations: t.storage.groupTranslations,
    progress: t.storage.groupProgress,
    connection: t.storage.groupConnection,
    appearance: t.storage.groupAppearance,
    other: t.storage.groupOther,
  };
  const groupNote: Record<StorageGroup, string> = {
    sql: 'These hold statements you typed, and the AI cache also carries the schema text it was shown.',
    translations: 'One entry per lesson, language and lesson version. Deleting one costs an API call to rebuild.',
    progress: 'Deleting this resets every progress bar to zero.',
    connection: 'Which database the playground is pointed at. Passwords and server tokens are never stored.',
    appearance: 'Theme, panel sizes, copilot position, text size, preferred language.',
    other: 'Keys this build does not describe.',
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <UiLanguageCard />

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">{t.storage.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.storage.intro}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:bg-surface-2">
            {t.common.reread}
          </button>
          <button onClick={onErase} className="flex items-center gap-1.5 rounded-lg bg-bad px-3 py-1.5 text-xs font-bold text-on-brand hover:opacity-90">
            <Trash2 className="h-3.5 w-3.5" /> {t.storage.eraseAll}
          </button>
        </div>
      </div>

      {message && <p className="mt-4 rounded-lg bg-good-soft px-3 py-2 text-xs font-semibold text-good">{message}</p>}

      <section className="mt-6 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Database className="h-4 w-4 text-accent" /> {t.storage.browserDbTitle} (IndexedDB)
          </div>
          <span dir="ltr" className="font-mono text-xs text-muted">{dbBytes === null ? t.storage.measuring : formatBytes(dbBytes)}</span>
        </div>
        <p className="mt-2 text-xs leading-snug text-muted">{t.storage.browserDbIntro}</p>
        <button onClick={onResetDb} disabled={busy} className="mt-3 flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:bg-surface-2 disabled:opacity-60">
          <RotateCcw className="h-3.5 w-3.5" /> {t.settings.resetDb}
        </button>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <HardDrive className="h-4 w-4 text-brand" /> {t.storage.offlineTitle}
          </div>
          <span dir="ltr" className="font-mono text-xs text-muted">
            {offlineFiles === null ? t.storage.measuring : fmt(t.storage.offlineCaches, { count: offlineFiles })}
          </span>
        </div>
        <p className="mt-2 text-xs leading-snug text-muted">{t.storage.offlineIntro}</p>
        {!!offline?.caches.length && (
          <ul className="mt-2 space-y-1">
            {offline.caches.map((c) => (
              <li key={c.name} className="flex items-center justify-between gap-3 text-[11px]">
                <span dir="ltr" className="truncate font-mono text-muted">{c.name}</span>
                <span dir="ltr" className="shrink-0 font-mono tabular-nums text-muted">{fmt(t.storage.offlineFiles, { count: c.entries })}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] leading-snug text-muted">{t.storage.offlineNote}</p>
        <button onClick={onClearOffline} disabled={offlineBusy || !offline?.caches.length} className="mt-3 flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:bg-surface-2 disabled:opacity-60">
          <Trash2 className="h-3.5 w-3.5" /> {t.storage.offlineClear}
        </button>
      </section>

      <p className="mt-6 text-xs text-muted">
        {ready ? fmt(t.storage.keysAndBytes, { count: entries.length, size: formatBytes(total) }) : t.storage.measuring}.{' '}
        {t.storage.browserDbNote}
      </p>

      {GROUP_IDS.map((gid) => {
        const rows = entries.filter((e) => e.info.group === gid);
        if (!rows.length) return null;
        return (
          <section key={gid} className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <header className="border-b border-line px-4 py-3">
              <h2 className="text-sm font-bold">{groupTitle[gid]}</h2>
              <p className="mt-0.5 text-[11px] leading-snug text-muted">{groupNote[gid]}</p>
            </header>
            <ul>
              {rows.map((e) => (
                <li key={e.key} className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold">{e.info.label}</span>
                      {e.info.private && <span className="rounded-full bg-warn-soft px-1.5 py-0.5 text-[10px] font-bold text-warn">{t.storage.containsSql}</span>}
                      <span dir="ltr" className="truncate font-mono text-[10px] text-muted">{e.key}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted">{e.info.detail}</p>
                  </div>
                  <span dir="ltr" className="shrink-0 font-mono text-[10px] tabular-nums text-muted">{formatBytes(e.bytes)}</span>
                  <button
                    onClick={() => {
                      removeKey(e.key);
                      setMessage(`Deleted ${e.key}`);
                      refresh();
                    }}
                    aria-label={`${t.storage.delete} ${e.key}`}
                    className="shrink-0 rounded-lg border border-line p-1.5 text-muted hover:border-bad hover:text-bad"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {ready && !entries.length && <p className="mt-4 rounded-2xl border border-line bg-surface p-4 text-sm text-muted">{t.storage.noneStored}</p>}
    </div>
  );
}
