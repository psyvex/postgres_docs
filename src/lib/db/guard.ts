import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { LiveConnection } from './types';

/**
 * The gate in front of `/api/db/query`: the one route that runs arbitrary SQL.
 *
 * Default: hosts on this machine only. `ALLOW_REMOTE_DB=true` opens the door to any host the
 * operator names, which turns the route into a remote-code-execution surface for whoever can reach
 * the port, so opening it *requires* `DB_QUERY_TOKEN`: every request must then carry that value in
 * the `x-db-token` header. Remote mode with no token configured fails **closed**: the route
 * refuses everything and says what to set, rather than running wide open on a half-configured box.
 *
 * Local mode needs no token: the localhost guard *is* the control there, and a browser has no way
 * to know a server secret. Keeping the token out of local mode keeps it out of the UI, too.
 */
export const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'host.docker.internal']);
export const MAX_SQL_LENGTH = 100_000;

export type GuardEnv = { allowRemoteDb?: string; queryToken?: string };

/** Read the gate's two variables. Kept separate so tests pass their own environment. */
export function currentEnv(): GuardEnv {
  return {
    allowRemoteDb: process.env.ALLOW_REMOTE_DB?.trim(),
    queryToken: process.env.DB_QUERY_TOKEN?.trim(),
  };
}

export type Validated =
  | { ok: true; connection: LiveConnection; sql: string }
  | { ok: false; error: string; status: number };

/** What `/api/db/query` accepts; the client sends exactly this. */
export type DbRequestBody = { connection?: LiveConnection; sql?: string };

type Body = DbRequestBody;

/**
 * Timing-safe equality. Both sides are hashed first, so the comparison length reveals nothing
 * about the token and a short guess cannot fail early.
 */
export function tokenOk(provided: string | null, expected: string) {
  if (!provided) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function validateRequest(body: Body, env: GuardEnv, providedToken: string | null): Validated {
  const { connection, sql } = body;
  if (!connection?.host || !connection.database || !connection.user) {
    return { ok: false, status: 400, error: 'Host, database and user are required.' };
  }
  if (!sql?.trim()) return { ok: false, status: 400, error: 'SQL is required.' };
  if (sql.length > MAX_SQL_LENGTH) return { ok: false, status: 413, error: 'SQL exceeds the maximum size.' };

  const remoteAllowed = env.allowRemoteDb === 'true';
  const isLocal = LOCAL_HOSTS.has(connection.host.trim().toLowerCase());
  if (!remoteAllowed && !isLocal) {
    return {
      ok: false,
      status: 403,
      error: 'Only local databases are allowed. Set ALLOW_REMOTE_DB=true in .env.local to connect elsewhere, and DB_QUERY_TOKEN with it.',
    };
  }
  // The token guards exactly the door the escape hatch opens: non-local hosts. A localhost
  // connection stays reachable without a secret in remote mode too, so turning the hatch on does
  // not lock the operator out of their own database.
  if (remoteAllowed && !isLocal) {
    if (!env.queryToken) {
      return {
        ok: false,
        status: 403,
        error: 'This server sets ALLOW_REMOTE_DB=true but has no DB_QUERY_TOKEN, so remote connections are refused. Set DB_QUERY_TOKEN in .env.local, then paste the same value into the "Server token" field.',
      };
    }
    if (!tokenOk(providedToken, env.queryToken)) {
      return { ok: false, status: 403, error: 'This server requires a database token. Paste the DB_QUERY_TOKEN value into the "Server token" field.' };
    }
  }
  return { ok: true, connection, sql };
}

/** What the connection form asks for: is remote open, and does it cost a token? */
export function guardStatus(env: GuardEnv) {
  return {
    remoteAllowed: env.allowRemoteDb === 'true',
    tokenRequired: env.allowRemoteDb === 'true',
    tokenConfigured: Boolean(env.queryToken),
  };
}
