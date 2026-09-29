export const rowCompareConfig = {
  title: 'OLD → NEW',
  columns: ['field', 'oldValue', 'newValue'],
  changedLabel: 'changed',
  unchangedLabel: 'unchanged',
  sample: [
    { field: 'status', oldValue: 'pending', newValue: 'paid' },
    { field: 'amount', oldValue: '149.00', newValue: '149.00' },
  ],
} as const;
