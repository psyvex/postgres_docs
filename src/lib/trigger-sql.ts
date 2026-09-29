export type TriggerDraft = { schema: string; table: string; name: string; functionSchema: string; functionName: string; timing: string; events: string[]; level: string };

const identifier = (value: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`Invalid identifier: ${value}`);
  return `"${value}"`;
};

export function buildCreateTriggerSql(draft: TriggerDraft) {
  const timings = ['BEFORE', 'AFTER', 'INSTEAD OF'];
  const events = ['INSERT', 'UPDATE', 'DELETE'];
  if (!timings.includes(draft.timing)) throw new Error('Unsupported trigger timing.');
  if (!['ROW', 'STATEMENT'].includes(draft.level)) throw new Error('Unsupported trigger level.');
  if (!draft.events.length || draft.events.some((event) => !events.includes(event))) throw new Error('Select at least one valid trigger event.');
  if (!draft.name || !draft.functionName) throw new Error('Trigger and function names are required.');
  const eventSql = draft.events.join(' OR ');
  return `CREATE TRIGGER ${identifier(draft.name)}\n${draft.timing} ${eventSql}\nON ${identifier(draft.schema)}.${identifier(draft.table)}\nFOR EACH ${draft.level}\nEXECUTE FUNCTION ${identifier(draft.functionSchema)}.${identifier(draft.functionName)}();`;
}
