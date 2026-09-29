export type TableColumnDraft = { name: string; type: string; nullable: boolean; primaryKey: boolean };

const identifier = (value: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`Invalid identifier: ${value}`);
  return `"${value}"`;
};

export function buildCreateTableSql(schema: string, table: string, columns: TableColumnDraft[]) {
  if (!columns.length) throw new Error('At least one column is required');
  const body = columns.map((column) => `${identifier(column.name)} ${column.type}${column.primaryKey ? ' PRIMARY KEY' : ''}${column.nullable || column.primaryKey ? '' : ' NOT NULL'}`).join(',\n  ');
  return `CREATE TABLE ${identifier(schema)}.${identifier(table)} (\n  ${body}\n);`;
}
