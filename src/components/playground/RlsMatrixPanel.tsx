'use client';

export type RlsMatrixResult = {
  taskIds: number[];
  personas: { id: string; label: string; taskIds: number[] }[];
  error?: string;
};

export function RlsMatrixPanel({ matrix }: { matrix: RlsMatrixResult }) {
  const { taskIds, personas, error } = matrix;

  if (error) {
    return (
      <div className="rounded-lg border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-bad">
        {error}
      </div>
    );
  }

  if (!taskIds.length) {
    return (
      <p className="text-sm text-muted">
        No rows found. Run the probe on a populated table (the seed has 7 tasks).
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-xs text-muted">
        Each cell shows whether that persona can see that task under the policy in the editor.
        The probe runs inside a transaction and rolls back — the policy is never committed.
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-line">
            <th className="py-1.5 pr-3 text-left font-semibold text-muted">task id</th>
            {personas.map((p) => (
              <th key={p.id} className="px-2 py-1.5 text-center font-semibold text-muted">
                {p.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {taskIds.map((id) => (
            <tr key={id} className="border-b border-line/50 last:border-0">
              <td className="py-1 pr-3 font-mono">{id}</td>
              {personas.map((p) => {
                const visible = p.taskIds.includes(id);
                return (
                  <td key={p.id} className="px-2 py-1 text-center">
                    <span
                      className={
                        visible
                          ? 'inline-flex h-5 w-5 items-center justify-center rounded bg-good-soft text-good'
                          : 'inline-flex h-5 w-5 items-center justify-center rounded bg-bad-soft text-bad'
                      }
                    >
                      {visible ? '✓' : '·'}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-muted">
        Superuser bypasses RLS (sees all rows).{' '}
        <span className="text-good">✓</span> visible · <span className="text-bad">·</span> hidden
      </p>
    </div>
  );
}
