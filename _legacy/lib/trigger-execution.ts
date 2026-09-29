export type TriggerExecutionRequest = {
  connection: { host: string; port: number; database: string; username: string; password: string; sslMode: string };
  schema: string;
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
};

export function buildTriggerEventStatement(request: TriggerExecutionRequest) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(request.schema) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(request.table)) throw new Error('Invalid table identifier.');
  if (!['INSERT', 'UPDATE', 'DELETE'].includes(request.event)) throw new Error('Unsupported trigger event.');
  const columns = Object.keys(request.payload);
  if (!columns.length) throw new Error('Provide at least one event value.');
  if (request.event !== 'INSERT') throw new Error('The demo event builder currently supports INSERT events only.');
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const literal = (value: unknown) => value === null ? 'NULL' : typeof value === 'number' ? String(value) : typeof value === 'boolean' ? String(value) : `'${String(value).replace(/'/g, "''")}'`;
  return `INSERT INTO ${quote(request.schema)}.${quote(request.table)} (${columns.map(quote).join(', ')}) VALUES (${columns.map((column) => literal(request.payload[column])).join(', ')});`;
}
