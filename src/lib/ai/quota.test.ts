import { beforeEach, describe, expect, it } from 'vitest';
import { charge, clientIp, humanize, isHeavy, limitLabel, resetQuota } from './quota';

/** Fixed clock sitting exactly on a minute boundary, so retry maths is checkable by hand. */
const T0 = 1_700_000_040_000;
const MIN = 60_000;

const req = (headers: Record<string, string>) => new Request('http://x/api/ai', { headers });

describe('clientIp', () => {
  it('takes the first forwarded hop', () => {
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18' }))).toBe('203.0.113.7');
  });

  it('strips a v4 port, brackets and an IPv6 zone', () => {
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.7:52311' }))).toBe('203.0.113.7');
    expect(clientIp(req({ 'x-forwarded-for': '[2001:db8::1]:443' }))).toBe('2001:db8::1');
    expect(clientIp(req({ 'x-forwarded-for': '2001:db8::1%eth0' }))).toBe('2001:db8::1');
  });

  it('keeps two IPv6 visitors in two buckets', () => {
    // A colon-truncating regex used to reduce both of these to "1" — one shared allowance.
    expect(clientIp(req({ 'x-forwarded-for': '2001:db8::1' }))).toBe('2001:db8::1');
    expect(clientIp(req({ 'x-forwarded-for': '2001:db8::2' }))).toBe('2001:db8::2');
  });

  it('falls back to a shared bucket when nothing is forwarded', () => {
    expect(clientIp(req({}))).toBe('anonymous');
  });
});

describe('charge', () => {
  beforeEach(() => resetQuota());

  it('allows the first request and reports how many are left', () => {
    expect(charge('ip-a', 'ask', T0)).toEqual({ allowed: true, remaining: 59 });
  });

  it('counts every task as one request, the cheap ones too', () => {
    // Ghost-text completion used to cost 0.2 of a "unit"; a count has no fractions to weigh.
    expect(charge('ip-b', 'complete', T0)).toEqual({ allowed: true, remaining: 59 });
    expect(charge('ip-b', 'translateText', T0)).toEqual({ allowed: true, remaining: 58 });
  });

  it('stops a burst beyond the per-minute request limit', () => {
    for (let i = 0; i < 6; i++) expect(charge('ip-c', 'ask', T0).allowed).toBe(true);
    const verdict = charge('ip-c', 'ask', T0);
    expect(verdict).toMatchObject({ allowed: false, limit: 'minute' });
    if (!verdict.allowed) expect(verdict.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it('caps whole-lesson translations separately, at ten an hour', () => {
    // One per minute: clear of the burst cap, so this is the translate allowance doing the work.
    for (let m = 0; m < 10; m++) expect(charge('ip-d', 'translate', T0 + m * MIN).allowed).toBe(true);
    expect(charge('ip-d', 'translate', T0 + 10 * MIN)).toMatchObject({ allowed: false, limit: 'translate' });
    // An ordinary question is unaffected — it just spent 10 of the hourly 60.
    expect(charge('ip-d', 'ask', T0 + 10 * MIN).allowed).toBe(true);
  });

  it('recovers the burst window as the minute rolls over', () => {
    for (let i = 0; i < 6; i++) charge('ip-e', 'ask', T0);
    expect(charge('ip-e', 'ask', T0).allowed).toBe(false);
    expect(charge('ip-e', 'ask', T0 + MIN).allowed).toBe(true);
  });

  it('remembers requests across minutes, so a paced visitor is still metered', () => {
    // One request a minute is the shape a real reader makes; ring slots must survive it.
    for (let m = 0; m < 30; m++) expect(charge('ip-i', 'ask', T0 + m * MIN).allowed).toBe(true);
    expect(charge('ip-i', 'ask', T0 + 30 * MIN)).toEqual({ allowed: true, remaining: 29 });
  });

  it('forgets requests that are older than the window', () => {
    for (let i = 0; i < 6; i++) charge('ip-j', 'ask', T0);
    expect(charge('ip-j', 'ask', T0).allowed).toBe(false);
    // 90 minutes on, every slot is outside the hour: clean slate, not a carried-over debt.
    expect(charge('ip-j', 'ask', T0 + 90 * MIN)).toEqual({ allowed: true, remaining: 59 });
  });

  it('enforces a sliding hourly ceiling, then lets the oldest request age out', () => {
    for (let m = 0; m < 60; m++) expect(charge('ip-f', 'ask', T0 + m * MIN).allowed).toBe(true);
    // The hour is full, so a second request in minute 59 is told to wait for the hour…
    const denied = charge('ip-f', 'ask', T0 + 59 * MIN);
    expect(denied).toMatchObject({ allowed: false, limit: 'hour' });
    // …one minute of waiting, because the oldest request expires exactly then.
    if (!denied.allowed) expect(denied.retryAfterSec).toBe(60);
    // …while a minute later, minute 0 having aged out, exactly one request is free again.
    expect(charge('ip-f', 'ask', T0 + 60 * MIN).allowed).toBe(true);
  });

  it('wraps the ring so an expired request is neither charged twice nor credited', () => {
    for (let m = 0; m < 12; m++) expect(charge('ip-k', 'ask', T0 + m * MIN).allowed).toBe(true);
    expect(charge('ip-k', 'ask', T0 + 58 * MIN)).toEqual({ allowed: true, remaining: 47 }); // 13 spent
    // Minute 60 writes to slot 0, which held minute 0. That request stopped counting the moment
    // minute 60 began, so its expiry pays for this one and the total stays at 13. A slot kept
    // would read 46 here; a slot cleared a minute late would read 48.
    expect(charge('ip-k', 'ask', T0 + 60 * MIN)).toEqual({ allowed: true, remaining: 47 });
    // Flat while the opening block ages out one request per minute: the expiry pays for the new
    // request. Carrying the wrapped slot would read 46, and clearing it a minute late, 48.
    expect(charge('ip-k', 'ask', T0 + 61 * MIN)).toEqual({ allowed: true, remaining: 47 });
    expect(charge('ip-k', 'ask', T0 + 62 * MIN)).toEqual({ allowed: true, remaining: 47 });
    // Minute 72 is past the whole opening block: those 12 requests have aged out, 5 remain spent.
    expect(charge('ip-k', 'ask', T0 + 72 * MIN)).toEqual({ allowed: true, remaining: 55 });
  });

  it('keeps one visitor from spending another visitor\'s allowance', () => {
    for (let i = 0; i < 6; i++) charge('ip-g', 'ask', T0);
    expect(charge('ip-g', 'ask', T0).allowed).toBe(false);
    expect(charge('ip-h', 'ask', T0).allowed).toBe(true);
  });
});

describe('isHeavy', () => {
  it('marks only the whole-lesson job', () => {
    expect(isHeavy('translate')).toBe(true);
    for (const task of ['ask', 'complete', 'translateText', 'explain', 'fix', 'review', 'write', 'simplify'] as const) {
      expect(isHeavy(task)).toBe(false);
    }
  });
});

describe('humanize', () => {
  it('is readable at every scale', () => {
    expect(humanize(5)).toBe('5 s');
    expect(humanize(0)).toBe('1 s'); // never "0 s" — a denial that says "come back in 0 s" is a lie
    expect(humanize(95)).toBe('2 min');
    expect(humanize(7_000)).toBe('117 min'); // stays in minutes below two hours
    expect(humanize(7_200)).toBe('2 h');
  });
});

describe('limitLabel', () => {
  it('names the allowance that ran out, in the reader\'s words', () => {
    expect(limitLabel('minute')).toBe('last minute');
    expect(limitLabel('hour')).toBe('last hour');
    expect(limitLabel('translate')).toBe('hour of whole-lesson translations');
  });
});
