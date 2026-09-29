export type LabId = 'rls' | 'roles' | 'functions' | 'triggers';

export type Tenant = { id: string; name: string };
export type Order = { id: string; tenantId: string; amount: number; status: string };

export type LabDefinition = {
  id: LabId;
  title: string;
  eyebrow: string;
  description: string;
  color: string;
  sql: string;
  steps: { title: string; description: string }[];
};

export const demoData = {
  tenants: [
    { id: 'a1', name: 'Acme' },
    { id: 'b2', name: 'Globex' },
  ] satisfies Tenant[],
  orders: [
    { id: '101', tenantId: 'a1', amount: 120, status: 'paid' },
    { id: '102', tenantId: 'a1', amount: 340, status: 'processing' },
    { id: '201', tenantId: 'b2', amount: 900, status: 'paid' },
    { id: '202', tenantId: 'b2', amount: 75, status: 'pending' },
  ] satisfies Order[],
};

export const labs: LabDefinition[] = [
  {
    id: 'rls', title: 'Row-Level Security', eyebrow: 'Lab 01', color: 'var(--cyan)',
    description: 'See PostgreSQL decide which rows a tenant can read or change.',
    sql: 'SELECT * FROM orders;',
    steps: [
      { title: 'Change context', description: 'Switch the current tenant and run the query.' },
      { title: 'Break it', description: 'Disable the policy and observe the isolation boundary disappear.' },
      { title: 'Explain it', description: 'Connect USING, session context, and row visibility.' },
    ],
  },
  {
    id: 'roles', title: 'Roles & Permissions', eyebrow: 'Lab 02', color: 'var(--purple)',
    description: 'Separate database privileges from row-level authorization.',
    sql: 'GRANT SELECT ON orders TO app_user;',
    steps: [
      { title: 'Grant access', description: 'Give a role the minimum table privilege it needs.' },
      { title: 'Add policy', description: 'Layer row filtering on top of the table privilege.' },
      { title: 'Test', description: 'Compare a permitted operation with a denied one.' },
    ],
  },
  {
    id: 'functions', title: 'Database Functions', eyebrow: 'Lab 03', color: 'var(--green)',
    description: 'Make reusable, database-side behavior visible and testable.',
    sql: 'SELECT calculate_order_total($1);',
    steps: [
      { title: 'Define', description: 'Create a function with explicit inputs and outputs.' },
      { title: 'Execute', description: 'Call it from SQL and inspect the result.' },
      { title: 'Secure', description: 'Discuss execution context and safe function design.' },
    ],
  },
  {
    id: 'triggers', title: 'Triggers', eyebrow: 'Lab 04', color: 'var(--orange)',
    description: 'Turn database events into automatic, observable actions.',
    sql: 'UPDATE orders SET status = \'paid\' WHERE id = $1;',
    steps: [
      { title: 'Mutate', description: 'Change a row using ordinary SQL.' },
      { title: 'Trigger', description: 'Watch the database invoke the trigger function.' },
      { title: 'Audit', description: 'Inspect the resulting audit event.' },
    ],
  },
];

export const defaultSql = 'SELECT * FROM orders;';
