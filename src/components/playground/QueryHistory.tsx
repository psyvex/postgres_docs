'use client';

import { useState } from 'react';
import { Pin, PinOff, Trash2 } from 'lucide-react';
import { getHistory, getPinned, togglePin, isPinned, clearHistory } from '@/lib/playground/history';

type Props = { onRecall: (sql: string) => void };

export function QueryHistory({ onRecall }: Props) {
  const [items, setItems] = useState<string[]>(getHistory);
  const [pinned, setPinned] = useState<string[]>(getPinned);

  const handlePin = (sql: string) => setPinned(togglePin(sql));
  const handleClear = () => { clearHistory(); setItems([]); };

  function Row({ sql }: { sql: string }) {
    const p = isPinned(sql);
    return (
      <div className="group flex items-center gap-1.5 border-b border-line px-3 py-1.5 hover:bg-surface-2">
        <button
          onClick={() => onRecall(sql)}
          className="min-w-0 flex-1 truncate text-left font-mono text-xs text-text"
          title={sql}
        >
          {sql.split('\n')[0].slice(0, 90)}
        </button>
        <button
          onClick={() => handlePin(sql)}
          className="shrink-0 rounded p-1 text-muted opacity-0 transition group-hover:opacity-100 hover:text-brand"
          title={p ? 'Unpin' : 'Pin to keep'}
        >
          {p ? <PinOff size={12} /> : <Pin size={12} />}
        </button>
      </div>
    );
  }

  return (
    <div dir="ltr" className="h-full overflow-y-auto">
      {pinned.length > 0 && (
        <>
          <div className="sticky top-0 border-b border-line bg-surface-2 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
            Pinned
          </div>
          {pinned.map((sql) => <Row key={`p-${sql}`} sql={sql} />)}
        </>
      )}

      {items.length > 0 ? (
        <>
          <div className="sticky top-0 flex items-center justify-between border-b border-line bg-surface-2 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
            <span>Recent</span>
            <button
              onClick={handleClear}
              className="flex items-center gap-1 normal-case tracking-normal text-muted transition hover:text-bad"
            >
              <Trash2 size={10} /> Clear
            </button>
          </div>
          {items.map((sql) => <Row key={`r-${sql}`} sql={sql} />)}
        </>
      ) : (
        <p className="px-4 py-8 text-center text-xs text-muted">
          {pinned.length === 0
            ? 'Run a query and it will appear here. Press ↑ in an empty editor to recall the last one.'
            : 'No recent queries. Pinned queries above are kept.'}
        </p>
      )}
    </div>
  );
}
