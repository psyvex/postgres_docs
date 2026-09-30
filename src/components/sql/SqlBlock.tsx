'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { CheckCircle2, ExternalLink, Loader2, Pencil, Play, RotateCcw, Sparkles, Target } from 'lucide-react';
import { runSql } from '@/lib/db/store';
import type { RunResult } from '@/lib/db/types';
import { describeChecks, gradeChecks, type Check, type Grade } from '@/lib/learn/check';
import { checkKey, markCheck, useProgress } from '@/lib/learn/progress';
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
  /**
   * The same promise in machine-checkable form. When present the block grades the run and says
   * "passed" or names what differed, instead of leaving the learner to read the table themselves.
   */
  assert?: Check[];
  /** Read-only snippet (not runnable), e.g. config files or app code. */
  static?: boolean;
  lang?: string;
};

export function SqlBlock({ sql: initial, title, as, pickPersona, expect, assert, static: isStatic, lang = 'sql' }: Props) {
  const original = initial.trim();
  const [sql, setSql] = useState(original);
  const [editing, setEditing] = useState(false);
  const [persona, setPersona] = useState(as ?? 'owner');
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<{ result: RunResult; skip: number } | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [ai, setAi] = useState<null | 'explain' | 'fix'>(null);
  const aiEnabled = useAiEnabled();
  const showPersona = pickPersona ?? as !== undefined;
  const pathname = usePathname();
  const progress = useProgress();
  // A block with a title on a lesson page is a stable identity, so a pass survives reload.
  const solved = assert && title ? `${pathname}#${title}` in progress.checks : false;

  const execute = async () => {
    setRunning(true);
    setAi(null);
    const { sql: full, skip } = withContext(sql, personaContext(persona));
    const result = await runSql(full);
    setRun({ result, skip });
    if (assert) {
      const g = gradeChecks(result, assert, skip);
      setGrade(g);
      if (g.passed && title) markCheck(checkKey(pathname, title), true);
    } else {
      setGrade(null);
    }
    setRunning(false);
  };

  const playgroundHref = `/playground?sql=${encodeURIComponent(sql)}${persona !== 'owner' ? `&as=${persona}` : ''}`;

  return (
    <figure className="not-prose my-6 rounded-2xl border border-line bg-surface shadow-card [&>*:last-child]:rounded-b-2xl">
      <div className="flex flex-wrap items-center gap-2 rounded-t-2xl border-b border-line bg-surface-2 px-3 py-2">
        <span className="rounded-md bg-brand-soft px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-brand">{lang}</span>
        {title && <figcaption className="text-sm font-semibold">{title}</figcaption>}
        {solved && (
          <span className="inline-flex items-center gap-1 rounded-md bg-good-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-good" title="You passed this check">
            <CheckCircle2 className="h-3 w-3" /> Solved
          </span>
        )}
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
          {/* The hint that describes what the block promises, shown before the learner has run it. */}
          {expect && !run && <div className="flex items-center gap-1.5 text-xs text-muted"><Icon name="target" className="text-accent" /> {expect}</div>}

          {/* A check verdict — shown above the table so the pass/fail is seen first. */}
          {assert && run && grade && (
            grade.passed ? (
              <div className="flex items-center gap-1.5 rounded-xl border border-good/30 bg-good-soft px-3 py-2 text-sm font-semibold text-good">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {describeChecks(assert)}
              </div>
            ) : (
              <div className="rounded-xl border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-bad">
                <div className="flex items-start gap-1.5 font-semibold">
                  <Target className="mt-0.5 h-4 w-4 shrink-0" />
                  {describeChecks(assert)}
                </div>
                {grade.failures.map((f) => <div key={f} className="mt-1 text-xs opacity-80">{f}</div>)}
              </div>
            )
          )}

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
