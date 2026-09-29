export const rowVisualization = {
  columns: ['id', 'tenant_id', 'amount', 'status'],
  labels: { visible: 'Visible to current tenant', hidden: 'Filtered by RLS policy' },
  animation: { staggerMs: 90, decisionMs: 420 },
} as const;
