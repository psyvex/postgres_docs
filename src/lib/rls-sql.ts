export type RlsPolicyDraft = { schema: string; table: string; name: string; command: string; roles: string[]; usingExpression: string; withCheckExpression: string };

const identifier = (value: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`Invalid identifier: ${value}`);
  return `"${value}"`;
};

export function buildEnableRlsSql(schema: string, table: string) {
  return `ALTER TABLE ${identifier(schema)}.${identifier(table)} ENABLE ROW LEVEL SECURITY;`;
}

export function buildCreatePolicySql(draft: RlsPolicyDraft) {
  if (!draft.usingExpression.trim() && !draft.withCheckExpression.trim()) throw new Error('Provide a USING or WITH CHECK expression.');
  const command = draft.command === 'ALL' ? 'ALL' : draft.command;
  const roles = draft.roles.length ? draft.roles.map(identifier).join(', ') : 'PUBLIC';
  const using = draft.usingExpression.trim() ? ` USING (${draft.usingExpression.trim()})` : '';
  const check = draft.withCheckExpression.trim() ? ` WITH CHECK (${draft.withCheckExpression.trim()})` : '';
  return `CREATE POLICY ${identifier(draft.name)}\nON ${identifier(draft.schema)}.${identifier(draft.table)}\nAS PERMISSIVE\nFOR ${command}\nTO ${roles}${using}${check};`;
}
