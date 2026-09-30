'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { DemoFrame, Segmented } from '@/components/docs/Callout';

interface JsonObj { [k: string]: JsonValue }
type JsonValue = string | number | boolean | null | JsonValue[] | JsonObj;

type ValKind = 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object';

type Token =
  | { k: 'open';  v: '{' | '[' }
  | { k: 'close'; v: '}' | ']' }
  | { k: 'comma' }
  | { k: 'pair';  key: string; val: string; vk: ValKind }
  | { k: 'elem';  val: string; vk: ValKind };

/** Flattens a primitive to { val, vk } for inline display. */
function primitive(v: JsonValue): { val: string; vk: ValKind } {
  if (v === null)              return { val: 'null',  vk: 'null'    };
  if (typeof v === 'boolean') return { val: String(v), vk: 'boolean' };
  if (typeof v === 'number')  return { val: String(v), vk: 'number'  };
  if (typeof v === 'string')  return { val: JSON.stringify(v), vk: 'string' };
  if (Array.isArray(v))       return { val: '[...]',  vk: 'array'   };
  return { val: '{...}', vk: 'object' };
}

function fmt(value: JsonValue): Token[] {
  if (value === null || typeof value !== 'object') {
    const p = primitive(value);
    return [{ k: 'pair', key: '', ...p }];
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return [{ k: 'pair', key: '', val: '[]', vk: 'array' }];
    const tokens: Token[] = [{ k: 'open', v: '[' }];
    value.forEach((item, i) => {
      const p = primitive(item);
      tokens.push({ k: 'elem', ...p });
      if (i < value.length - 1) tokens.push({ k: 'comma' });
    });
    tokens.push({ k: 'close', v: ']' });
    return tokens;
  }
  const keys = Object.keys(value).sort();
  if (keys.length === 0) return [{ k: 'pair', key: '', val: '{}', vk: 'object' }];
  const tokens: Token[] = [{ k: 'open', v: '{' }];
  keys.forEach((k, i) => {
    const p = primitive(value[k]);
    tokens.push({ k: 'pair', key: k, ...p });
    if (i < keys.length - 1) tokens.push({ k: 'comma' });
  });
  tokens.push({ k: 'close', v: '}' });
  return tokens;
}

function cls(vk: ValKind): string {
  switch (vk) {
    case 'string':  return 'text-code-text';
    case 'number':  return 'text-accent';
    case 'boolean': return 'text-brand';
    case 'null':    return 'text-muted italic';
    case 'array':   return 'text-muted';
    case 'object':   return 'text-muted';
  }
}

function valSpan(val: string, vk: ValKind) {
  return <span className={cls(vk)}>{val}</span>;
}

type Mode = 'normalised' | 'keys' | 'mutate';

const RAW: JsonObj   = { title: 'hello', tags: ['postgres', 'jsonb'], active: true, score: 42, meta: null };
const MIXED: JsonObj = { tags: ['postgres', 'jsonb'], active: true, score: 42, meta: null, title: 'hello' };
const STRAY: JsonObj = {
  title: 'hello', active: true, score: 42, tags: ['postgres', 'jsonb'], meta: null,
};

const NORMALISED_EXPLAINERS = [
  { label: 'keys sorted', json: RAW },
  { label: 'whitespace normalised', json: STRAY },
  { label: 'key order irrelevant', json: MIXED },
];

const MUTATIONS = [
  {
    label: 'jsonb_set — add key',
    sql: `SELECT jsonb_set('{"title":"hello"}'::jsonb, '{author}', '"Alice"') AS updated;`,
    result: '{"title":"hello","author":"Alice"}',
  },
  {
    label: '|| — merge objects',
    sql: `SELECT '{"title":"hello"}'::jsonb || '{"author":"Alice"}'::jsonb AS merged;`,
    result: '{"title":"hello","author":"Alice"}',
  },
  {
    label: '- key — delete key',
    sql: `SELECT '{"title":"hello","author":"Alice"}'::jsonb - 'author' AS deleted;`,
    result: '{"title":"hello"}',
  },
  {
    label: '#- — delete nested path',
    sql: `SELECT '{"user":{"name":"Alice","email":"a@b.com"}}'::jsonb #- '{user,email}' AS result;`,
    result: '{"user":{"name":"Alice"}}',
  },
  {
    label: 'jsonb_insert — into array',
    sql: `SELECT jsonb_insert('[1,2,3]'::jsonb, '{1}', '99') AS inserted;`,
    result: '[1,99,2,3]',
  },
  {
    label: 'strip_nulls — remove nulls',
    sql: `SELECT jsonb_strip_nulls('{"a":null,"b":1,"c":{"d":null}}'::jsonb) AS result;`,
    result: '{"b":1,"c":{}}',
  },
];

export function JsonTree() {
  const [mode, setMode] = useState<Mode>('normalised');
  const [itemIdx, setItemIdx] = useState(0);

  const normalised = mode === 'normalised' ? NORMALISED_EXPLAINERS[itemIdx] : null;
  const parsed: JsonValue | null = normalised ? (normalised.json as JsonValue) : null;
  const tokens = parsed ? fmt(parsed) : [];

  return (
    <DemoFrame
      title="jsonb internals"
      icon="jsonb"
      subtitle={
        mode === 'normalised'
          ? normalised?.label
          : mode === 'keys'
          ? 'equality holds regardless of key order'
          : 'modification never mutates the original'
      }
      controls={
        <Segmented
          value={mode}
          options={[
            { value: 'normalised', label: 'Normalised' },
            { value: 'keys',       label: 'Key order'  },
            { value: 'mutate',    label: 'Mutate'     },
          ]}
          onChange={(v) => { setMode(v as Mode); setItemIdx(0); }}
        />
      }
    >
      <div
        className="rounded-xl border border-line bg-code-bg p-4 font-mono text-sm leading-7"
        style={{ minWidth: 340 }}
      >
        {mode === 'mutate' ? (
          <MutationView />
        ) : mode === 'keys' ? (
          <KeyOrderView />
        ) : (
          <div className="space-y-0.5">
            {mode === 'normalised' && (
              <div className="mb-3 flex gap-2">
                {NORMALISED_EXPLAINERS.map((item, i) => (
                  <button
                    key={item.label}
                    onClick={() => setItemIdx(i)}
                    className={`rounded px-2 py-0.5 text-xs transition ${
                      i === itemIdx
                        ? 'bg-brand text-white'
                        : 'bg-surface-2 text-muted hover:text-code-text'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
            {tokens.map((tok, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -3 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.035, duration: 0.12 }}
              >
                {tok.k === 'open'  && <span className="text-muted">{tok.v}</span>}
                {tok.k === 'close' && <span className="text-muted">{tok.v}</span>}
                {tok.k === 'comma' && <span className="text-muted">,</span>}
                {tok.k === 'pair' && !tok.key && valSpan(tok.val, tok.vk)}
                {tok.k === 'pair' && tok.key && (
                  <span>
                    <span className="text-brand">{'"'}{tok.key}{'"'}</span>
                    <span className="text-muted">: </span>
                    {valSpan(tok.val, tok.vk)}
                  </span>
                )}
                {tok.k === 'elem' && valSpan(tok.val, tok.vk)}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DemoFrame>
  );
}

function MutationView() {
  const [step, setStep] = useState(0);
  const m = MUTATIONS[step];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {MUTATIONS.map((m, i) => (
          <button
            key={m.label}
            onClick={() => setStep(i)}
            className={`rounded px-2 py-1 text-xs font-mono transition ${
              i === step
                ? 'bg-brand text-white'
                : 'bg-surface-2 text-muted hover:text-code-text'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
          SQL
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap text-[13px] leading-relaxed text-code-text">
          {m.sql}
        </pre>
      </div>
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
          Result
        </div>
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono text-sm"
        >
          <span className="text-muted">{'{'}</span>
          {renderResult(m.result)}
          <span className="text-muted">{'}'}</span>
        </motion.div>
      </div>
    </div>
  );
}

function renderResult(json: string): React.ReactNode {
  let parsed: JsonValue;
  try { parsed = JSON.parse(json); } catch { return <span>{json}</span>; }
  return renderJson(parsed);
}

const DOC_A = { title: 'hello', tags: ['postgres', 'jsonb'], active: true, score: 42, meta: null };
const DOC_B = { score: 42, meta: null, title: 'hello', active: true, tags: ['postgres', 'jsonb'] };

function KeyOrderView() {
  const sortedA = fmt(DOC_A);
  const sortedB = fmt(DOC_B);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'input order A', obj: DOC_A, tokens: sortedA },
          { label: 'input order B', obj: DOC_B, tokens: sortedB },
        ].map(({ label, obj, tokens }) => (
          <div key={label}>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
              {label}
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-muted">
                {'{'}{Object.keys(obj).join(', ')}…{'}'}
              </div>
              <div className="mt-2 space-y-0.5">
                {tokens.map((tok, i) => (
                  <div key={i}>
                    {tok.k === 'open'  && <span className="text-muted">{tok.v}</span>}
                    {tok.k === 'close' && <span className="text-muted">{tok.v}</span>}
                    {tok.k === 'comma' && <span className="text-muted">,</span>}
                    {tok.k === 'pair' && !tok.key && valSpan(tok.val, tok.vk)}
                    {tok.k === 'pair' && tok.key && (
                      <span>
                        <span className="text-brand">{'"'}{tok.key}{'"'}</span>
                        <span className="text-muted">: </span>
                        {valSpan(tok.val, tok.vk)}
                      </span>
                    )}
                    {tok.k === 'elem' && valSpan(tok.val, tok.vk)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-line bg-surface p-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
          Stored binary (identical)
        </div>
        <div className="font-mono text-sm text-good">
          {'{'}&quot;active&quot;: true, &quot;meta&quot;: null, &quot;score&quot;: 42,
          &quot;tags&quot;: [...], &quot;title&quot;: &quot;hello&quot;{'}'}
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="font-mono text-brand">A</span>
          <span className="text-muted">==</span>
          <span className="font-mono text-brand">B</span>
          <span className="text-muted">→</span>
          <span className="font-mono font-semibold text-good">true</span>
          <span className="text-muted text-xs">— a single binary comparison, no re-parse</span>
        </div>
      </div>
    </div>
  );
}

function renderJson(v: JsonValue): React.ReactNode {
  if (v === null) return <span className="text-muted italic">null</span>;
  if (typeof v === 'string') return <span className="text-code-text">{'"'}{v}{'"'}</span>;
  if (typeof v === 'number')  return <span className="text-accent">{v}</span>;
  if (typeof v === 'boolean') return <span className="text-brand">{String(v)}</span>;
  if (Array.isArray(v)) {
    return (
      <>
        <span className="text-muted">[</span>
        {v.map((item, i) => (
          <span key={i}>
            {renderJson(item)}
            {i < v.length - 1 && <span className="text-muted">, </span>}
          </span>
        ))}
        <span className="text-muted">]</span>
      </>
    );
  }
  const keys = Object.keys(v).sort();
  return (
    <>
      <span className="text-muted">{'{'}</span>
      {keys.map((k, i) => (
        <span key={k}>
          <span className="text-brand">{'"'}{k}{'"'}</span>
          <span className="text-muted">: </span>
          {renderJson(v[k])}
          {i < keys.length - 1 && <span className="text-muted">, </span>}
        </span>
      ))}
      <span className="text-muted">{'}'}</span>
    </>
  );
}
