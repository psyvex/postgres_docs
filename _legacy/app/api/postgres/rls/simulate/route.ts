import { NextResponse } from 'next/server';
import { Client } from 'pg';
import { buildRlsSimulationSql, validateSimulationQuery, type RlsSimulationDraft } from '@/lib/rls-simulation';

const pgConfig = (body: any) => ({ host: body.host, port: Number(body.port), database: body.database, user: body.username, password: body.password, ssl: body.sslMode && body.sslMode !== 'disable' ? { rejectUnauthorized: body.sslMode === 'verify-full' || body.sslMode === 'verify-ca' } : undefined, connectionTimeoutMillis: 5000 });

export async function POST(request: Request) {
  const body = await request.json();
  const draft: RlsSimulationDraft = body.simulation;
  try { validateSimulationQuery(draft.query); } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Invalid query.' }, { status: 400 }); }
  const client = new Client(pgConfig(body));
  try {
    await client.connect();
    await client.query('BEGIN');
    const settings = draft.settings.filter(({ key }) => /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key));
    for (const setting of settings) await client.query('select set_config($1, $2, true)', [setting.key, setting.value]);
    await client.query(`set local role ${JSON.stringify(draft.role).replace(/^"|"$/g, '"')}`);
    const started = Date.now();
    const result = await client.query(draft.query);
    await client.query('ROLLBACK');
    return NextResponse.json({ ok: true, rowCount: result.rowCount, rows: result.rows, durationMs: Date.now() - started, sql: buildRlsSimulationSql(draft) });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'RLS simulation failed.' }, { status: 400 });
  } finally { await client.end().catch(() => undefined); }
}
