/**
 * What the offline copy holds, and how to throw it away.
 *
 * `/settings` promises to show and erase everything this browser keeps, and `listEntries()` in
 * `lib/storage/keys.ts` walks `localStorage` only. Once the service worker is installed, the largest
 * thing this site stores is in `CacheStorage`, which that walk cannot see at all, so the panel would
 * be quietly wrong. This is the piece of CacheStorage the panel reads.
 *
 * The rows carry file counts and no sizes, which is a measurement talking rather than a shrug. Three
 * sources for the byte figure were tried in a production build and all three were rejected:
 *
 * 1. `Content-Length` is present on 1 of the entries this playground produces, a compressed response
 *    stores no such header; summing it reported 6 MB against a copy that really held 17 MB.
 * 2. Reading each body (`blob().size`) is exact for same-origin files (18.1 MB across the static
 *    cache, 0.75 MB across pages) and silently 0 for the editor's, which arrive opaque from the CDN
 *    and are unreadable from a page by specification. A cache holding 13 editor files would print
 *    "0 B" beside "13 files".
 * 3. `navigator.storage.estimate().usageDetails.caches` is the browser's own total and needs no bytes
 *    moved, but it charged 132 MB for a copy whose entries sum to under 23 MB, and it kept reporting
 *    the freed bytes for minutes after every erase in this session's testing (deletion is deferred).
 *    A number that says "146 MB of offline files" above a Clear button that visibly works is worse
 *    than no number.
 *
 * Counts are the one quantity all three sources agree on, so counts are what the card shows.
 */

export type CacheReport = { name: string; entries: number };
export type OfflineReport = { caches: CacheReport[] };

/** Our caches only; another worker on this origin is not ours to report or delete. */
export const PWA_CACHE_PREFIX = 'pglab-';

function isOurs(name: string) {
  return name.startsWith(PWA_CACHE_PREFIX);
}

export async function readOfflineReport(): Promise<OfflineReport> {
  if (typeof caches === 'undefined') return { caches: [] };

  const names = (await caches.keys()).filter(isOurs);
  const rows = await Promise.all(
    names.map(async (name) => ({ name, entries: (await (await caches.open(name)).keys()).length })),
  );
  rows.sort((a, b) => b.entries - a.entries);
  return { caches: rows };
}

/** Returns how many caches were deleted, which is what the panel reports. */
export async function clearOfflineCaches(): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  const names = (await caches.keys()).filter(isOurs);
  const gone = await Promise.all(names.map((name) => caches.delete(name)));
  return gone.filter(Boolean).length;
}
