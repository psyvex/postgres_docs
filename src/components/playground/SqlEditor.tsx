'use client';

import { useEffect, useRef } from 'react';
import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import type { Schema } from '@/lib/db/useSchema';
import { streamAi } from '@/lib/ai/client';
import { BrandLoader } from '@/components/brand/BrandMark';
import { getHistory, getPinned } from '@/lib/playground/history';

type Props = {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  schema: Schema | null;
  schemaText: string;
  aiComplete: boolean;
  onReady?: (editor: Monaco.editor.IStandaloneCodeEditor) => void;
};

const SQL_KEYWORDS = ['SELECT', 'FROM', 'WHERE', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'RETURNING', 'JOIN', 'LEFT JOIN', 'GROUP BY', 'ORDER BY', 'LIMIT', 'CREATE TABLE', 'CREATE POLICY', 'ALTER TABLE', 'ENABLE ROW LEVEL SECURITY', 'FORCE ROW LEVEL SECURITY', 'CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION', 'CREATE PROCEDURE', 'CREATE TRIGGER', 'SECURITY DEFINER', 'SECURITY INVOKER', 'GRANT', 'REVOKE', 'SET ROLE', 'RESET ROLE', 'EXPLAIN ANALYZE', 'WITH CHECK', 'USING', 'BEGIN', 'COMMIT', 'ROLLBACK'];

function useDarkMode() {
  const ref = useRef(false);
  if (typeof document !== 'undefined') ref.current = document.documentElement.classList.contains('dark');
  return ref.current;
}

export function SqlEditor({ value, onChange, onRun, schema, schemaText, aiComplete, onReady }: Props) {
  const monacoRef = useRef<typeof Monaco | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const schemaRef = useRef(schema);
  const aiRef = useRef({ aiComplete, schemaText });
  const runRef = useRef(onRun);
  schemaRef.current = schema;
  aiRef.current = { aiComplete, schemaText };
  runRef.current = onRun;
  const dark = useDarkMode();

  const beforeMount: BeforeMount = (monaco) => {
    monaco.editor.defineTheme('lab-light', {
      base: 'vs',
      inherit: true,
      rules: [{ token: 'keyword', foreground: '336791', fontStyle: 'bold' }, { token: 'string', foreground: '18804f' }, { token: 'comment', foreground: '8a93a3', fontStyle: 'italic' }],
      colors: { 'editor.background': '#ffffff', 'editor.lineHighlightBackground': '#f6f2ea', 'editorLineNumber.foreground': '#b9b1a4' },
    });
    monaco.editor.defineTheme('lab-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [{ token: 'keyword', foreground: '7cc4ff', fontStyle: 'bold' }, { token: 'string', foreground: 'b5e48c' }, { token: 'comment', foreground: '7d8799', fontStyle: 'italic' }],
      colors: { 'editor.background': '#191d27', 'editor.lineHighlightBackground': '#212634', 'editorLineNumber.foreground': '#4b5367' },
    });
  };

  const onMount: OnMount = (editor, monaco) => {
    monacoRef.current = monaco;
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());

    // Query history recall: ↑ in an empty editor cycles through recent queries.
    // The binding fires as a keydown listener (not addCommand) so normal ↑ cursor
    // movement in a non-empty editor is never intercepted.
    let historyIdx = -1;
    editor.onKeyDown((e) => {
      if (e.keyCode !== monaco.KeyCode.ArrowUp && e.keyCode !== monaco.KeyCode.ArrowDown) {
        historyIdx = -1; // typing resets the recall position
        return;
      }
      const model = editor.getModel();
      if (!model || model.getValueLength() > 0) return; // only when empty
      const all = [...getPinned(), ...getHistory()];
      if (all.length === 0) return;
      if (e.keyCode === monaco.KeyCode.ArrowUp) {
        historyIdx = Math.min(historyIdx + 1, all.length - 1);
      } else {
        historyIdx = Math.max(historyIdx - 1, 0);
      }
      const text = all[historyIdx];
      const lines = text.split('\n').length;
      model.setValue(text);
      editor.setPosition({ lineNumber: lines, column: text.split('\n').at(-1)!.length + 1 });
      e.preventDefault();
      e.stopPropagation();
    });

    onReady?.(editor);

    // Schema-aware completions: tables, columns, functions and common statements.
    const completion = monaco.languages.registerCompletionItemProvider('sql', {
      triggerCharacters: ['.', ' '],
      provideCompletionItems(model: Monaco.editor.ITextModel, position: Monaco.Position) {
        const word = model.getWordUntilPosition(position);
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
        const s = schemaRef.current;
        const K = monaco.languages.CompletionItemKind;
        const items: Monaco.languages.CompletionItem[] = SQL_KEYWORDS.map((k) => ({ label: k, kind: K.Keyword, insertText: k, range }));
        s?.tables.forEach((t) => {
          items.push({ label: t.name, kind: K.Struct, detail: `${t.schema} table${t.rlsEnabled ? ' · RLS' : ''}`, insertText: t.name, range });
          t.columns.forEach((c) => items.push({ label: c.name, kind: K.Field, detail: `${t.name}.${c.name} ${c.type}`, insertText: c.name, range, sortText: `z${c.name}` }));
        });
        s?.functions.forEach((f) => items.push({ label: f.name, kind: K.Function, detail: `(${f.args}) → ${f.returns}`, insertText: `${f.name}($0)`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range }));
        s?.roles.forEach((r) => items.push({ label: r.name, kind: K.User, detail: 'role', insertText: r.name, range, sortText: `zz${r.name}` }));
        return { suggestions: items };
      },
    });

    // AI ghost-text completions, debounced so we only ask after the user pauses typing.
    const inline = monaco.languages.registerInlineCompletionsProvider('sql', {
      async provideInlineCompletions(model: Monaco.editor.ITextModel, position: Monaco.Position, _ctx: Monaco.languages.InlineCompletionContext, token: Monaco.CancellationToken) {
        if (!aiRef.current.aiComplete) return { items: [] };
        await new Promise((r) => setTimeout(r, 650));
        if (token.isCancellationRequested) return { items: [] };
        const offset = model.getOffsetAt(position);
        const text = model.getValue();
        if (!text.slice(0, offset).trim()) return { items: [] };
        const controller = new AbortController();
        token.onCancellationRequested(() => controller.abort());
        try {
          const sql = `${text.slice(0, offset)}⟨CURSOR⟩${text.slice(offset)}`;
          const suggestion = (await streamAi('complete', { sql, schema: aiRef.current.schemaText }, () => {}, controller.signal)).replace(/^```\w*\n?|```$/g, '')
            // Some gateway models (e.g. coder) prefix the stream with blank lines; drop them so ghost text stays inline.
            .replace(/^\n+/, '');
          if (!suggestion.trim() || suggestion.includes('**Error:**')) return { items: [] };
          return { items: [{ insertText: suggestion, range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column) }] };
        } catch {
          return { items: [] };
        }
      },
      disposeInlineCompletions() {},
    });

    editor.onDidDispose(() => {
      completion.dispose();
      inline.dispose();
    });
  };

  // Follow the app's light/dark toggle.
  useEffect(() => {
    const observer = new MutationObserver(() => monacoRef.current?.editor.setTheme(document.documentElement.classList.contains('dark') ? 'lab-dark' : 'lab-light'));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <Editor
      wrapperProps={{ dir: 'ltr' }}
      language="sql"
      value={value}
      onChange={(v) => onChange(v ?? '')}
      beforeMount={beforeMount}
      onMount={onMount}
      theme={dark ? 'lab-dark' : 'lab-light'}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: 'var(--font-code), ui-monospace, monospace',
        lineNumbersMinChars: 3,
        scrollBeyondLastLine: false,
        padding: { top: 12 },
        inlineSuggest: { enabled: true },
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
      }}
      loading={<BrandLoader label="Loading editor…" />}
    />
  );
}
