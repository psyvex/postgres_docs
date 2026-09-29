export function validateReadOnlyQuery(query: string) {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized.startsWith('select ') && !normalized.startsWith('with ')) throw new Error('Read-only mode accepts SELECT or WITH queries only.');
  if (normalized.includes(';') && !normalized.endsWith(';')) throw new Error('Only one statement is allowed.');
  const forbidden = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|vacuum|refresh)\b/;
  if (forbidden.test(normalized)) throw new Error('Mutation or DDL statements are blocked in read-only mode.');
}
