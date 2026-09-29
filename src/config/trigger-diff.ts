export const triggerDiffDemo = {
  event: 'UPDATE orders',
  oldRow: { id: '101', status: 'pending', amount: '149.00' },
  newRow: { id: '101', status: 'paid', amount: '149.00' },
  changedColumns: ['status'],
  trigger: 'orders_audit',
  function: 'write_audit_event',
} as const;
