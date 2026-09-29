export type RlsSimulationDraft = {
  schema: string;
  table: string;
  query: string;
  role: string;
  settings: Array<{ key: string; value: string }>;
};

const identifier = (value: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`Invalid identifier: ${value}`);
  return `"${value}"`;
};

export function buildRlsSimulationSql(draft: RlsSimulationDraft) {
  const settings = draft.settings
    .filter(({ key }) => /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key))
    .map(({ key, value }) => `set_config(${JSON.stringify(key)}, ${JSON.stringify(value)}, false)`)
    .join(', ');
  const role = identifier(draft.role);
  const prefix = settings ? `select ${settings};\n` : '';
  const qualified = `${identifier(draft.schema)}.${identifier(draft.table)}`;
  return `${prefix}set local role ${role};\n${draft.query.replace(/;\s*$/, '')};\n`;
}

export function validateSimulationQuery(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized.startsWith('select ')) throw new Error('The simulator accepts SELECT statements only.');
  if (normalized.includes(';') && !normalized.endsWith(';')) throw new Error('Only one SELECT statement is allowed.');
}
