'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GitCompare, Loader2, Minus, Play, Plus, Sparkles, X, Zap } from 'lucide-react';
import type { AiPayload, AiTask } from '@/lib/ai/client';
import { useAiAnswer } from '@/components/ai/useAiAnswer';
import { useAiFontSize } from '@/components/ai/useAiFontSize';
import { DiffView } from './DiffView';

type Props = {
  task: AiTask;
  payload: AiPayload;
  onClose: () => void;
  title?: string;
  /** When provided (playground), the answer shows Apply / Apply & Run buttons for fenced SQL blocks. */
  onApplySql?: (sql: string, run: boolean) => void;
};

/**
 * Renders one AI answer, served by the answer store: closing the panel, remounting or
 * reloading never re-asks the model. The ⚡ (Zap) button is the only thing that spends a request.
 */
export function AiAnswer({ task, payload, onClose, title, onApplySql }: Props) {
  const { text, done, retry, usage } = useAiAnswer(task, payload);
  const font = useAiFontSize();
  const [showDiff, setShowDiff] = useState(false);

  // Extract the first fenced SQL block (if any) so we can offer Apply / Apply & Run.
  const sqlBlock = done ? (text.match(/```sql\n([\s\S]*?)```/)?.[1]?.trim() ?? null) : null;
  const showDiffToggle = task === 'review' && done && !!payload.sql && !!sqlBlock;

  return (
    <div className="rounded-xl border border-accent/30 bg-accent-soft/50 p-3 sm:p-4 text-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold text-accent">
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 truncate">{title ?? 'AI assistant'}</span>
        {!done && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />}

        {/* Toolbar: grouped right, separated by a border */}
        <span className="ml-auto flex items-center gap-1 rounded-lg border border-accent/20 bg-accent/5 p-0.5">
          {/* Token badge: shown when the model reported usage. */}
          {done && usage && (
            <span
              className="flex items-center gap-2 rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] tabular-nums"
              title={`Input tokens: ${usage.i.toLocaleString()} · Output tokens: ${usage.o.toLocaleString()}`}
            >
              <span className="text-muted" aria-label={`${usage.i} input tokens`}>↑ {usage.i.toLocaleString()}</span>
              <span className="text-accent" aria-label={`${usage.o} output tokens`}>↓ {usage.o.toLocaleString()}</span>
            </span>
          )}

          {/* Retry */}
          {done && (
            <ToolbarButton title="Ask again (spends a request)" onClick={retry}>
              <Zap className="h-3 w-3" />
            </ToolbarButton>
          )}

          {/* Font size controls */}
          <span className="flex items-center gap-0.5">
            <ToolbarButton title="Smaller text" onClick={() => font.step(-1)} disabled={!font.custom && font.px <= font.min}>
              <Minus className="h-3 w-3" />
            </ToolbarButton>

            {/* Current size — click to reset to auto */}
            <ToolbarButton
              title={font.custom ? `${Math.round(font.px)}px — click to reset to auto` : 'Auto size — click to customise'}
              onClick={font.custom ? font.reset : undefined}
              className="min-w-[2rem] justify-center font-mono text-[11px] font-semibold leading-none"
            >
              {font.custom ? Math.round(font.px) : 'A'}
            </ToolbarButton>

            <ToolbarButton title="Bigger text" onClick={() => font.step(1)} disabled={!font.custom && font.px >= font.max}>
              <Plus className="h-3 w-3" />
            </ToolbarButton>
          </span>

          {/* Divider */}
          <span className="mx-0.5 h-4 w-px bg-accent/20" aria-hidden />

          {/* Close */}
          <ToolbarButton title="Close" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </ToolbarButton>
        </span>
      </div>

      <div className="ai-text prose-lab">
        {text ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown> : <span className="text-muted">Thinking…</span>}
      </div>

      {/* Diff toggle for review answers. */}
      {showDiffToggle && (
        <div className="mt-3 border-t border-accent/20 pt-3">
          <button
            onClick={() => setShowDiff((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-2"
            title="Compare the original SQL with the AI's improved version"
          >
            <GitCompare className="h-3.5 w-3.5 text-accent" />
            {showDiff ? 'Hide diff' : 'Show diff'}
          </button>
          {showDiff && payload.sql && (
            <div className="mt-2">
              <DiffView original={payload.sql} improved={sqlBlock!} />
            </div>
          )}
        </div>
      )}

      {/* Apply / Apply & Run — playground only, shown when the answer contains a SQL block. */}
      {onApplySql && sqlBlock && (
        <div className="mt-3 flex gap-2 border-t border-accent/20 pt-3">
          <button
            onClick={() => onApplySql(sqlBlock, false)}
            className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-2"
            title="Replace the editor SQL with the AI's answer"
          >
            Apply
          </button>
          <button
            onClick={() => onApplySql(sqlBlock, true)}
            className="flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-bold text-on-brand"
            title="Replace the editor SQL and run immediately"
          >
            <Play className="h-3 w-3" /> Apply & Run
          </button>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({ title, onClick, children, className = '', disabled = false }: { title: string; onClick?: () => void; children: React.ReactNode; className?: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex h-6 items-center gap-1 rounded-md px-1.5 text-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-30 ${className}`}
    >
      {children}
    </button>
  );
}
