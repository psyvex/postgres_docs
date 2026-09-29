export type FlowNodeKind = 'client' | 'context' | 'policy' | 'function' | 'trigger' | 'table' | 'audit';

export const flowDefinitions = {
  rls: {
    title: 'Row visibility pipeline',
    nodes: [
      { id: 'client', kind: 'client' as FlowNodeKind, label: 'Application', detail: 'request' },
      { id: 'context', kind: 'context' as FlowNodeKind, label: 'Session Context', detail: 'app.tenant_id' },
      { id: 'policy', kind: 'policy' as FlowNodeKind, label: 'RLS Policy', detail: 'USING expression' },
      { id: 'table', kind: 'table' as FlowNodeKind, label: 'orders', detail: 'rows' },
    ],
    edges: [['client', 'context'], ['context', 'policy'], ['policy', 'table']],
  },
  functions: {
    title: 'Function execution pipeline',
    nodes: [
      { id: 'client', kind: 'client' as FlowNodeKind, label: 'SQL call', detail: 'SELECT function()' },
      { id: 'function', kind: 'function' as FlowNodeKind, label: 'Function', detail: 'database logic' },
      { id: 'table', kind: 'table' as FlowNodeKind, label: 'orders', detail: 'data access' },
    ],
    edges: [['client', 'function'], ['function', 'table']],
  },
  triggers: {
    title: 'Trigger automation pipeline',
    nodes: [
      { id: 'client', kind: 'client' as FlowNodeKind, label: 'UPDATE', detail: 'row mutation' },
      { id: 'trigger', kind: 'trigger' as FlowNodeKind, label: 'Trigger', detail: 'AFTER UPDATE' },
      { id: 'function', kind: 'function' as FlowNodeKind, label: 'Trigger function', detail: 'write_audit_event' },
      { id: 'audit', kind: 'audit' as FlowNodeKind, label: 'audit_log', detail: 'event stored' },
    ],
    edges: [['client', 'trigger'], ['trigger', 'function'], ['function', 'audit']],
  },
} as const;
