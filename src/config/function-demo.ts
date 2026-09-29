export const functionDemo = {
  name: 'calculate_order_total',
  signature: 'calculate_order_total(order_id uuid)',
  input: { label: 'order_id', value: '101' },
  stages: [
    { id: 'resolve', label: 'Resolve function', detail: 'PostgreSQL resolves the function signature.', tone: 'cyan' },
    { id: 'execute', label: 'Execute body', detail: 'The function evaluates its SQL statements.', tone: 'purple' },
    { id: 'read', label: 'Read rows', detail: 'Order data is read from the database.', tone: 'green' },
    { id: 'return', label: 'Return value', detail: 'The calculated value becomes the query result.', tone: 'cyan' },
  ],
  result: { label: 'total', value: '149.00', type: 'numeric' },
} as const;
