import { NextResponse } from 'next/server';
import { Client } from 'pg';
import { validateQueryRequest, type QueryRequest } from '@/lib/postgres-query';

export async function POST(request: Request) {
  const startedAt = performance.now();
  let client: Client | undefined;
  try {
    const body = (await request.json()) as QueryRequest;
    validateQueryRequest(body);
    client = new Client({ host: body.connection.host, port: body.connection.port || 5432, database: body.connection.database, user: body.connection.username, password: body.connection.password, ssl: body.connection.sslMode && body.connection.sslMode !== 'disable' ? { rejectUnauthorized: false } : undefined, connectionTimeoutMillis: 8_000 });
    await client.connect();
    const result = await client.query({ text: body.sql, statement_timeout: 15_000 });
    return NextResponse.json({ ok: true, columns: result.fields.map((field) => field.name), rows: result.rows, rowCount: result.rowCount, durationMs: Math.round(performance.now() - startedAt) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PostgreSQL query failed.';
    return NextResponse.json({ ok: false, error: message, durationMs: Math.round(performance.now() - startedAt) }, { status: 400 });
  } finally {
    if (client) await client.end().catch(() => undefined);
  }
}
