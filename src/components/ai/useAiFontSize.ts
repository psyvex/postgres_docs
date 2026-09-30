'use client';

import { useEffect, useState } from 'react';

/**
 * One readable text size for every AI answer on the page (lesson assistant, playground, SQL blocks).
 *
 * Responsive by default — small screens get a smaller base — until the reader picks a size, which is
 * remembered per browser. The size is published as the `--ai-fs` custom property on <html> (see
 * `.ai-text` in globals.css) and every mounted control is notified, so A− in one panel shrinks the
 * answers in every other panel too.
 */
const KEY = 'postgres-lab:ai-font';
const MIN = 11;
const MAX = 22;
const STEP = 1;

const clamp = (v: number) => Math.min(MAX, Math.max(MIN, v));

/** Base size for the current viewport, used while the reader has not chosen one. */
function responsive() {
  const vw = window.innerWidth;
  if (vw < 480) return 13.5;
  if (vw < 768) return 14;
  if (vw < 1280) return 15;
  return 16;
}

function stored(): number | null {
  try {
    const v = parseFloat(localStorage.getItem(KEY) || '');
    return Number.isFinite(v) ? clamp(v) : null;
  } catch {
    return null;
  }
}

let current: number | null = null;
const subs = new Set<(n: number) => void>();

function publish(n: number) {
  current = n;
  document.documentElement.style.setProperty('--ai-fs', `${n}px`);
  subs.forEach((notify) => notify(n));
}

export function useAiFontSize() {
  const [px, setPx] = useState(current ?? 15);
  const [custom, setCustom] = useState(false);

  useEffect(() => {
    const notify = (n: number) => setPx(n);
    subs.add(notify);
    if (current == null) publish(stored() ?? responsive());
    setCustom(stored() !== null);
    // Follow the viewport again while the reader has not chosen a size.
    const onResize = () => stored() === null && publish(responsive());
    window.addEventListener('resize', onResize);
    return () => {
      subs.delete(notify);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const step = (dir: 1 | -1) => {
    const next = clamp((current ?? 15) + dir * STEP);
    try {
      localStorage.setItem(KEY, String(next));
    } catch {}
    setCustom(true);
    publish(next);
  };

  const reset = () => {
    try {
      localStorage.removeItem(KEY);
    } catch {}
    setCustom(false);
    publish(responsive());
  };

  return { px, step, reset, custom, min: MIN, max: MAX };
}
