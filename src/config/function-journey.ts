export const functionJourney = {
  title: 'Function call stack',
  steps: [
    { id: 'input', label: 'Parameters', description: 'Values enter the database function.' },
    { id: 'resolve', label: 'Resolve', description: 'PostgreSQL resolves the function signature.' },
    { id: 'execute', label: 'Execute', description: 'The function body runs against database data.' },
    { id: 'return', label: 'Return', description: 'The function returns a typed value.' },
  ],
  sample: { name: 'calculate_order_total', signature: '(tenant_id)', returnType: 'numeric' },
} as const;
