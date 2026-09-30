import { NextResponse } from 'next/server';
import { Client } from 'pg';
import { SESSION_PREFIX, TOKEN_HEADER, toFailure, type StatementResult } from '@/lib/db/types';
import { currentEnv, guardStatus, validateRequest, type DbRequestBody } from '@/lib/db/guard';

export const runtime = 'nodejs';

/** The form asks what this deployment allows before it asks the user for a secret. */
export function GET() {
  return NextResponse.json(guardStatus(currentEnv()));
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const elapsed = () => Math.round(performance.now() - startedAt);
  let client: Client | undefined;
  try {
    const gate = validateRequest((await request.json()) as DbRequestBody, currentEnv(), request.headers.get(TOKEN_HEADER));
    if (!gate.ok) return NextResponse.json(toFailure(new Error(gate.error), elapsed()), { status: gate.status });
    const { connection, sql } = gate;
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
