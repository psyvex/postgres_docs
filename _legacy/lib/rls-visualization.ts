export type RlsVisualRow = { id: string; values: Record<string, unknown>; visible: boolean };

export function toVisualRows(rows: Array<Record<string, unknown>>, keyColumn = 'id'): RlsVisualRow[] {
  return rows.map((values, index) => ({
    id: String(values[keyColumn] ?? index + 1),
    values,
    visible: true,
  }));
}

export function summarizeRlsResult(rows: Array<Record<string, unknown>>) {
  return { returned: rows.length, visible: rows.length, filtered: 0 };
}
