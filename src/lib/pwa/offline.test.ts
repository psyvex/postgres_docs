import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { clearOfflineCaches, readOfflineReport } from './offline';

/**
 * `public/sw.js` is not a module: Next serves it untouched and the browser runs it as a classic
 * worker script. So these tests load the real bytes and evaluate them against a stub worker scope
 * instead of testing a re-typed copy of the policy. A duplicated `decide()` would keep passing while
 * the shipped worker cached answers it must never cache.
 */

type FakeRequest = { url: string; method: string; mode?: string };
type WorkerEvent = {
  request: FakeRequest;
  respondWith: (p: Promise<unknown>) => void;
  waitUntil: (p: Promise<unknown>) => void;
};

const ORIGIN = 'https://lab.test';
const SW_SOURCE = readFileSync(new URL('../../../public/sw.js', import.meta.url), 'utf8');

/** The slice of the worker scope the file touches, with the handlers it registers captured. */
function workerScope(origin = ORIGIN) {
  const handlers = new Map<string, (event: WorkerEvent) => void>();
  const self = {
    location: { origin },
    addEventListener: (type: string, fn: (event: WorkerEvent) => void) => handlers.set(type, fn),
    skipWaiting: vi.fn(),
    clients: { claim: () => Promise.resolve() },
  };
  return { self, handlers };
}

/**
 * `self`, `caches` and `fetch` reach the source as parameters, so each test hands in its own stubs.
 * `decide` is a top-level function declaration, which makes it the value the wrapper returns.
 */
/** The two decisions the shipped file makes, taken out of it as they are used inside it. */
function loadWorker(scope: ReturnType<typeof workerScope>, caches: unknown, fetch: unknown) {
  const evaluate = new Function('self', 'caches', 'fetch', `${SW_SOURCE}
return { decide, cacheable };`) as (
    s: unknown,
    c: unknown,
    f: unknown,
  ) => { decide: (request: FakeRequest) => string; cacheable: (res: FakeResponse, isMonaco: boolean) => boolean };
  return evaluate(scope.self, caches, fetch);
}

/** A Response, as far as the cache decision cares: may I store this, and can I read its status? */
type FakeResponse = { ok: boolean; type: string };

const req = (path: string, init: Partial<FakeRequest> = {}): FakeRequest => ({
  url: `${ORIGIN}${path}`,
  method: 'GET',
  mode: 'cors',
  ...init,
});

describe('public/sw.js routing policy', () => {
  let decide: (request: FakeRequest) => string;
  let handlers: Map<string, (event: WorkerEvent) => void>;

  beforeAll(() => {
    const scope = workerScope();
    handlers = scope.handlers;
    ({ decide } = loadWorker(scope, {}, vi.fn()));
  });

  it('never intercepts the API, not even for a GET', () => {
    // /api/db runs SQL against a live server and /api/ai spends a rate-limited quota. A cached
    // response to either is a wrong answer presented as a right one.
    expect(decide(req('/api/db'))).toBe('passthrough');
    expect(decide(req('/api/ai?sql=select+1'))).toBe('passthrough');
    expect(decide(req('/api', { method: 'POST' }))).toBe('passthrough');
    // The path has to BE /api, not merely contain it.
    expect(decide(req('/apihood'))).toBe('cacheFirst');
  });

  it('never intercepts anything that is not a same-origin GET', () => {
    expect(decide(req('/playground', { method: 'POST' }))).toBe('passthrough');
    expect(decide({ url: 'https://evil.test/api/db', method: 'GET' })).toBe('passthrough');
    expect(decide({ url: 'https://cdn.example.test/font.woff2', method: 'GET' })).toBe('passthrough');
  });

  it('serves hashed chunks and the Monaco CDN cache-first, HTML network-first', () => {
    expect(decide(req('/_next/static/chunks/abc123.js'))).toBe('cacheFirst');
    expect(decide(req('/_next/static/media/pglite.wasm'))).toBe('cacheFirst');
    expect(decide({ url: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js', method: 'GET' })).toBe('cacheFirst');
    expect(decide(req('/playground', { mode: 'navigate' }))).toBe('networkFirst');
    // An RSC payload fetch carries a query string; a new build must not hide behind an old tree.
    expect(decide(req('/learn/rls?_rsc=1a2b'))).toBe('networkFirst');
  });

  it('reads the offline document out of the cache instead of fetching it', () => {
    expect(decide(req('/offline', { mode: 'navigate' }))).toBe('cacheFirst');
  });

  it('registers install, activate and fetch', () => {
    expect([...handlers.keys()].sort()).toEqual(['activate', 'fetch', 'install']);
  });

  it('leaves an API request wholly to the browser', () => {
    // Returning 'passthrough' is half the rule. The handler also has to not answer, which is what an
    // uncalled respondWith shows: an unanswered request is a request the browser handles alone.
    const scope = workerScope();
    loadWorker(scope, {}, vi.fn());
    const respondWith = vi.fn();
    scope.handlers.get('fetch')!({ request: req('/api/db'), respondWith, waitUntil: vi.fn() });
    expect(respondWith).not.toHaveBeenCalled();
  });

  it('answers a navigation the worker has a policy for', () => {
    const scope = workerScope();
    const fetchStub = vi.fn(async () => new Response('from the network'));
    loadWorker(scope, { match: async () => undefined }, fetchStub);
    const respondWith = vi.fn();
    scope.handlers.get('fetch')!({ request: req('/playground', { mode: 'navigate' }), respondWith, waitUntil: vi.fn() });
    expect(respondWith).toHaveBeenCalledTimes(1);
  });
});

/** A CacheStorage stand-in: one cache per key, one entry per number in its list. */
function fakeCacheStorage(entries: Record<string, number[]>) {
  const store = new Map(Object.entries(entries));
  return {
    keys: async () => [...store.keys()],
    open: async (name: string) => ({
      keys: async () => (store.get(name) ?? []).map((n) => ({ url: `https://lab.test/e${n}` })),
      match: async () => undefined,
      put: async () => undefined,
      add: async () => undefined,
    }),
    delete: vi.fn(async (name: string) => store.delete(name)),
  };
}

describe('the offline copy /settings reports', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('counts entries in our caches, most-filled first, and ignores caches that are not ours', async () => {
    vi.stubGlobal('caches', fakeCacheStorage({
      'pglab-pages-v1': [1],
      'pglab-static-v1': [1, 2, 3],
      'someone-elses-cache': [1, 2, 3, 4, 5],
    }));

    const report = await readOfflineReport();
    expect(report.caches).toEqual([
      { name: 'pglab-static-v1', entries: 3 },
      { name: 'pglab-pages-v1', entries: 1 },
    ]);
    // The guard against re-adding a byte figure: every source for one was measured and rejected
    // (see the header of offline.ts), so a report carrying `bytes` is a regression, not a feature.
    expect(report).not.toHaveProperty('bytes');
  });

  it('clears our caches only, and counts what went', async () => {
    const stub = fakeCacheStorage({ 'pglab-static-v1': [1], 'pglab-monaco-v1': [2], 'someone-elses-cache': [3] });
    vi.stubGlobal('caches', stub);

    await expect(clearOfflineCaches()).resolves.toBe(2);
    expect(stub.delete.mock.calls.map((c) => c[0])).toEqual(['pglab-static-v1', 'pglab-monaco-v1']);
  });

  it('says nothing when the browser has no CacheStorage', async () => {
    vi.stubGlobal('caches', undefined);
    await expect(readOfflineReport()).resolves.toEqual({ caches: [] });
    await expect(clearOfflineCaches()).resolves.toBe(0);
  });

  it('counts entries regardless of whether the browser exposes a storage estimate', async () => {
    vi.stubGlobal('caches', fakeCacheStorage({ 'pglab-static-v1': [1, 2] }));
    vi.stubGlobal('navigator', undefined);
    const report = await readOfflineReport();
    expect(report).toEqual({ caches: [{ name: 'pglab-static-v1', entries: 2 }] });
  });
});

describe('what public/sw.js is willing to store', () => {
  let cacheable: (res: FakeResponse, isMonaco: boolean) => boolean;

  beforeAll(() => {
    ({ cacheable } = loadWorker(workerScope(), {}, vi.fn()));
  });

  it('stores our own responses and the ones CORS let the page read', () => {
    expect(cacheable({ ok: true, type: 'basic' }, false)).toBe(true);
    expect(cacheable({ ok: true, type: 'cors' }, false)).toBe(true);
  });

  it('does not store a failure, and does not trust an unreadable status from anywhere else', () => {
    expect(cacheable({ ok: false, type: 'basic' }, false)).toBe(false); // a 404 of our own
    expect(cacheable({ ok: false, type: 'opaque' }, false)).toBe(false); // someone else's, unreadable
    expect(cacheable({ ok: true, type: 'opaque' }, false)).toBe(false);
  });

  it('makes the one exception the editor needs', () => {
    // Monaco loads with classic <script> tags, so its 200s arrive opaque with status 0. `ok` is
    // false for all of them, which is why the CDN gets an exception rather than a status check.
    expect(cacheable({ ok: false, type: 'opaque' }, true)).toBe(true);
  });
});
