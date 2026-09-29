import { NextResponse } from 'next/server';
import { Client } from 'pg';
import { schemaQueries } from '@/lib/postgres-schema';

function configFrom(body: any) { return { host: body.host, port: Number(body.port), database: body.database, user: body.username, password: body.password, ssl: body.sslMode && body.sslMode !== 'disable' ? { rejectUnauthorized: body.sslMode === 'verify-full' || body.sslMode === 'verify-ca' } : undefined, connectionTimeoutMillis: 5000 }; }

export async function POST(request: Request) {
  const body = await request.json();
  const client = new Client(configFrom(body));
  try {
    await client.connect();
    const tables = await client.query(schemaQueries.tables);
    const details = await Promise.all(tables.rows.map(async (table) => {
      const [columns, indexes, policies, triggers] = await Promise.all([
        client.query(schemaQueries.columns, [table.table_schema, table.table_name]),
        client.query(schemaQueries.indexes, [table.table_schema, table.table_name]),
        client.query(schemaQueries.policies, [table.table_schema, table.table_name]),
        client.query(schemaQueries.triggers, [table.table_schema, table.table_name]),
      ]);
      return { schema: table.table_schema, name: table.table_name, columns: columns.rows.map((row) => ({ name: row.column_name, type: row.data_type, nullable: row.is_nullable === 'YES', defaultValue: row.column_default, position: row.ordinal_position })), indexes: indexes.rows.map((row) => ({ name: row.indexname, definition: row.indexdef })), policies: policies.rows.map((row) => ({ name: row.policyname, permissive: row.permissive, roles: row.roles, command: row.cmd, using: row.qual, withCheck: row.with_check })), triggers: triggers.rows.map((row) => ({ name: row.trigger_name, event: row.event_manipulation, timing: row.action_timing, action: row.action_statement })) };
    }));
    return NextResponse.json({ ok: true, tables: details });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Schema inspection failed' }, { status: 400 }); }
  finally { await client.end().catch(() => undefined); }
}
