/**
 * Everything this app writes to `localStorage`, in one place (T5-1).
 *
 * The reader's data is the product's own subject: the playground draft, the query history and the
 * AI answer cache all contain SQL the reader typed, and the AI cache additionally carries a dump of
 * their `information_schema`. A settings page that can list and erase it needs one authoritative
 * inventory, so the descriptions live here and the UI reads it.
 *
 * Keys are matched by prefix, not by an exact list: a key the app starts writing tomorrow shows up
 * on the page as `Other` with no description, which is a visible gap, rather than being invisible.
 */

export const STORAGE_PREFIX = 'postgres-lab:';

export type StorageGroup = 'sql' | 'translations' | 'progress' | 'connection' | 'appearance' | 'other';

export type StorageKeyInfo = {
  /** What the key is for, in the reader's words. */
  label: string;
  detail: string;
  group: StorageGroup;
  /** True when the value contains SQL the reader wrote (or text derived from it). */
  private?: boolean;
};

/** Key shape → description. Matched in order; `prefix` is checked after `match`. */
const KNOWN: { match: (key: string) => boolean; info: StorageKeyInfo }[] = [
  {
    match: (k) => k === 'postgres-lab:ai-cache',
    info: {
      label: 'AI answer cache',
      detail: 'Every answer Claude gave you, keyed by question, plus the SQL and schema text it was asked about. Kept for 7 days.',
      group: 'sql',
      private: true,
    },
  },
  {
    match: (k) => k === 'postgres-lab:playground:history',
    info: { label: 'Query history', detail: 'The last 50 statements you ran, with the ones you pinned.', group: 'sql', private: true },
  },
  {
    match: (k) => k === 'postgres-lab:playground-sql',
    info: { label: 'Playground draft', detail: 'The SQL currently in the editor, so a reload does not lose it.', group: 'sql', private: true },
  },
  {
    match: (k) => k.startsWith('postgres-lab:tr:'),
    info: {
      label: 'Translated lesson',
      detail: 'One AI translation of a lesson, keyed by lesson, language and lesson version.',
      group: 'translations',
      private: true,
    },
  },
  {
    match: (k) => k === 'postgres-lab:progress',
    info: { label: 'Lesson progress', detail: 'Which blocks you ran and passed, per lesson. Drives the progress bars.', group: 'progress' },
  },
  {
    match: (k) => k === 'postgres-lab:playground:bottom',
    info: { label: 'Panel layout', detail: 'Height and collapsed state of the results panel.', group: 'appearance' },
  },
  {
    match: (k) => k === 'postgres-lab:ai-font',
    info: { label: 'Assistant text size', detail: 'The font size you picked for AI answers.', group: 'appearance' },
  },
  {
    match: (k) => k === 'postgres-lab:copilot:pos',
    info: { label: 'Copilot position', detail: 'Where you dragged the floating assistant on lesson pages.', group: 'appearance' },
  },
  {
    match: (k) => k === 'postgres-lab:lang',
    info: { label: 'Preferred language', detail: 'The language you last translated a lesson into.', group: 'appearance' },
  },
  {
    match: (k) => k === 'postgres-lab:ui-lang',
    info: { label: 'Interface language', detail: 'The language the app chrome is written in. Applied before first paint via a script in the document head, so it is also read there.', group: 'appearance' },
  },
  {
    match: (k) => k === 'postgres-lab:db',
    info: {
      label: 'Database connection',
      detail: 'Browser mode or live mode, and for live mode the host, port, database and user. The password and the server token are kept in memory only, never written here.',
      group: 'connection',
    },
  },
  {
    match: (k) => k === 'postgres-lab:theme',
    info: { label: 'Theme', detail: 'Light or dark. Applied before first paint, so it is read from a script in the document head.', group: 'appearance' },
  },
];

export function describeKey(key: string): StorageKeyInfo {
  const hit = KNOWN.find((k) => k.match(key));
  if (hit) return hit.info;
  return { label: key.replace(STORAGE_PREFIX, ''), detail: 'Not described: a key this build does not know about.', group: 'other' };
}

export type StorageEntry = { key: string; bytes: number; info: StorageKeyInfo };

/** Every `postgres-lab:*` key, biggest first. Byte counts are UTF-16 code units × 2, the unit
 * browsers charge against the ~5 MB quota. */
export function listEntries(): StorageEntry[] {
  const out: StorageEntry[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
    const value = localStorage.getItem(key) ?? '';
    out.push({ key, bytes: value.length * 2, info: describeKey(key) });
  }
  return out.sort((a, b) => b.bytes - a.bytes || a.key.localeCompare(b.key));
}

export function removeKey(key: string): void {
  localStorage.removeItem(key);
}

/** Erases only this app's keys, and returns how many went. */
export function eraseAll(): number {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
  }
  keys.forEach((k) => localStorage.removeItem(k));
  return keys.length;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
