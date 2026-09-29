import { NextResponse } from 'next/server';
import { Client } from 'pg';
import { SESSION_PREFIX, toFailure, type LiveConnection, type StatementResult } from '@/lib/db/types';

export const runtime = 'nodejs';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'host.docker.internal']);
const MAX_SQL_LENGTH = 100_000;

type Body = { connection?: LiveConnection; sql?: string };

function validate(body: Body): { connection: LiveConnection; sql: string } {
  const { connection, sql } = body;
  if (!connection?.host || !connection.database || !connection.user) throw new Error('Host, database and user are required.');
  if (!sql?.trim()) throw new Error('SQL is required.');
  if (sql.length > MAX_SQL_LENGTH) throw new Error('SQL exceeds the maximum size.');
  // This route executes arbitrary SQL, so by default it only talks to databases on this machine.
  if (process.env.ALLOW_REMOTE_DB !== 'true' && !LOCAL_HOSTS.has(connection.host.trim().toLowerCase())) {
    throw new Error('Only local databases are allowed. Set ALLOW_REMOTE_DB=true in .env.local to connect elsewhere.');
  }
  return { connection, sql };
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const elapsed = () => Math.round(performance.now() - startedAt);
  let client: Client | undefined;
  try {
    const { connection, sql } = validate((await request.json()) as Body);
    client = new Client({
      host: connection.host,
      port: connection.port || 5432,
      database: connection.database,
      user: connection.user,
      password: connection.password || undefined,
      ssl: connection.ssl ? { rejectUnauthorized: true } : undefined,
      connectionTimeoutMillis: 8_000,
      statement_timeout: 15_000,
      application_name: 'postgres-lab',
    });
    await client.connect();
    const raw = await client.query(`${SESSION_PREFIX}\n${sql}`);
    const list = (Array.isArray(raw) ? raw : [raw]).slice(1);
    const results: StatementResult[] = list.map((r) => ({
      columns: r.fields?.map((f: { name: string }) => f.name) ?? [],
      rows: r.rows ?? [],
      rowCount: r.rowCount,
    }));
    return NextResponse.json({ ok: true, results, durationMs: elapsed() });
  } catch (error) {
    return NextResponse.json(toFailure(error, elapsed()));
  } finally {
    // Each request gets its own connection, so SET ROLE / set_config never leak between runs.
    await client?.end().catch(() => undefined);
  }
}
