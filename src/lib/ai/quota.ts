import 'server-only';
import type { AiTask } from './client';

/**
 * Per-visitor budget for `/api/ai`.
 *
 * The process-wide semaphore in `server.ts` protects the provider from a flood; it does nothing
 * about one page scripted from a single laptop, which can drain an API key overnight. This is the
 * other half: a **count of requests** per client IP, in two sliding windows so there is no
 * midnight boundary to game.
 *
 *   AI_REQUESTS_PER_HOUR     requests in the last hour        (default 60) : stops grinding
 *   AI_MINUTE_BURST          requests in the last minute      (default 6)  : stops rapid-fire
 *   AI_TRANSLATE_PER_HOUR    whole-lesson translations/hour   (default 10) : the one heavy task
 *
 * Counting requests, not weighted "units", is deliberate: it is the number the reader can reason
 * about ("41 of 60 left"), it never prints a fraction in an error message, and the answer card can
 * show it verbatim. The cost of simplicity is that requests are not equal: a whole-lesson
 * `translate` asks for 32k output tokens where an answer asks for 8k, so that single task gets its
 * own, smaller count inside the same windows. Everything else is one request, one count.
 *
 * Cost is charged before the call. A request that fails upstream has spent its count: the
 * alternative is a meter that can be refilled by provoking errors.
 */
const env = (key: string, fallback: number) => {
  const raw = process.env[key]?.trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

const HOURLY = env('AI_REQUESTS_PER_HOUR', 60);
const BURST = env('AI_MINUTE_BURST', 6);
const TRANSLATE_HOURLY = env('AI_TRANSLATE_PER_HOUR', 10);
const MINUTES = 60;
/** Keys idle longer than this are dropped; the window is an hour, so they carry no history. */
const IDLE_MS = 2 * 60 * 60 * 1000;
/** Ceiling on tracked IPs, so the store can't be grown by spraying unique addresses. */
const MAX_KEYS = 20_000;

export const QUOTA_LIMITS = { hourly: HOURLY, burstPerMinute: BURST, translatePerHour: TRANSLATE_HOURLY };

/** `translate` is the whole-lesson job: counted twice, once generally and once against its own cap. */
export function isHeavy(task: AiTask) {
  return task === 'translate';
}

export type QuotaVerdict =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSec: number; limit: 'minute' | 'hour' | 'translate' };

type Window = { requests: Float64Array; translates: Float64Array; minute: number; lastSeen: number };
const store = new Map<string, Window>();

const slotFor = (minute: number) => ((minute % MINUTES) + MINUTES) % MINUTES;

/**
 * First `x-forwarded-for` hop, with the parts that vary per connection removed, so one device
 * lands in one bucket. Proxies append a source port, and a bucket per port is a fresh allowance
 * per request; an IPv6 zone id is the same problem in a nicer coat. Bracketed IPv6 is handled per
 * RFC 7239 (`[2001:db8::1]:443`), deliberately not with a "looks like a colon address" regex:
 * matching `2001:db8::1` to its last group folds every address ending in digits (most of them)
 * into a single shared allowance.
 */
export function clientIp(request: Request) {
  const raw = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';
  const host = raw
    .replace(/^\[([^\]]+)\](?::\d+)?$/, '$1')
    .replace(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/, '$1')
    .replace(/%[0-9a-z._-]+$/i, '');
  return host || 'anonymous';
}

/**
 * Zero the slots the clock just walked into, so old requests fall out of the window.
 *
 * Each ring is exactly as long as the window, so the slot for the current minute is the slot of
 * `minute - 60`, a minute that stopped counting the moment this one began. Clearing every slot
 * being stepped into is therefore the whole of the bookkeeping, and it is one slot *forward* from
 * the old minute: clearing backwards (the first version) erased the newest count on the common
 * one-request-per-minute path, so the hourly window never rose above one request.
 */
function roll(window: Window, minute: number) {
  const gap = minute - window.minute;
  if (gap <= 0) return;
  for (let i = 1; i <= Math.min(MINUTES, gap); i++) {
    const slot = slotFor(window.minute + i);
    window.requests[slot] = 0;
    window.translates[slot] = 0;
  }
  window.minute = minute;
}

function used(counts: Float64Array, minute: number, span: number) {
  let total = 0;
  for (let i = 0; i < span; i++) total += counts[slotFor(minute - i)];
  return total;
}

/**
 * Seconds until the window can take one more request. Walks the clock forward and re-adds only the
 * history still inside the window at that moment, so the answer is the real expiry of the oldest
 * request: not a fixed "come back in an hour".
 */
function waitForRoom(window: Window, minute: number, limit: 'minute' | 'hour' | 'translate', now: number) {
  const secondsIntoMinute = Math.floor((now % 60_000) / 1000);
  if (limit === 'minute') return Math.max(1, 60 - secondsIntoMinute);
  const counts = limit === 'translate' ? window.translates : window.requests;
  const cap = limit === 'translate' ? TRANSLATE_HOURLY : HOURLY;
  for (let ahead = 1; ahead <= MINUTES; ahead++) {
    const at = minute + ahead;
    let total = 0;
    for (let m = at - MINUTES + 1; m <= minute; m++) total += counts[slotFor(m)];
    if (total + 1 <= cap) return ahead * 60 - secondsIntoMinute;
  }
  return MINUTES * 60;
}

function evict(now: number) {
  for (const [key, window] of store) if (now - window.lastSeen > IDLE_MS) store.delete(key);
  if (store.size >= MAX_KEYS) {
    const oldest = [...store.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen)[0];
    if (oldest) store.delete(oldest[0]);
  }
}

/** Charges one request to `key` when every window can absorb it. Fixed `now` makes it testable. */
export function charge(key: string, task: AiTask, now = Date.now()): QuotaVerdict {
  const minute = Math.floor(now / 60_000);
  let window = store.get(key);
  if (!window) {
    if (store.size >= MAX_KEYS) evict(now);
    window = { requests: new Float64Array(MINUTES), translates: new Float64Array(MINUTES), minute, lastSeen: now };
    store.set(key, window);
  }
  roll(window, minute);
  window.lastSeen = now;

  const checks = [
    { limit: 'minute' as const, counts: window.requests, cap: BURST, span: 1 },
    { limit: 'hour' as const, counts: window.requests, cap: HOURLY, span: MINUTES },
    ...(isHeavy(task) ? [{ limit: 'translate' as const, counts: window.translates, cap: TRANSLATE_HOURLY, span: MINUTES }] : []),
  ];
  for (const check of checks) {
    if (used(check.counts, minute, check.span) + 1 > check.cap) {
      return { allowed: false, retryAfterSec: waitForRoom(window, minute, check.limit, now), limit: check.limit };
    }
  }
  window.requests[slotFor(minute)] += 1;
  if (isHeavy(task)) window.translates[slotFor(minute)] += 1;
  return { allowed: true, remaining: Math.max(0, HOURLY - used(window.requests, minute, MINUTES)) };
}

export function chargeAi(request: Request, task: AiTask, now = Date.now()) {
  return charge(clientIp(request), task, now);
}

/** Plain-English span for the reader-facing message. */
export function humanize(seconds: number) {
  if (seconds < 60) return `${Math.max(1, seconds)} s`;
  const mins = Math.ceil(seconds / 60);
  return mins < 120 ? `${mins} min` : `${Math.round(mins / 60)} h`;
}

/** What the message says about which allowance ran out. */
export function limitLabel(limit: 'minute' | 'hour' | 'translate') {
  if (limit === 'minute') return 'last minute';
  if (limit === 'translate') return 'hour of whole-lesson translations';
  return 'last hour';
}

/** Test seam: forget every window. */
export function resetQuota() {
  store.clear();
}
