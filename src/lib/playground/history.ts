/**
 * Query history for the playground editor.
 *
 * Schema stored in localStorage as `{ items: string[]; pinned: string[] }`:
 *   items  : most-recent-first, deduplicated, capped at MAX_ITEMS
 *   pinned : survives a clear; a query is pinned by its exact trimmed text
 *
 * Pure module: no React, no DOM. Safe to unit-test in Node.
 */

const KEY = 'postgres-lab:playground:history';
const MAX_ITEMS = 50;

type Schema = { items: string[]; pinned: string[] };

const EMPTY: Schema = { items: [], pinned: [] };

function read(): Schema {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY, items: [], pinned: [] };
    const s = JSON.parse(raw) as Partial<Schema>;
    return {
      items: Array.isArray(s.items) ? s.items.filter((v): v is string => typeof v === 'string') : [],
      pinned: Array.isArray(s.pinned) ? s.pinned.filter((v): v is string => typeof v === 'string') : [],
    };
  } catch {
    return { ...EMPTY, items: [], pinned: [] };
  }
}

function write(s: Schema): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // localStorage full or unavailable: silently drop.
  }
}

/** Prepend `sql` (trimmed), deduplicate, cap. Returns the new items list. */
export function pushHistory(sql: string): string[] {
  const text = sql.trim();
  if (!text) return read().items;
  const s = read();
  const items = [text, ...s.items.filter((i) => i !== text)].slice(0, MAX_ITEMS);
  write({ ...s, items });
  return items;
}

export function getHistory(): string[] {
  return read().items;
}

export function getPinned(): string[] {
  return read().pinned;
}

/** Toggle the pin on `sql`. Returns the new pinned list. */
export function togglePin(sql: string): string[] {
  const text = sql.trim();
  if (!text) return read().pinned;
  const s = read();
  const pinned = s.pinned.includes(text)
    ? s.pinned.filter((p) => p !== text)
    : [text, ...s.pinned];
  write({ ...s, pinned });
  return pinned;
}

export function isPinned(sql: string): boolean {
  return read().pinned.includes(sql.trim());
}

/** Clear the recent list. Pinned queries are untouched. */
export function clearHistory(): void {
  const s = read();
  write({ ...s, items: [] });
}
