export type TriggerPayload = Record<string, unknown>;

export function updatePayload(payload: TriggerPayload, key: string, value: string) {
  const trimmed = value.trim();
  if (trimmed === 'null') return { ...payload, [key]: null };
  if (trimmed === 'true') return { ...payload, [key]: true };
  if (trimmed === 'false') return { ...payload, [key]: false };
  if (trimmed !== '' && Number.isFinite(Number(trimmed))) return { ...payload, [key]: Number(trimmed) };
  return { ...payload, [key]: value };
}

export function buildAuditView(result: { rows?: Record<string, unknown>[]; rowCount?: number | null }) {
  return { rows: result.rows ?? [], rowCount: result.rowCount ?? 0 };
}
