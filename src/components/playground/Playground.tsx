'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import type * as Monaco from 'monaco-editor';
import { AnimatePresence, motion } from 'motion/react';
import { useMotionPresets } from '@/lib/motion';
import { Link2, Loader2, MessageSquareText, PanelBottomClose, PanelBottomOpen, PanelRightClose, Play, ShieldCheck, Sparkles, Undo2, Users, Wand2, X } from 'lucide-react';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { runSql, useDbStore } from '@/lib/db/store';
import type { RunResult } from '@/lib/db/types';
import { describeSchema, useSchema } from '@/lib/db/useSchema';
import { pushHistory } from '@/lib/playground/history';
import { QueryHistory } from './QueryHistory';
import { personaContext, withContext } from '@/lib/sql/session';
import { useAiEnabled } from '@/lib/ai/client';
import { AiAnswer } from '@/components/ai/AiAnswer';
import { useAiFontSize } from '@/components/ai/useAiFontSize';
import { LanguagePicker } from '@/components/ai/LanguagePicker';
import { VoiceButton } from '@/components/ai/VoiceButton';
import { WriteBar } from './WriteBar';
import { ResultView } from '@/components/sql/ResultView';
import { PersonaSelect } from '@/components/sql/PersonaSelect';
import { Explorer } from './Explorer';
import { SqlEditor } from './SqlEditor';
import { TableBrowser } from './TableBrowser';
import { RlsMatrixPanel, type RlsMatrixResult } from './RlsMatrixPanel';
import { ToolbarMore } from './ToolbarMore';
import { isPlanResult } from '@/components/sql/PlanTree';
import { useT } from '@/lib/i18n/useT';

const DRAFT_KEY = 'postgres-lab:playground-sql';
/** Shared with the lesson copilot and the lesson translator: one answer language for the whole app. */
const LANG_KEY = 'postgres-lab:lang';
/** Height of the Results/Table panel, owned by the drag handle and kept between visits. */
const BOTTOM_KEY = 'postgres-lab:playground:bottom';
const BOTTOM_MIN = 96;
const BOTTOM_DEFAULT = 320;
const EDITOR_MIN = 120; // the editor row's floor, mirrored in the grid template
const SLIDER = 9;
/** 2xl in Tailwind's scale (96rem): at or above it the assistant is a column, below it a sheet. */
const WIDE_QUERY = '(min-width: 1536px)'; // 2xl: the width at which the assistant is a column, not a sheet
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
  { label: 'EXPLAIN a query', sql: `EXPLAIN (FORMAT JSON) SELECT * FROM tasks WHERE org_id = 1;` },
];

/** `schema` is a snapshot taken when the question is asked, so the answer's cache key stays put. */
type AiRequest = { id: number; task: 'explain' | 'fix' | 'ask' | 'review' | 'explainPlan'; title: string; sql: string; schema: string; error?: string; question?: string; plan?: string; language: string };

export function Playground() {
  const params = useSearchParams();
  const [sql, setSql] = useState(STARTER);
  const [persona, setPersona] = useState(params.get('as') ?? 'owner');
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<{ result: RunResult; skip: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [bottom, setBottom] = useState<'results' | 'table' | 'history' | 'rls' | 'schema'>('results');
  const [aiOpen, setAiOpen] = useState(true);
  const [aiComplete, setAiComplete] = useState(false);
  const [sandbox, setSandbox] = useState(false);
  /** Side-by-side result of running the current SQL as owner / Alice / anon. */
  const [multi, setMulti] = useState<{ results: RunResult[]; skips: number[] } | null>(null);
  /** RLS policy visibility matrix. null = not probing. */
  const [rlsMatrix, setRlsMatrix] = useState<RlsMatrixResult | null>(null);
  const [asks, setAsks] = useState<AiRequest[]>([]);
  const [question, setQuestion] = useState('');
  /** Language of the assistant's *answers* (not the UI chrome). English until a saved pick is read. */
  const [askLang, setAskLang] = useState('en');
  const [bottomH, setBottomH] = useState(BOTTOM_DEFAULT);
  const [bottomClosed, setBottomClosed] = useState(false);
  const [bottomDrag, setBottomDrag] = useState(false);
  /**
   * The assistant is a grid column at ≥2xl and a bottom sheet below that. `wide` decides which, and
   * a phone loads with the sheet *closed*: an answer panel over a 375px editor hides the SQL, which
   * is the thing the learner came to write.
   */
  const [wide, setWide] = useState(true);
  /** Persistence stays asleep until the stored size has been read, so the writer never saves defaults over it. */
  const [bottomReady, setBottomReady] = useState(false);
  /** Interface language. `dir` flips the two pinned-to-an-edge clusters when Arabic is active. */
  const { t } = useT();
  const mainRef = useRef<HTMLElement>(null);
  const drag = useRef<{ y: number; h: number } | null>(null);
  /** Lets an unmount mid-drag detach the window listeners it added. */
  const dragEnd = useRef<(() => void) | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const aiEnabled = useAiEnabled();
  /** Bottom-panel tab swaps, the panel collapse, and the assistant sheet all share the app's motion layer. */
  const { tab: tabSwap, fade: contentFade, sheet: assistantSheet, backdrop: sheetBackdrop } = useMotionPresets();
  useAiFontSize(); // publishes --ai-fs so every AI answer shares one readable size
  const { schema, error } = useSchema();
  const schemaText = useMemo(() => describeSchema(schema), [schema]);
  const table = schema?.tables.find((t) => `${t.schema}.${t.name}` === selected) ?? null;

  /**
   * Initial SQL priority: `?s=` (lz-string, Share link) > `?sql=` (plain, lesson block) > saved draft.
   * `?s=` uses compressToEncodedURIComponent so a long statement fits a URL without percent-encoding.
   */
  useEffect(() => {
    const shared = params.get('s');
    if (shared) {
      try {
        const decoded = decompressFromEncodedURIComponent(shared);
        if (decoded) { setSql(decoded); return; }
      } catch { /* fall through to ?sql= */ }
    }
    const fromUrl = params.get('sql');
    if (fromUrl) { setSql(fromUrl); return; }
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) setSql(draft);
    } catch {}
  }, [params]);

  /**
   * `?as=` also arrives from the ⌘K palette, which navigates with URL params, and the mount-only
   * useState above misses a param-only navigation. Mirroring the URL into state during render catches
   * it; a manual "Run as" pick never writes to the URL, so the two can't fight.
   */
  const asParam = params.get('as');
  const [seenAs, setSeenAs] = useState(asParam);
  if (asParam !== seenAs) {
    setSeenAs(asParam);
    if (asParam) setPersona(asParam);
  }

  /**
   * Answer language is a reader preference, shared with the lesson copilot and the lesson translator.
   * Read a frame late: the server has no `localStorage`, so the first paint must agree with it on the
   * English default, and a synchronous `setAskLang` in the effect body is the cascading-render shape
   * `react-hooks/set-state-in-effect` warns about (the same reason `/settings` defers its read).
   */
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const saved = localStorage.getItem(LANG_KEY);
        if (saved) setAskLang(saved);
      } catch {}
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, sql);
    } catch {}
  }, [sql]);

  // Panel size and collapsed state survive reloads.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BOTTOM_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as { h?: number; closed?: boolean };
      if (typeof s.h === 'number' && s.h >= BOTTOM_MIN) setBottomH(s.h);
      if (typeof s.closed === 'boolean') setBottomClosed(s.closed);
    } catch {}
    setBottomReady(true);
  }, []);

  useEffect(() => {
    if (!bottomReady) return;
    try {
      localStorage.setItem(BOTTOM_KEY, JSON.stringify({ h: bottomH, closed: bottomClosed }));
    } catch {}
  }, [bottomReady, bottomH, bottomClosed]);

  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY);
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  /**
   * A phone loads with the sheet shut, and Escape closes it again, the two ways a panel that covers
   * the editor must be dismissible. Desktop keeps its toggle; the column never covers anything.
   */
  useEffect(() => {
    if (wide) return;
    setAiOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAiOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wide]);

  /**
   * Room left by the toolbar and the Write bar, minus the slider and the editor's floor, measured,
   * not guessed, because the Write bar grows by a row when its example chips appear. Guessing here
   * overflowed the page by 78 px at full extension.
   */
  const clampBottom = (h: number) => {
    const main = mainRef.current;
    if (!main) return BOTTOM_DEFAULT;
    const above = Array.from(main.children).slice(0, 2).reduce((sum, el) => sum + el.clientHeight, 0);
    const max = main.clientHeight - above - EDITOR_MIN - SLIDER;
    return Math.round(Math.max(BOTTOM_MIN, Math.min(h, max)));
  };

  /**
   * Drag lives on `window`, not on the handle: setPointerCapture proved unreliable here (the moves
   * kept retargeting to Monaco, so the handle never saw a single one). Window listeners track the
   * pointer wherever it goes, and the cursor/selection lock stops the drag from highlighting SQL.
   */
  const resizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    drag.current = { y: e.clientY, h: bottomH };
    setBottomDrag(true);
    setBottomClosed(false);
    const move = (ev: PointerEvent) => {
      if (!drag.current) return;
      setBottomH(clampBottom(drag.current.h - (ev.clientY - drag.current.y)));
    };
    const up = () => {
      drag.current = null;
      setBottomDrag(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    dragEnd.current = up;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };
  const resizeKeys = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      setBottomClosed(false);
      setBottomH((h) => clampBottom(bottomClosed ? bottomH : h + (e.key === 'ArrowUp' ? 28 : -28)));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setBottomClosed((v) => !v);
    }
  };

  useEffect(() => () => dragEnd.current?.(), []);

  // The Write bar grows when its example chips appear, so the room available for the panel changes
  // under the drag clamp. Re-clamp when it does, or an extended panel pushes the page into scroll.
  useEffect(() => {
    const bar = mainRef.current?.children[1];
    if (!bar) return;
    const ro = new ResizeObserver(() => setBottomH((h) => clampBottom(h)));
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  const execute = useCallback(async () => {
    // Run the selection if there is one, otherwise the whole editor.
    const editor = editorRef.current;
    const selection = editor?.getSelection();
    const selectedText = selection && !selection.isEmpty() ? editor?.getModel()?.getValueInRange(selection) : null;
    const text = (selectedText || sql).trim();
    if (!text) return;
    pushHistory(text);
    setRunning(true);
    setBottom('results');
    setBottomClosed(false); // a run always shows its output, even from a collapsed panel
    const sandboxed = sandbox ? `BEGIN;\n${text}\nROLLBACK;` : text;
    const { sql: full, skip } = withContext(sandboxed, personaContext(persona));
    setMulti(null);
    setRun({ result: await runSql(full), skip });
    setRunning(false);
  }, [sql, persona, sandbox]);

  const runAsAll = useCallback(async () => {
    const text = sql.trim();
    if (!text) return;
    setRunning(true);
    setBottom('results');
    setBottomClosed(false);
    setRun(null);
    const ctxs = MULTI_IDS.map((id) => withContext(text, personaContext(id)));
    const results = await Promise.all(ctxs.map((c) => runSql(c.sql)));
    setMulti({ results, skips: ctxs.map((c) => c.skip) });
    setRunning(false);
  }, [sql]);

  const probeRls = useCallback(async () => {
    const policy = sql.trim();
    if (!policy) return;
    setRunning(true);
    setBottom('rls');
    setBottomClosed(false);
    setRlsMatrix(null);
    const sqlProbe = [
      'BEGIN;',
      'ALTER TABLE lab.tasks ENABLE ROW LEVEL SECURITY;',
      "DROP POLICY IF EXISTS _probe ON lab.tasks;",
      policy,
      'RESET ROLE;',
      'SELECT COALESCE(ARRAY_AGG(id ORDER BY id), ARRAY[]::int[]) FROM lab.tasks;',
      "SET app.member_id = '1'; SET app.org_id = '1'; SET ROLE app_member;",
      'SELECT COALESCE(ARRAY_AGG(id ORDER BY id), ARRAY[]::int[]) FROM lab.tasks;',
      "SET app.member_id = '2'; SET app.org_id = '1'; SET ROLE app_member;",
      'SELECT COALESCE(ARRAY_AGG(id ORDER BY id), ARRAY[]::int[]) FROM lab.tasks;',
      "SET app.member_id = '3'; SET app.org_id = '2'; SET ROLE app_member;",
      'SELECT COALESCE(ARRAY_AGG(id ORDER BY id), ARRAY[]::int[]) FROM lab.tasks;',
      'ROLLBACK;',
    ].join('\n');
    const probe = await runSql(sqlProbe);
    setRunning(false);
    if (!probe.ok) { setRlsMatrix({ taskIds: [], personas: [], error: probe.error }); return; }
    // results layout (after SESSION_PREFIX strip):
    //   [0] BEGIN · [1] ENABLE RLS · [2] DROP POLICY · [3] CREATE POLICY (user SQL)
    //   [4] owner ids · [5] alice ids · [6] bob ids · [7] carol ids
    // SET ROLE/SET app.* have no columns; toStatements includes them in results.
    // The SELECT probes are the rows with columns.length > 0.
    const selects = probe.results.filter((r) => r.columns.length > 0);
    const MATRIX_LABELS: [string, string][] = [
      ['owner', 'Superuser'], ['alice', 'Alice · Acme'], ['bob', 'Bob · Acme'], ['carol', 'Carol · Globex'],
    ];
    // The four id probes are the last statements to run, so count back from the end. Counting forward
    // from the first column-bearing result shifts every slot by one whenever the editor holds a SELECT
    // instead of a policy, and `allIds` ends up holding that row's scalar: `number[].includes` then
    // throws out of a callback with no error boundary.
    const probes = selects.slice(-MATRIX_LABELS.length);
    const toIds = (idx: number): number[] | null => {
      const value = probes[idx]?.rows[0]?.[probes[idx].columns[0]];
      return Array.isArray(value) ? (value as number[]) : null;
    };
    const idSets = MATRIX_LABELS.map((_, i) => toIds(i));
    if (idSets.some((ids) => ids === null)) {
      setRlsMatrix({
        taskIds: [],
        personas: [],
        error: 'The RLS probe could not read its id arrays. Put a single policy statement in the editor, then run it again.',
      });
      return;
    }
    const allIds = idSets[0] as number[];
    setRlsMatrix({
      taskIds: allIds,
      personas: MATRIX_LABELS.map(([id, label], i) => ({
        id,
        label,
        taskIds: id === 'owner' ? allIds : (idSets[i] as number[]).filter((tid) => allIds.includes(tid)),
      })),
    });
  }, [sql]);

  /** Runs EXPLAIN (FORMAT JSON) on the editor SQL, then asks the AI to walk the plan tree. */
  const explainPlan = useCallback(async () => {
    const text = sql.trim();
    if (!text) return;
    const res = await runSql(`EXPLAIN (FORMAT JSON) ${text}`, { silent: true });
    if (!res.ok) return;
    const plan = res.results[res.results.length - 1]?.rows[0]?.['QUERY PLAN'];
    if (!plan) return;
    setAiOpen(true);
    setAsks((a) => [{ task: 'explainPlan' as const, title: 'Explain plan', sql: text, plan: JSON.stringify(plan), schema: schemaText, language: askLang, id: Date.now() }, ...a].slice(0, 8));
  }, [sql, schemaText, askLang]);

  /** Every prose request carries the answer language, so the picker in the panel header is honoured. */
  const ask = (req: Omit<AiRequest, 'id' | 'schema' | 'language'>) => {
    setAiOpen(true);
    setAsks((a) => [{ ...req, schema: schemaText, language: askLang, id: Date.now() }, ...a].slice(0, 8));
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

  /** Runs a given text directly (bypasses the `sql` state), so Apply & Run fires immediately. */
  const runText = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    pushHistory(trimmed);
    setRunning(true);
    setBottom('results');
    setBottomClosed(false);
    const sandboxed = sandbox ? `BEGIN;\n${trimmed}\nROLLBACK;` : trimmed;
    const { sql: full, skip } = withContext(sandboxed, personaContext(persona));
    setMulti(null);
    setRun({ result: await runSql(full), skip });
    setRunning(false);
  }, [persona, sandbox]);

  const handleApplySql = useCallback((text: string, run: boolean) => {
    // Guardrail: in live mode, destructive AI SQL requires explicit confirmation before running.
    if (run && useDbStore.getState().mode === 'live' &&
        /\b(DROP\s+TABLE|DROP\s+DATABASE|DROP\s+SCHEMA|TRUNCATE|DELETE\s+FROM)\b/i.test(text)) {
      if (!window.confirm('⚠️ This AI answer contains destructive SQL (DROP / TRUNCATE / DELETE). Apply and run on the live database?')) return;
    }
    applyAiSql(text);
    if (run) runText(text);
  }, [runText]); // applyAiSql is stable (uses ref only)

  const insert = (text: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.executeEdits('explorer', [{ range: editor.getSelection()!, text }]);
    editor.focus();
  };

  // The last result is an EXPLAIN plan → the toolbar (and the phone menu) offers "Explain plan".
  const planned = run?.result.ok ? run.result.results[run.skip] : undefined;
  const canExplainPlan = !!planned && isPlanResult(planned.columns, planned.rows);

  return (
    <div className={clsx('grid h-[calc(100vh-3.5rem)] w-full grid-cols-1', aiOpen ? 'lg:grid-cols-[250px_minmax(0,1fr)] 2xl:grid-cols-[260px_minmax(0,1fr)_400px]' : 'lg:grid-cols-[250px_minmax(0,1fr)]')}>
      <aside className="hidden min-h-0 border-e border-line bg-surface lg:block">
        <Explorer schema={schema} error={error} selected={selected} onInsert={insert} onSelectTable={(q) => { setSelected(q); setBottom('table'); }} />
      </aside>

      {/* `grid-cols-[minmax(0,1fr)]` is load-bearing: Monaco stamps a pixel width onto its own DOM
          node, and an implicit grid track is floored at that min-content width, so the column could
          only ever grow, and after a window shrink the page scrolled sideways (1179px in a 400px
          phone viewport). A zero-minimum track lets Monaco's `automaticLayout` shrink it back. */}
      <main ref={mainRef} className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)]" style={{ gridTemplateRows: `auto auto minmax(${EDITOR_MIN}px,1fr) ${SLIDER}px ${bottomClosed ? 'auto' : `${bottomH}px`}` }}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
          <button onClick={execute} disabled={running} title={t.playground.runTitle} className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-on-brand shadow-card disabled:opacity-60">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {t.common.run}
            <kbd className="ms-1 hidden rounded bg-white/20 px-1 text-[10px] sm:inline">⌘↵</kbd>
          </button>
          <PersonaSelect value={persona} onChange={setPersona} prefix={t.playground.runAs} align="left" />

          {/* T5-6: below `sm` the bar keeps only Run, Run as, More and the assistant toggle; the
              full row of controls wrapped to 166 px on a 375 px phone, a quarter of the screen
              above the editor. The same actions live in `ToolbarMore` there. */}
          <div className="hidden flex-wrap items-center gap-2 sm:flex">
            <select value="" onChange={(e) => e.target.value && setSql(SNIPPETS[Number(e.target.value)].sql)} aria-label={t.playground.snippets} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-semibold">
              <option value="">{t.playground.snippetsPrompt}</option>
              {SNIPPETS.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
            </select>
            <CopyLinkButton sql={sql} persona={persona} />
            <label
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${sandbox ? 'border-warn/40 bg-warn/10 text-warn' : 'border-line hover:bg-surface-2'}`}
              title={t.playground.titles.sandbox}
            >
              <input type="checkbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} className="accent-warn" />
              <Undo2 className="h-3.5 w-3.5" /> {t.playground.sandbox}
            </label>
            <button
              onClick={runAsAll}
              disabled={running}
              title={t.playground.titles.compare}
              className="flex items-center gap-1 rounded-lg border border-accent/30 px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 disabled:opacity-60"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />} {t.playground.compare}
            </button>
            <button
              onClick={probeRls}
              disabled={running}
              title={t.playground.titles.rlsMatrix}
              className="flex items-center gap-1 rounded-lg border border-warn/30 px-2.5 py-1.5 text-xs font-semibold text-warn hover:bg-warn/10 disabled:opacity-60"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> {t.playground.rlsMatrix}
            </button>
          </div>

          <div className="ms-auto hidden items-center gap-2 sm:flex">
            {aiEnabled ? (
              <>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-muted" title={t.playground.titles.aiAutocomplete}>
                  <input type="checkbox" checked={aiComplete} onChange={(e) => setAiComplete(e.target.checked)} /> {t.playground.aiAutocomplete}
                </label>
                <button onClick={() => ask({ task: 'explain', title: 'Explain', sql })} className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-2">
                  <Sparkles className="h-3.5 w-3.5 text-accent" /> {t.playground.explain}
                </button>
                {canExplainPlan && (
                  <button onClick={explainPlan} className="flex items-center gap-1 rounded-lg border border-accent/30 px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10" title={t.playground.titles.explainPlan}>
                    <Sparkles className="h-3.5 w-3.5 text-accent" /> {t.playground.explainPlan}
                  </button>
                )}
                <button onClick={() => ask({ task: 'review', title: 'Security review', sql })} className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-2" title={t.playground.titles.review}>
                  <ShieldCheck className="h-3.5 w-3.5 text-good" /> {t.playground.review}
                </button>
              </>
            ) : (
              <span className="text-[11px] text-muted" title="Set ANTHROPIC_API_KEY in .env.local">{t.playground.aiOff}</span>
            )}
            <AssistantToggle aiOpen={aiOpen} onToggle={() => setAiOpen((v) => !v)} />
          </div>

          <div className="ms-auto flex items-center gap-1 sm:hidden">
            <ToolbarMore
              snippets={SNIPPETS}
              onSnippet={(text) => setSql(text)}
              copyLink={<CopyLinkButton sql={sql} persona={persona} />}
              sandbox={sandbox}
              onSandbox={setSandbox}
              onCompare={runAsAll}
              onRlsMatrix={probeRls}
              busy={running}
              aiEnabled={aiEnabled}
              aiComplete={aiComplete}
              onAiComplete={setAiComplete}
              onExplain={() => ask({ task: 'explain', title: 'Explain', sql })}
              onExplainPlan={canExplainPlan ? explainPlan : undefined}
              onReview={() => ask({ task: 'review', title: 'Security review', sql })}
            />
            <AssistantToggle aiOpen={aiOpen} onToggle={() => setAiOpen((v) => !v)} />
          </div>
        </div>

        {aiEnabled ? <WriteBar sql={sql} schemaText={schemaText} onWrite={applyAiSql} /> : <div />}

        <div className="min-h-0">
          <SqlEditor value={sql} onChange={setSql} onRun={execute} schema={schema} schemaText={schemaText} aiComplete={aiEnabled && aiComplete} onReady={(e) => (editorRef.current = e)} />
        </div>

        {/* Slider between editor and results: drag it, or focus it and use ↑/↓ (Enter collapses). */}
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={bottomClosed ? 'Results panel collapsed. Drag up, or press Enter to open it.' : 'Drag to resize the results panel. Arrow keys resize, Enter collapses.'}
          tabIndex={0}
          onPointerDown={resizeStart}
          onKeyDown={resizeKeys}
          className={clsx('group flex touch-none cursor-row-resize items-center justify-center border-y border-line bg-surface outline-none', bottomDrag ? 'bg-surface-2' : 'hover:bg-surface-2 focus-visible:bg-surface-2')}
        >
          <span className={clsx('h-[3px] rounded-full transition-all', bottomDrag ? 'w-16 bg-brand' : 'w-10 bg-line group-hover:bg-muted group-focus-visible:bg-muted')} />
        </div>

        <div className="flex min-h-0 flex-col bg-bg">
          {/* Five tabs do not fit a 320 px panel, and the strip has no dropdowns inside it, so a
              scrolling tab row is safe here (unlike the toolbar, which hosts absolute panels). */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-line px-3 pt-2">
            <TabButton active={bottom === 'results'} onClick={() => { setBottom('results'); setBottomClosed(false); }}>{t.playground.results}</TabButton>
            <TabButton active={bottom === 'table'} onClick={() => { setBottom('table'); setBottomClosed(false); }} disabled={!table}>{table ? `${t.playground.table} · ${table.name}` : t.playground.tablePickOne}</TabButton>
            {/* The Explorer aside is `hidden lg:block`, so below `lg` the schema needs a route here
                (T5-6). Otherwise a phone has no table list at all. */}
            <TabButton className="lg:hidden" active={bottom === 'schema'} onClick={() => { setBottom('schema'); setBottomClosed(false); }}>{t.playground.schema}</TabButton>
            <TabButton active={bottom === 'history'} onClick={() => { setBottom('history'); setBottomClosed(false); }}>{t.playground.history}</TabButton>
            <TabButton active={bottom === 'rls'} onClick={() => { setBottom('rls'); setBottomClosed(false); }}>{t.playground.rlsMatrix}</TabButton>
            {/* Pinned right so the collapse control stays reachable when the tab strip scrolls (320 px). */}
            <button
              onClick={() => setBottomClosed((v) => !v)}
              aria-label={bottomClosed ? t.playground.titles.expand : t.playground.titles.collapse}
              title={bottomClosed ? t.playground.titles.expand : t.playground.titles.collapse}
              className="sticky end-0 ms-auto rounded-lg bg-surface p-1 text-muted hover:bg-surface-2"
            >
              {bottomClosed ? <PanelBottomOpen className="h-4 w-4" /> : <PanelBottomClose className="h-4 w-4" />}
            </button>
          </div>
          {/* One keyed node per tab, so switching tabs cross-fades instead of replacing the panel
              mid-paint. `mode="wait"` keeps the two halves from overlapping in a scroll container. */}
          <AnimatePresence mode="wait" initial={false}>
            {!bottomClosed && (
              <motion.div key={bottom} {...tabSwap} className="min-h-0 flex-1 overflow-auto">
            {bottom === 'results' && (
              <div className="p-3">
                {multi ? (
                  <MultiRunPanel multi={multi} />
                ) : run ? (
                  <ResultView result={run.result} skip={run.skip} onAskAi={aiEnabled && !run.result.ok ? () => ask({ task: 'fix', title: 'Fix this error', sql, error: run.result.ok ? undefined : run.result.error }) : undefined} />
                ) : (
                  <p className="text-sm text-muted">{t.playground.resultsHint}</p>
                )}
              </div>
            )}
            {bottom === 'table' && table && <TableBrowser table={table} />}
            {bottom === 'schema' && (
              <Explorer schema={schema} error={error} selected={selected} onInsert={insert} onSelectTable={(q) => { setSelected(q); setBottom('table'); }} />
            )}
            {bottom === 'history' && <QueryHistory onRecall={(text) => { setSql(text); setBottom('results'); }} />}
            {bottom === 'rls' && (
              <div className="p-3">
                {running ? (
                  <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> {t.playground.probingRls}</p>
                ) : rlsMatrix ? (
                  <RlsMatrixPanel matrix={rlsMatrix} />
                ) : (
                  <p className="text-sm text-muted">
                    {t.playground.rlsHintPre}{' '}
                    <span className="font-semibold text-warn">{t.playground.rlsMatrix}</span> {t.playground.rlsHintPost}
                  </p>
                )}
              </div>
            )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Below 2xl the assistant is a sheet over the editor, so it gets the two things a covering
          panel owes you: something behind it to tap, and a close button in its own header. */}
      <AnimatePresence>
        {aiOpen && !wide && (
          <motion.button key="assistant-scrim" aria-label={t.playground.closeAssistant} onClick={() => setAiOpen(false)} {...sheetBackdrop} className="fixed inset-0 z-30 bg-black/45" />
        )}
        {aiOpen && (
        <motion.aside
          key="assistant"
          id="playground-assistant"
          {...(wide ? contentFade : assistantSheet)}
          className={clsx(
            'min-h-0 flex-col bg-surface',
            wide
              ? 'hidden border-s border-line 2xl:flex'
              : 'fixed inset-x-0 bottom-0 z-40 flex h-[72dvh] rounded-t-2xl border-t border-line shadow-card',
          )}
        >
          <div className="border-b border-line p-3">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-bold">
              <Wand2 className="h-4 w-4 text-accent" /> {t.playground.askPostgres}
              {/* The answer language, next to the thing it governs. Persisted and shared with the
                  lesson copilot, so one pick follows the reader across the app. */}
              <span className="ms-auto">
                <LanguagePicker
                  align="right"
                  size="sm"
                  includeEnglish
                  hint="Answer language"
                  value={askLang}
                  onChange={(code) => {
                    setAskLang(code);
                    try {
                      localStorage.setItem(LANG_KEY, code);
                    } catch {}
                  }}
                />
              </span>
              {!wide && (
                <button onClick={() => setAiOpen(false)} aria-label={t.playground.closeAssistant} className="rounded-lg p-1 text-muted hover:bg-surface-2"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!question.trim() || !aiEnabled) return;
                ask({ task: 'ask', title: question, sql, question });
                setQuestion('');
              }}
            >
              {/* The mic sits inside the textarea's reserved pe-10 gutter; positioned from a
                  wrapper, because VoiceButton's own root is `relative` and would win. */}
              <div className="relative">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
                  disabled={!aiEnabled}
                  rows={3}
                  placeholder={aiEnabled ? t.playground.assistantPromptHint : t.playground.assistantOffHint}
                  className="block w-full resize-none rounded-xl border border-line bg-bg p-2.5 pe-10 text-sm outline-none focus:border-accent"
                />
                {aiEnabled && (
                  <div className="absolute bottom-1.5 end-1.5">
                    <VoiceButton onText={(t) => setQuestion((q) => (q ? `${q} ${t}` : t))} />
                  </div>
                )}
              </div>
            </form>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            {asks.length === 0 && <p className="text-xs text-muted">{t.playground.assistantEmpty}</p>}
            {asks.map((a) => (
              <AiAnswer key={a.id} task={a.task} title={a.title} payload={{ sql: a.sql, error: a.error, question: a.question, schema: a.schema, plan: a.plan, language: a.language }} onApplySql={handleApplySql} onClose={() => setAsks((list) => list.filter((x) => x.id !== a.id))} />
            ))}
          </div>
        </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabButton({ active, onClick, disabled, className, children }: { active: boolean; onClick: () => void; disabled?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} className={clsx('shrink-0 whitespace-nowrap rounded-t-lg border-b-2 px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40', active ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-text', className)}>
      {children}
    </button>
  );
}

/**
 * Assistant toggle, rendered once in the desktop cluster and once in the phone cluster: below 2xl
 * this is the only route to the panel, so it has to survive every width. The hidden copy is
 * `display: none`, so it never reaches the accessibility tree.
 */
function AssistantToggle({ aiOpen, onToggle }: { aiOpen: boolean; onToggle: () => void }) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={aiOpen ? t.playground.closeAssistant : t.playground.assistantOpen}
      aria-expanded={aiOpen}
      aria-controls="playground-assistant"
      className="rounded-lg p-1.5 text-muted hover:bg-surface-2"
    >
      {aiOpen ? <PanelRightClose className="h-4 w-4" /> : <MessageSquareText className="h-4 w-4" />}
    </button>
  );
}

function CopyLinkButton({ sql, persona }: { sql: string; persona: string }) {
  const { t } = useT();
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');

  async function copy() {
    try {
      const s = compressToEncodedURIComponent(sql);
      const as = persona !== 'owner' ? `&as=${encodeURIComponent(persona)}` : '';
      const url = `${window.location.origin}${window.location.pathname}?s=${s}${as}`;
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('error');
    }
    setTimeout(() => setState('idle'), 2000);
  }

  return (
    <button
      onClick={copy}
      title={t.playground.titles.copyLink}
      className={clsx(
        'flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold transition',
        state === 'copied' ? 'border-good/40 text-good' : state === 'error' ? 'border-bad/40 text-bad' : 'hover:bg-surface-2',
      )}
    >
      {state === 'copied'
        ? <span aria-live="polite">{t.common.linkCopied} ✓</span>
        : state === 'error'
        ? <span>{t.common.failed}</span>
        : <><Link2 className="h-3.5 w-3.5" /> {t.playground.copyLink}</>}
    </button>
  );
}

const MULTI_IDS = ['owner', 'alice', 'anon'] as const;
const MULTI_LABELS = ['Superuser (owner role)', 'Alice · Acme (app_member)', 'Anonymous (app_anon)'];

function MultiRunPanel({ multi }: { multi: { results: RunResult[]; skips: number[] } }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {multi.results.map((result, i) => (
        <div key={i} className="min-w-0">
          <div className="mb-1.5 text-[11px] font-semibold text-muted">{MULTI_LABELS[i]}</div>
          <ResultView result={result} skip={multi.skips[i]} compact />
        </div>
      ))}
    </div>
  );
}
