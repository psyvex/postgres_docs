export const functionLanguages = ['sql', 'plpgsql'] as const;
export const functionReturnModes = ['scalar', 'table'] as const;
export const functionLabCopy = {
  title: 'Database functions lab',
  create: 'Create function',
  call: 'Call function',
  preview: 'SQL Preview',
  parameters: 'Parameters',
  body: 'Function body',
  returnType: 'Return type',
  language: 'Language',
} as const;

export const functionDefaults = {
  schema: 'public',
  name: 'tenant_order_count',
  language: 'sql',
  returnMode: 'scalar',
  returnType: 'integer',
  parameters: [{ name: 'tenant_id', type: 'uuid' }],
  body: 'SELECT count(*)::integer FROM public.orders WHERE orders.tenant_id = $1;',
} as const;
