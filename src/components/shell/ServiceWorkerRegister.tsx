'use client';
import { useEffect } from 'react';

/**
 * Renders nothing. Installs the offline worker once the page is interactive, so it never competes
 * with the first paint, or with the 16 MB of WebAssembly PGlite needs, for the network.
 *
 * The development branch is not decoration. `next dev` and `next start` both bind localhost:3000,
 * and a worker left behind by a production run keeps answering the dev server with the previous
 * build's files, which looks exactly like a broken hot reload. Registering is the easy half; the
 * stale registration is the bug people actually hit.
 *
 * A rejected registration is left unhandled on purpose: no service worker means no offline mode,
 * which is what the "Offline app files" card in /settings reports anyway.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((all) => all.forEach((r) => void r.unregister()));
      return;
    }

    const register = () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register, { once: true });
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
