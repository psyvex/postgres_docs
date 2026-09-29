import { NextResponse } from 'next/server';
import { Client } from 'pg';
import { buildCreateTableSql, type TableColumnDraft } from '@/lib/table-sql';

const allowedTypes = new Set(['uuid','text','integer','bigint','numeric','boolean','date','timestamp','timestamptz','jsonb']);

export async function POST(request: Request) {
  const body = await request.json();
  const columns: TableColumnDraft[] = body.columns ?? [];
  if (!body.schema || !body.table || columns.some((column) => !allowedTypes.has(column.type))) return NextResponse.json({ ok: false, error: 'Invalid table definition.' }, { status: 400 });
  let sql: string;
  try { sql = buildCreateTableSql(body.schema, body.table, columns); } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Invalid table definition.' }, { status: 400 }); }
  const client = new Client({ host: body.host, port: Number(body.port), database: body.database, user: body.username, password: body.password, ssl: body.sslMode && body.sslMode !== 'disable' ? { rejectUnauthorized: body.sslMode === 'verify-full' || body.sslMode === 'verify-ca' } : undefined, connectionTimeoutMillis: 5000 });
  try { await client.connect(); await client.query(sql); return NextResponse.json({ ok: true, sql }); }
  catch (error) { return NextResponse.json({ ok: false, sql, error: error instanceof Error ? error.message : 'Table creation failed.' }, { status: 400 }); }
  finally { await client.end().catch(() => undefined); }
}
