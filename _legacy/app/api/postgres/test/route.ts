import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function POST(request: Request) {
  const body = await request.json();
  const started = Date.now();
  const client = new Client({
    host: body.host,
    port: Number(body.port),
    database: body.database,
    user: body.username,
    password: body.password,
    ssl: body.sslMode && body.sslMode !== 'disable' ? { rejectUnauthorized: body.sslMode === 'verify-full' || body.sslMode === 'verify-ca' } : undefined,
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    const result = await client.query('select current_database() as database, current_user as user, version() as version');
    return NextResponse.json({ ok: true, latencyMs: Date.now() - started, ...result.rows[0] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Connection failed' }, { status: 400 });
  } finally {
    await client.end().catch(() => undefined);
  }
}
