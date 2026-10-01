'use client';

import { CloudOff, RotateCcw } from 'lucide-react';

/**
 * The document the service worker serves when a navigation has no network and no cached copy. It is
 * the only resource the worker installs eagerly, because nothing can fetch it on first use: by the
 * time it is needed, fetching is the thing that is broken.
 *
 * Written to be true rather than reassuring. The Browser mode playground really does work with no
 * connection (Postgres is WASM in this tab, its files are cached, its data is IndexedDB), so the
 * page says so and links there, instead of pretending the whole site is dead.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col items-start justify-center gap-4 px-4 py-16">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-muted">
        <CloudOff className="h-5 w-5" />
      </span>

      <h1 className="text-3xl font-extrabold tracking-tight">This page is not cached yet</h1>

      <p className="text-muted">
        You are offline, and this is the first time Postgres Lab has had to show you this page. Once a page has been visited
        with a connection, the app keeps a copy and it will open offline from then on.
      </p>

      <p className="text-sm text-muted">
        The playground does not need the network. In <span className="font-semibold text-text">Browser</span> mode Postgres runs as
        WebAssembly inside this tab and its data lives in IndexedDB, so queries, the schema and everything you write stay
        available. Only the assistant and <span className="font-semibold text-text">Live</span> mode need a server.
      </p>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-on-brand"
        >
          <RotateCcw className="h-4 w-4" /> Try again
        </button>
        <a href="/playground" className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-surface-2">
          Open the playground
        </a>
      </div>
    </main>
  );
}
