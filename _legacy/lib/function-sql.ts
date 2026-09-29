export type FunctionParameter = { name: string; type: string };
export type FunctionDraft = { schema: string; name: string; language: string; returnMode: string; returnType: string; parameters: FunctionParameter[]; body: string };

const identifier = (value: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`Invalid identifier: ${value}`);
  return `"${value}"`;
};

const allowedTypes = new Set(['uuid', 'text', 'integer', 'bigint', 'numeric', 'boolean', 'date', 'timestamp', 'timestamptz', 'jsonb']);

export function buildCreateFunctionSql(draft: FunctionDraft) {
  if (!['sql', 'plpgsql'].includes(draft.language)) throw new Error('Unsupported function language.');
  if (!['scalar', 'table'].includes(draft.returnMode)) throw new Error('Unsupported return mode.');
  if (!allowedTypes.has(draft.returnType)) throw new Error('Unsupported return type.');
  const params = draft.parameters.map((parameter) => {
    if (!allowedTypes.has(parameter.type)) throw new Error(`Unsupported parameter type: ${parameter.type}`);
    return `${identifier(parameter.name)} ${parameter.type}`;
  }).join(', ');
  const returns = draft.returnMode === 'table' ? `RETURNS TABLE (result ${draft.returnType})` : `RETURNS ${draft.returnType}`;
  const body = draft.language === 'plpgsql' ? `BEGIN\n  ${draft.body.trim()}\nEND;` : draft.body.trim();
  return `CREATE OR REPLACE FUNCTION ${identifier(draft.schema)}.${identifier(draft.name)}(${params})\n${returns}\nLANGUAGE ${draft.language}\nAS $$\n${body}\n$$;`;
}

export function buildCallFunctionSql(draft: FunctionDraft, values: string[]) {
  if (values.length !== draft.parameters.length) throw new Error('Provide a value for every function parameter.');
  const args = values.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ');
  return `SELECT * FROM ${identifier(draft.schema)}.${identifier(draft.name)}(${args});`;
}
