import { demoData, type LabId, type Order } from './lab-config';

export type QueryResult = { columns: string[]; rows: Record<string, string | number>[]; durationMs: number; rowCount: number; status: 'success' | 'error'; message: string; };
export type QueryIntent = 'select' | 'grant' | 'function' | 'update' | 'unknown';
export type QueryTrace = { intent: QueryIntent; stages: string[]; policyApplied: boolean; rowsConsidered: number; rowsReturned: number; mutation?: { before: Order; after: Order }; };
export type LabState = { activeTenantId: string; rlsEnabled: boolean; orders: Order[]; };

const normalize = (sql: string) => sql.trim().replace(/\s+/g, ' ').toLowerCase();
const intentOf = (sql: string): QueryIntent => { if (sql.startsWith('grant')) return 'grant'; if (sql.includes('calculate_order_total')) return 'function'; if (sql.startsWith('update')) return 'update'; if (sql.startsWith('select')) return 'select'; return 'unknown'; };

export function executeLabQuery(lab: LabId, sql: string, state: LabState): QueryResult {
  return executeTeachingQuery(lab, sql, state).result;
}

export function executeTeachingQuery(lab: LabId, sql: string, state: LabState): { result: QueryResult; trace: QueryTrace } {
  const started = performance.now();
  const normalized = normalize(sql);
  const intent = intentOf(normalized);
  const base = { intent, stages: ['parse'], policyApplied: false, rowsConsidered: state.orders.length, rowsReturned: 0 } satisfies QueryTrace;
  if (!normalized) return { result: makeResult([], [], started, 'error', 'Query is empty.'), trace: base };

  if (lab === 'rls' && intent === 'select' && normalized.includes('orders')) {
    const rows = state.rlsEnabled ? state.orders.filter((order) => order.tenantId === state.activeTenantId) : state.orders;
    const trace: QueryTrace = { ...base, stages: ['parse', 'authorize', ...(state.rlsEnabled ? ['policy'] : []), 'execute', 'result'], policyApplied: state.rlsEnabled, rowsReturned: rows.length };
    return { result: makeResult(['order_id', 'tenant_id', 'amount', 'status'], rows.map((row) => ({ order_id: row.id, tenant_id: row.tenantId, amount: row.amount, status: row.status })), started, 'success', `${rows.length} row${rows.length === 1 ? '' : 's'} returned.`), trace };
  }

  if (lab === 'roles' && intent === 'grant') {
    const trace: QueryTrace = { ...base, stages: ['parse', 'authorize', 'execute', 'result'] };
    return { result: makeResult(['operation', 'status'], [{ operation: sql.trim(), status: 'granted' }], started, 'success', 'Privilege change simulated in the teaching database.'), trace };
  }

  if (lab === 'functions' && intent === 'function') {
    const total = state.orders.reduce((sum, order) => sum + order.amount, 0);
    const trace: QueryTrace = { ...base, stages: ['parse', 'authorize', 'execute', 'result'], rowsReturned: 1 };
    return { result: makeResult(['function', 'result'], [{ function: 'calculate_order_total', result: total }], started, 'success', 'Function executed against the demo dataset.'), trace };
  }

  if (lab === 'triggers' && intent === 'update' && normalized.includes('orders')) {
    const match = normalized.match(/where id = ['\"]?(\d+)/);
    const id = match?.[1] ?? state.orders[0]?.id;
    const before = state.orders.find((order) => order.id === id) ?? state.orders[0];
    if (!before) return { result: makeResult([], [], started, 'error', 'No demo order exists.'), trace: base };
    const after = { ...before, status: 'paid' };
    const trace: QueryTrace = { ...base, stages: ['parse', 'authorize', 'execute', 'result'], rowsReturned: 1, mutation: { before, after } };
    return { result: makeResult(['event', 'trigger', 'audit'], [{ event: `UPDATE orders (${before.id})`, trigger: 'orders_audit', audit: 'created' }], started, 'success', 'Trigger pipeline completed.'), trace };
  }

  return { result: makeResult([], [], started, 'error', 'This teaching lab does not recognize that query yet. Try the example query for the selected lab.'), trace: { ...base, stages: ['parse'] } };
}

function makeResult(columns: string[], rows: Record<string, string | number>[], started: number, status: QueryResult['status'], message: string): QueryResult { return { columns, rows, durationMs: Math.max(1, Math.round(performance.now() - started)), rowCount: rows.length, status, message }; }
export function seedLabState(): LabState { return { activeTenantId: demoData.tenants[0]?.id ?? '', rlsEnabled: true, orders: structuredClone(demoData.orders) }; }
