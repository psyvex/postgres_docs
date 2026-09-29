export const appNavigation = [
  { id: 'overview', label: 'Overview', href: '/postgres/overview' },
  { id: 'sql', label: 'SQL Editor', href: '/postgres/sql' },
  { id: 'explorer', label: 'Database Explorer', href: '/postgres/explorer' },
] as const;

export const labNavigation = [
  { id: 'rls', label: 'Row-Level Security', href: '/postgres/rls' },
  { id: 'functions', label: 'Database Functions', href: '/postgres/functions' },
  { id: 'triggers', label: 'Triggers', href: '/postgres/triggers' },
  { id: 'transactions', label: 'Transactions', href: '/postgres/transactions' },
] as const;

export const shellCopy = {
  product: 'Postgres Lab',
  environment: 'Interactive PostgreSQL workstation',
  connection: 'Connection',
  connected: 'Connected',
  disconnected: 'Not connected',
  lightTheme: 'Light theme',
  darkTheme: 'Dark theme',
  settings: 'Settings',
  search: 'Search workspace',
} as const;
