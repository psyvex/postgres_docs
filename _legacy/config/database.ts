export const databaseConnectionDefaults = {
  port: 5432,
  sslMode: 'prefer',
  timeoutMs: 5000,
} as const;

export const databaseConnectionFields = [
  { id: 'host', label: 'Host', placeholder: 'localhost', type: 'text' },
  { id: 'port', label: 'Port', placeholder: '5432', type: 'number' },
  { id: 'database', label: 'Database', placeholder: 'postgres', type: 'text' },
  { id: 'username', label: 'Username', placeholder: 'postgres', type: 'text' },
  { id: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
] as const;

export const sslModes = ['disable', 'prefer', 'require', 'verify-ca', 'verify-full'] as const;
