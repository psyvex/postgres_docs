import { describe, expect, it } from 'vitest';
import { LOCAL_HOSTS, guardStatus, tokenOk, validateRequest } from './guard';

const conn = (host: string) => ({ host, port: 5432, database: 'lab', user: 'postgres', password: '', ssl: false });
const ok = (host = 'localhost') => ({ connection: conn(host), sql: 'SELECT 1' });
const TOKEN = 'a-secret-from-env';

describe('validateRequest: where the database may be', () => {
  it('allows a local database with no token', () => {
    for (const host of LOCAL_HOSTS) {
      expect(validateRequest(ok(host), {}, null)).toMatchObject({ ok: true });
    }
  });

  it('matches hosts case-insensitively and ignores trailing spaces', () => {
    expect(validateRequest(ok(' Localhost '), {}, null)).toMatchObject({ ok: true });
  });

  it('refuses a remote host while the escape hatch is closed', () => {
    const r = validateRequest(ok('db.internal'), {}, null);
    expect(r).toMatchObject({ ok: false, status: 403 });
    if (!r.ok) expect(r.error).toContain('ALLOW_REMOTE_DB=true');
  });

  it('refuses remote hosts when remote is open but no token is configured, failing closed', () => {
    const r = validateRequest(ok('db.internal'), { allowRemoteDb: 'true' }, null);
    expect(r).toMatchObject({ ok: false, status: 403 });
    if (!r.ok) expect(r.error).toContain('DB_QUERY_TOKEN');
  });

  it('still allows localhost in remote mode, so the hatch does not lock the operator out', () => {
    // The token guards the door the hatch opens: non-local hosts. Nothing about localhost changed.
    expect(validateRequest(ok('localhost'), { allowRemoteDb: 'true' }, null)).toMatchObject({ ok: true });
    expect(validateRequest(ok('127.0.0.1'), { allowRemoteDb: 'true', queryToken: TOKEN }, null)).toMatchObject({ ok: true });
  });

  it('accepts a remote host when the token matches', () => {
    expect(validateRequest(ok('db.internal'), { allowRemoteDb: 'true', queryToken: TOKEN }, TOKEN)).toMatchObject({ ok: true });
  });

  it('rejects a missing, empty or wrong token', () => {
    const env = { allowRemoteDb: 'true', queryToken: TOKEN };
    for (const provided of [null, '', 'a-secret-from-en', 'a-secret-from-ren']) {
      expect(validateRequest(ok('db.internal'), env, provided)).toMatchObject({ ok: false, status: 403 });
    }
  });

  it('does not require a token in local mode', () => {
    expect(validateRequest(ok(), { queryToken: TOKEN }, null)).toMatchObject({ ok: true });
  });
});

describe('validateRequest: the request itself', () => {
  it('requires host, database and user', () => {
    for (const patch of [{ host: '' }, { database: '' }, { user: '' }]) {
      expect(validateRequest({ connection: { ...conn('localhost'), ...patch }, sql: 'SELECT 1' }, {}, null)).toMatchObject({ ok: false, status: 400 });
    }
  });

  it('requires SQL and caps its size', () => {
    expect(validateRequest({ connection: conn('localhost'), sql: '   ' }, {}, null)).toMatchObject({ ok: false, status: 400 });
    expect(validateRequest({ connection: conn('localhost'), sql: 'x'.repeat(100_001) }, {}, null)).toMatchObject({ ok: false, status: 413 });
  });

  it('costs nothing to be refused: a bad request shape is checked before the token', () => {
    // Order matters for the quota analogy in /api/ai, and for not leaking which env vars are set.
    expect(validateRequest({ connection: conn('db.internal'), sql: '' }, { allowRemoteDb: 'true' }, null)).toMatchObject({ status: 400 });
  });
});

describe('tokenOk', () => {
  it('is true only for an exact match', () => {
    expect(tokenOk(TOKEN, TOKEN)).toBe(true);
    expect(tokenOk(`${TOKEN}x`, TOKEN)).toBe(false);
    expect(tokenOk(null, TOKEN)).toBe(false);
  });

  it('never compares buffers of unequal length, so the token length is not a side channel', () => {
    // Digests are fixed-size, so a 1-character guess takes the same time as a 100-character one.
    const start = performance.now();
    for (let i = 0; i < 2_000; i++) tokenOk('x', 'x'.repeat(4_000));
    expect(performance.now() - start).toBeLessThan(1_000);
  });
});

describe('guardStatus', () => {
  it('tells the form what to ask for', () => {
    expect(guardStatus({})).toEqual({ remoteAllowed: false, tokenRequired: false, tokenConfigured: false });
    expect(guardStatus({ allowRemoteDb: 'true' })).toEqual({ remoteAllowed: true, tokenRequired: true, tokenConfigured: false });
    expect(guardStatus({ allowRemoteDb: 'true', queryToken: TOKEN })).toEqual({ remoteAllowed: true, tokenRequired: true, tokenConfigured: true });
  });
});
