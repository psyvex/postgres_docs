'use client';

import { useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ExternalLink, Loader2, Pencil, Play, RotateCcw, Sparkles } from 'lucide-react';
import { runSql } from '@/lib/db/store';
import type { RunResult } from '@/lib/db/types';
import { highlightSql } from '@/lib/sql/highlight';
import { personaContext, withContext } from '@/lib/sql/session';
import { useAiEnabled } from '@/lib/ai/client';
import { AiAnswer } from '@/components/ai/AiAnswer';
import { ResultView } from './ResultView';
import { Icon } from '@/components/icons';
import { PersonaSelect } from './PersonaSelect';

type Props = {
  /** SQL to show (MDX: pass as a template literal). */
  sql: string;
  title?: string;
  /** Persona to run as: owner | alice | bob | carol | anon. Learners can change it. */
  as?: string;
  /** Show the persona picker (defaults to true when `as` is set). */
  pickPersona?: boolean;
  /** Expected outcome hint shown before running, e.g. "Alice should see 4 rows". */
  expect?: string;
  /** Read-only snippet (not runnable), e.g. config files or app code. */
  static?: boolean;
  lang?: string;
};

export function SqlBlock({ sql: initial, title, as, pickPersona, expect, static: isStatic, lang = 'sql' }: Props) {
  const original = initial.trim();
  const [sql, setSql] = useState(original);
  const [editing, setEditing] = useState(false);
  const [persona, setPersona] = useState(as ?? 'owner');
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<{ result: RunResult; skip: number } | null>(null);
  const [ai, setAi] = useState<null | 'explain' | 'fix'>(null);
  const aiEnabled = useAiEnabled();
  const showPersona = pickPersona ?? as !== undefined;

  const execute = async () => {
    setRunning(true);
    setAi(null);
    const { sql: full, skip } = withContext(sql, personaContext(persona));
    setRun({ result: await runSql(full), skip });
    setRunning(false);
  };

  const playgroundHref = `/playground?sql=${encodeURIComponent(sql)}${persona !== 'owner' ? `&as=${persona}` : ''}`;

  return (
    <figure className="not-prose my-6 rounded-2xl border border-line bg-surface shadow-card [&>*:last-child]:rounded-b-2xl">
      <div className="flex flex-wrap items-center gap-2 rounded-t-2xl border-b border-line bg-surface-2 px-3 py-2">
        <span className="rounded-md bg-brand-soft px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-brand">{lang}</span>
        {title && <figcaption className="text-sm font-semibold">{title}</figcaption>}
        {!isStatic && (
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {showPersona && (
              <PersonaSelect value={persona} onChange={setPersona} />
            )}
            <IconButton onClick={() => setEditing((v) => !v)} label={editing ? 'Done' : 'Edit'} active={editing}><Pencil className="h-3.5 w-3.5" /></IconButton>
            {sql !== original && <IconButton onClick={() => setSql(original)} label="Reset"><RotateCcw className="h-3.5 w-3.5" /></IconButton>}
            {aiEnabled && <IconButton onClick={() => setAi('explain')} label="Explain"><Sparkles className="h-3.5 w-3.5" /></IconButton>}
            <Link href={playgroundHref} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-surface hover:text-text">
              <ExternalLink className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Playground</span>
            </Link>
            <button onClick={execute} disabled={running} className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1 text-xs font-bold text-on-brand hover:brightness-110 disabled:opacity-60">
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Run
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') execute();
          }}
          spellCheck={false}
          rows={Math.min(24, sql.split('\n').length + 1)}
          className="block w-full resize-y bg-code-bg px-4 py-3 font-mono text-[13px] leading-relaxed text-code-text outline-none"
        />
      ) : (
        <pre className="m-0 overflow-x-auto bg-code-bg px-4 py-3 font-mono text-[13px] leading-relaxed text-code-text">
          <code>{lang === 'sql' ? highlightSql(sql) : sql}</code>
        </pre>
      )}

      {(expect || run || ai) && (
        <div className={clsx('space-y-3 p-3', !run && 'pb-2')}>
          {expect && !run && <div className="flex items-center gap-1.5 text-xs text-muted"><Icon name="target" className="text-accent" /> {expect}</div>}
          {run && <ResultView result={run.result} skip={run.skip} compact onAskAi={aiEnabled ? () => setAi('fix') : undefined} />}
          {ai && (
            <AiAnswer
              key={ai + sql}
              task={ai}
              title={ai === 'fix' ? 'Why did this fail?' : 'Explain this SQL'}
              payload={{ sql, error: run && !run.result.ok ? run.result.error : undefined }}
              onClose={() => setAi(null)}
            />
          )}
        </div>
      )}
    </figure>
  );
}

function IconButton({ onClick, label, children, active }: { onClick: () => void; label: string; children: React.ReactNode; active?: boolean }) {
  return (
    <button onClick={onClick} className={clsx('flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold hover:bg-surface hover:text-text', active ? 'bg-surface text-text' : 'text-muted')}>
      {children} <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
