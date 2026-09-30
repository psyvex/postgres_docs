'use client';

import { diffLines } from 'diff';

export function DiffView({ original, improved }: { original: string; improved: string }) {
  const parts = diffLines(original + '\n', improved + '\n');
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-code-bg text-xs leading-relaxed">
      <pre className="p-3 font-mono">
        {parts.map((part, i) => {
          const lines = part.value.replace(/\n$/, '').split('\n');
          return lines.map((line, j) => (
            <div
              key={`${i}-${j}`}
              className={
                part.added
                  ? '-mx-3 bg-good-soft/40 px-3 text-good'
                  : part.removed
                    ? '-mx-3 bg-bad-soft/40 px-3 text-bad line-through'
                    : 'px-3 text-code-text'
              }
            >
              <span className="mr-2 select-none opacity-50">
                {part.added ? '+' : part.removed ? '-' : ' '}
              </span>
              {line || ' '}
            </div>
          ));
        })}
      </pre>
    </div>
  );
}
