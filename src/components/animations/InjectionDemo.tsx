'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { Play } from 'lucide-react';
import { DemoFrame, Segmented } from '@/components/docs/Callout';
import { ResultView } from '@/components/sql/ResultView';
import { runSql } from '@/lib/db/store';
import type { RunResult } from '@/lib/db/types';
import { highlightSql } from '@/lib/sql/highlight';

type Style = 'concat' | 'param';
const PRESETS = ['Login screen', "x' OR '1'='1", "x' UNION SELECT id, email, role FROM members --"];

/**
 * Runs a real query against the active database to show why string concatenation is dangerous.
 * "Parameterized" mode quotes the value as a literal, mirroring what drivers achieve by sending
 * parameters separately from the SQL text.
 */
export function InjectionDemo() {
  const [input, setInput] = useState(PRESETS[1]);
  const [style, setStyle] = useState<Style>('concat');
  const [result, setResult] = useState<RunResult | null>(null);

  const sql =
    style === 'concat'
      ? `SELECT id, title, status FROM tasks WHERE title = '${input}'`
      : `SELECT id, title, status FROM tasks WHERE title = $1   -- $1 = ${quoteLiteral(input)}`;
  const executable = style === 'concat' ? sql : `SELECT id, title, status FROM tasks WHERE title = ${quoteLiteral(input)}`;

  return (
    <DemoFrame
      icon="injection"
      title="SQL injection, live"
      subtitle="Type into the “search box”. Compare building SQL with strings vs. sending a parameter."
      controls={<Segmented value={style} onChange={(v) => { setStyle(v); setResult(null); }} options={[{ value: 'concat', label: 'String concat', icon: 'warn' }, { value: 'param', label: 'Parameter', icon: 'production' }]} />}
      footer={style === 'concat' ? 'The input became part of the SQL grammar. The attacker is now writing your query.' : 'The input is only ever data. No quote, comment or keyword inside it can change the query.'}
    >
      <div className="flex flex-wrap gap-2">
        <input value={input} onChange={(e) => { setInput(e.target.value); setResult(null); }} className="min-w-[260px] flex-1 rounded-xl border border-line bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-brand" aria-label="Search input" />
        <button onClick={async () => setResult(await runSql(executable))} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-on-brand">
          <Play className="h-4 w-4" /> Search
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button key={p} onClick={() => { setInput(p); setResult(null); }} className={clsx('rounded-full border px-2.5 py-0.5 font-mono text-[11px]', p === input ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted')}>
            {p}
          </button>
        ))}
      </div>
      <pre className="my-3 overflow-x-auto rounded-xl bg-code-bg p-3 font-mono text-[12.5px] text-code-text">{highlightSql(sql)}</pre>
      {result && <ResultView result={result} compact />}
    </DemoFrame>
  );
}

function quoteLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}
