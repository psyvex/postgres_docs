'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, Sparkles, X } from 'lucide-react';
import { streamAi, type AiPayload, type AiTask } from '@/lib/ai/client';

type Props = { task: AiTask; payload: AiPayload; onClose: () => void; title?: string };

/** Streams and renders one AI answer. Remount (change `key`) to ask again. */
export function AiAnswer({ task, payload, onClose, title }: Props) {
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  const payloadRef = useRef(payload);

  useEffect(() => {
    const controller = new AbortController();
    streamAi(task, payloadRef.current, setText, controller.signal)
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setText(`**Error:** ${e instanceof Error ? e.message : 'AI request failed'}`);
      })
      .finally(() => setDone(true));
    return () => controller.abort();
  }, [task]);

  return (
    <div className="rounded-xl border border-accent/30 bg-accent-soft/50 p-4 text-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold text-accent">
        <Sparkles className="h-3.5 w-3.5" /> {title ?? 'AI assistant'}
        {!done && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        <button onClick={onClose} aria-label="Close" className="ml-auto rounded p-0.5 hover:bg-surface">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="prose-lab text-[0.92rem] [&_pre]:text-xs">
        {text ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown> : <span className="text-muted">Thinking…</span>}
      </div>
    </div>
  );
}
