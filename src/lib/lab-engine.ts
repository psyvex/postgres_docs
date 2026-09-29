import { demoData, type LabId, type Order } from './lab-config';

export type QueryResult = {
  columns: string[];
  rows: Record<string, string | number>[];
  durationMs: number;
  rowCount: number;
  status: 'success' | 'error';
  message: string;
};

export type LabState = {
  activeTenantId: string;
  rlsEnabled: boolean;
  orders: Order[];
};

const normalize = (sql: string) => sql.trim().replace(/\s+/g, ' ').toLowerCase();

export function executeLabQuery(lab: LabId, sql: string, state: LabState): QueryResult {
  const started = performance.now();
  const normalized = normalize(sql);

  if (!normalized) return result([], [], started, 'error', 'Query is empty.');

  if (lab === 'rls' && normalized.includes('select') && normalized.includes('orders')) {
    const rows = state.rlsEnabled
      ? state.orders.filter((order) => order.tenantId === state.activeTenantId)
      : state.orders;
    return result(['order_id', 'tenant_id', 'amount', 'status'], rows.map((row) => ({
      order_id: row.id, tenant_id: row.tenantId, amount: row.amount, status: row.status,
    })), started, 'success', `${rows.length} row${rows.length === 1 ? '' : 's'} returned.`);
  }

  if (lab === 'roles' && normalized.startsWith('grant')) {
    return result(['operation', 'status'], [{ operation: sql.trim(), status: 'granted' }], started, 'success', 'Privilege change simulated in the teaching database.');
  }

  if (lab === 'functions' && normalized.includes('calculate_order_total')) {
    const total = state.orders.reduce((sum, order) => sum + order.amount, 0);
    return result(['function', 'result'], [{ function: 'calculate_order_total', result: total }], started, 'success', 'Function executed against the demo dataset.');
  }

  if (lab === 'triggers' && normalized.startsWith('update') && normalized.includes('orders')) {
    return result(['event', 'trigger', 'audit'], [{ event: 'UPDATE orders', trigger: 'orders_audit', audit: 'created' }], started, 'success', 'Trigger pipeline completed.');
  }

  return result([], [], started, 'error', 'This teaching lab does not recognize that query yet. Try the example query for the selected lab.');
}

function result(columns: string[], rows: Record<string, string | number>[], started: number, status: QueryResult['status'], message: string): QueryResult {
  return { columns, rows, durationMs: Math.max(1, Math.round(performance.now() - started)), rowCount: rows.length, status, message };
}

export function seedLabState(): LabState {
  return { activeTenantId: demoData.tenants[0]?.id ?? '', rlsEnabled: true, orders: structuredClone(demoData.orders) };
}
