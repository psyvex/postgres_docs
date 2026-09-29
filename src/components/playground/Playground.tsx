'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import type * as Monaco from 'monaco-editor';
import { Loader2, MessageSquareText, PanelRightClose, Play, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import { runSql } from '@/lib/db/store';
import type { RunResult } from '@/lib/db/types';
import { describeSchema, useSchema } from '@/lib/db/useSchema';
import { personaContext, withContext } from '@/lib/sql/session';
import { useAiEnabled } from '@/lib/ai/client';
import { AiAnswer } from '@/components/ai/AiAnswer';
import { VoiceButton } from '@/components/ai/VoiceButton';
import { WriteBar } from './WriteBar';
import { ResultView } from '@/components/sql/ResultView';
import { PersonaSelect } from '@/components/sql/PersonaSelect';
import { Explorer } from './Explorer';
import { SqlEditor } from './SqlEditor';
import { TableBrowser } from './TableBrowser';

const DRAFT_KEY = 'postgres-lab:playground-sql';
const STARTER = `-- Welcome to the playground  (Ctrl/⌘ + Enter to run)
-- Pick a persona on the right of the toolbar to run as an app user.
SELECT t.id, t.title, t.status, o.name AS org
FROM tasks t
JOIN organizations o ON o.id = t.org_id
ORDER BY t.id;`;

const SNIPPETS: { label: string; sql: string }[] = [
  { label: 'Enable RLS + tenant policy', sql: `ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;\n\nCREATE POLICY tenant_read ON tasks\n  FOR SELECT TO app_member\n  USING (org_id = current_org_id());` },
  { label: 'List policies', sql: `SELECT tablename, policyname, cmd, roles, qual AS using_expr, with_check\nFROM pg_policies\nWHERE schemaname = 'lab';` },
  { label: 'Who am I?', sql: `SELECT session_user, current_user,\n       current_setting('app.member_id', true) AS member_id,\n       current_setting('app.org_id', true) AS org_id;` },
  { label: 'Table privileges', sql: `SELECT table_name, grantee, string_agg(privilege_type, ', ') AS privileges\nFROM information_schema.role_table_grants\nWHERE table_schema = 'lab'\nGROUP BY 1, 2 ORDER BY 1, 2;` },
  { label: 'Audit trigger', sql: `CREATE OR REPLACE FUNCTION audit_row() RETURNS trigger\n  LANGUAGE plpgsql SECURITY DEFINER SET search_path = lab, pg_temp AS $$\nBEGIN\n  INSERT INTO audit_log (table_name, op, row_id, old_data, new_data)\n  VALUES (TG_TABLE_NAME, TG_OP, COALESCE(NEW.id, OLD.id),\n          CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,\n          CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);\n  RETURN NULL;\nEND $$;\n\nCREATE TRIGGER tasks_audit AFTER INSERT OR UPDATE OR DELETE ON tasks\n  FOR EACH ROW EXECUTE FUNCTION audit_row();` },
  { label: 'EXPLAIN a query', sql: `EXPLAIN (ANALYZE, BUFFERS)\nSELECT * FROM tasks WHERE org_id = 1;` },
];

type AiRequest = { id: number; task: 'explain' | 'fix' | 'ask' | 'review'; title: string; sql: string; error?: string; question?: string };

export function Playground() {
  const params = useSearchParams();
  const [sql, setSql] = useState(STARTER);
  const [persona, setPersona] = useState(params.get('as') ?? 'owner');
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<{ result: RunResult; skip: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [bottom, setBottom] = useState<'results' | 'table'>('results');
  const [aiOpen, setAiOpen] = useState(true);
  const [aiComplete, setAiComplete] = useState(false);
  const [asks, setAsks] = useState<AiRequest[]>([]);
  const [question, setQuestion] = useState('');
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const aiEnabled = useAiEnabled();
  const { schema, error } = useSchema();
  const schemaText = useMemo(() => describeSchema(schema), [schema]);
  const table = schema?.tables.find((t) => `${t.schema}.${t.name}` === selected) ?? null;

  // Initial SQL: ?sql= from a lesson, else the saved draft.
  useEffect(() => {
    const fromUrl = params.get('sql');
    if (fromUrl) return setSql(fromUrl);
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) setSql(draft);
    } catch {}
  }, [params]);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, sql);
    } catch {}
  }, [sql]);

  const execute = useCallback(async () => {
    // Run the selection if there is one, otherwise the whole editor.
    const editor = editorRef.current;
    const selection = editor?.getSelection();
    const selectedText = selection && !selection.isEmpty() ? editor?.getModel()?.getValueInRange(selection) : null;
    const text = (selectedText || sql).trim();
    if (!text) return;
    setRunning(true);
    setBottom('results');
    const { sql: full, skip } = withContext(text, personaContext(persona));
    setRun({ result: await runSql(full), skip });
    setRunning(false);
  }, [sql, persona]);

  const ask = (req: Omit<AiRequest, 'id'>) => {
    setAiOpen(true);
    setAsks((a) => [{ ...req, id: Date.now() }, ...a].slice(0, 8));
  };

  /** AI-written SQL replaces the editor content as a single undoable edit (⌘Z restores the old query). */
  const applyAiSql = (text: string) => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) return setSql(text);
    editor.pushUndoStop();
    editor.executeEdits('ai-write', [{ range: model.getFullModelRange(), text }]);
    editor.pushUndoStop();
    editor.focus();
  };

  const insert = (text: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.executeEdits('explorer', [{ range: editor.getSelection()!, text }]);
    editor.focus();
  };

  return (
    <div className={clsx('grid h-[calc(100vh-3.5rem)] w-full grid-cols-1', aiOpen ? 'lg:grid-cols-[250px_minmax(0,1fr)] 2xl:grid-cols-[260px_minmax(0,1fr)_400px]' : 'lg:grid-cols-[250px_minmax(0,1fr)]')}>
      <aside className="hidden min-h-0 border-r border-line bg-surface lg:block">
        <Explorer schema={schema} error={error} selected={selected} onInsert={insert} onSelectTable={(q) => { setSelected(q); setBottom('table'); }} />
      </aside>

      <main className="grid min-h-0 grid-rows-[auto_auto_minmax(180px,42%)_minmax(0,1fr)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
          <button onClick={execute} disabled={running} className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-on-brand shadow-card disabled:opacity-60">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run
            <kbd className="ml-1 hidden rounded bg-white/20 px-1 text-[10px] sm:inline">⌘↵</kbd>
          </button>
          <PersonaSelect value={persona} onChange={setPersona} prefix="Run as" align="left" />
          <select value="" onChange={(e) => e.target.value && setSql(SNIPPETS[Number(e.target.value)].sql)} aria-label="Snippets" className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-semibold">
            <option value="">Snippets…</option>
            {SNIPPETS.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
          </select>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {aiEnabled ? (
              <>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-muted" title="Ghost-text suggestions from Claude as you type">
                  <input type="checkbox" checked={aiComplete} onChange={(e) => setAiComplete(e.target.checked)} /> AI autocomplete
                </label>
                <button onClick={() => ask({ task: 'explain', title: 'Explain', sql })} className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-2">
                  <Sparkles className="h-3.5 w-3.5 text-accent" /> Explain
                </button>
                <button onClick={() => ask({ task: 'review', title: 'Security review', sql })} className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-2" title="Security & correctness review">
                  <ShieldCheck className="h-3.5 w-3.5 text-good" /> Review
                </button>
              </>
            ) : (
              <span className="text-[11px] text-muted" title="Set ANTHROPIC_API_KEY in .env.local">AI off · add ANTHROPIC_API_KEY</span>
            )}
            <button onClick={() => setAiOpen((v) => !v)} aria-label="Toggle AI panel" className="hidden rounded-lg p-1.5 text-muted hover:bg-surface-2 2xl:block">
              {aiOpen ? <PanelRightClose className="h-4 w-4" /> : <MessageSquareText className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {aiEnabled ? <WriteBar sql={sql} schemaText={schemaText} onWrite={applyAiSql} /> : <div />}

        <div className="min-h-0 border-b border-line">
          <SqlEditor value={sql} onChange={setSql} onRun={execute} schema={schema} schemaText={schemaText} aiComplete={aiEnabled && aiComplete} onReady={(e) => (editorRef.current = e)} />
        </div>

        <div className="flex min-h-0 flex-col bg-bg">
          <div className="flex items-center gap-1 border-b border-line px-3 pt-2">
            <TabButton active={bottom === 'results'} onClick={() => setBottom('results')}>Results</TabButton>
            <TabButton active={bottom === 'table'} onClick={() => setBottom('table')} disabled={!table}>{table ? `Table · ${table.name}` : 'Table (pick one)'}</TabButton>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {bottom === 'results' && (
              <div className="p-3">
                {run ? (
                  <ResultView result={run.result} skip={run.skip} onAskAi={aiEnabled && !run.result.ok ? () => ask({ task: 'fix', title: 'Fix this error', sql, error: run.result.ok ? undefined : run.result.error }) : undefined} />
                ) : (
                  <p className="text-sm text-muted">Run a query to see results. Select text to run only that part.</p>
                )}
              </div>
            )}
            {bottom === 'table' && table && <TableBrowser table={table} />}
          </div>
        </div>
      </main>

      {aiOpen && (
        <aside className="hidden min-h-0 flex-col border-l border-line bg-surface 2xl:flex">
          <div className="border-b border-line p-3">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Wand2 className="h-4 w-4 text-accent" /> Ask about Postgres</div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!question.trim() || !aiEnabled) return;
                ask({ task: 'ask', title: question, sql, question });
                setQuestion('');
              }}
            >
              <div className="relative">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
                disabled={!aiEnabled}
                rows={3}
                placeholder={aiEnabled ? 'e.g. Write a policy so members can only update their own tasks' : 'Set ANTHROPIC_API_KEY in .env.local to enable the assistant.'}
                className="w-full resize-none rounded-xl border border-line bg-bg p-2.5 pr-10 text-sm outline-none focus:border-accent"
              />
              {aiEnabled && <VoiceButton className="absolute bottom-2 right-1.5" onText={(t) => setQuestion((q) => (q ? `${q} ${t}` : t))} />}
              </div>
            </form>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            {asks.length === 0 && <p className="text-xs text-muted">Answers use your live schema as context. Try “Explain” on the editor or ask anything about RLS, roles, functions or triggers.</p>}
            {asks.map((a) => (
              <AiAnswer key={a.id} task={a.task} title={a.title} payload={{ sql: a.sql, error: a.error, question: a.question, schema: schemaText }} onClose={() => setAsks((list) => list.filter((x) => x.id !== a.id))} />
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}

function TabButton({ active, onClick, disabled, children }: { active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} className={clsx('rounded-t-lg border-b-2 px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40', active ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-text')}>
      {children}
    </button>
  );
}
