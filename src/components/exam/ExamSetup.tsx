'use client';

/**
 * Exam setup: create an exam, or join one with a code.
 *
 * Creating asks for the settings the host controls and posts them; the server answers with a short
 * code and a paper length. The code is the only thing a participant needs — there is no account and
 * no invite list, which is deliberate for a workshop tool: the host reads the code out loud.
 *
 * The question-count field is capped by what the bank can actually supply for the chosen topics, and
 * the cap is computed here from the same `eligibleCount` the create route uses, so the form cannot
 * offer a number the server would silently reduce.
 */
import { useMemo, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { isPublished, topics } from '@/content/registry';
import { EXAM_BANK } from '@/content/exam-bank';
import { eligibleCount } from '@/lib/exam/paper';
import { questionsThatFit } from '@/lib/exam/types';

const lessonTopics = topics.filter(isPublished).filter((t) => EXAM_BANK.some((q) => q.topicSlug === t.slug));

export function ExamSetup() {
  const [picked, setPicked] = useState<string[]>(lessonTopics.map((t) => t.slug));
  const [count, setCount] = useState(8);
  const [difficulty, setDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [perQuestion, setPerQuestion] = useState(60);
  const [totalMinutes, setTotalMinutes] = useState(10);
  const [scheduledAt, setScheduledAt] = useState('');
  const [showBoard, setShowBoard] = useState(true);
  const [lateJoin, setLateJoin] = useState(true);
  const [showCard, setShowCard] = useState(true);
  const [timeBonus, setTimeBonus] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ code: string; count: number } | null>(null);

  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');

  // The filter is built inline rather than from a shared `settings` object: that object would be a
  // reference every render, so the memo would either be re-done constantly or lie about its deps.
  const maxCount = useMemo(
    () => eligibleCount(EXAM_BANK, { topicSlugs: picked, difficulty }),
    [picked, difficulty],
  );
  const fitsInCeiling = questionsThatFit({ count, perQuestionSeconds: perQuestion, totalSeconds: totalMinutes * 60 });

  const toggle = (slug: string) => setPicked((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : [...p, slug]));

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/exam/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Postgres Exam',
          topicSlugs: picked,
          count,
          difficulty,
          perQuestionSeconds: perQuestion,
          totalSeconds: totalMinutes * 60,
          startTrigger: scheduledAt ? new Date(scheduledAt).toISOString() : 'host',
          showLeaderboard: showBoard,
          allowLateJoin: lateJoin,
          showAnswerCard: showCard,
          timeBonus,
          tiebreaker: 'time',
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'could not create the exam');
        return;
      }
      setCreated({ code: json.code, count: json.count });
    } catch {
      setError('network error');
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-line bg-surface p-6 shadow-card">
        <p className="text-sm text-muted">Share this code with participants</p>
        <p className="my-3 text-center font-mono text-5xl font-bold tracking-[0.2em] text-brand">{created.code}</p>
        <div className="-mt-1 flex justify-center gap-2">
          <CopyButton getText={() => created.code} label="Copy code" />
          <CopyButton getText={() => joinUrl(created.code)} label="Copy link" />
        </div>
        <p className="text-center text-sm text-muted">
          {created.count} questions · {perQuestion}s each
        </p>
        {created.count < count && (
          <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
            Shortened from {count} — that is all the bank can supply for these topics and difficulty.
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <a href={`/exam/${created.code}`} className="flex-1 rounded-lg bg-brand px-4 py-2 text-center text-sm font-bold text-on-brand">
            Open the room
          </a>
          <button onClick={() => setCreated(null)} className="rounded-lg border border-line px-4 py-2 text-sm text-muted">
            New exam
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1fr_280px]">
      <section className="rounded-xl border border-line bg-surface p-6 shadow-card">
        <h2 className="text-lg font-bold">Create an exam</h2>

        <Field label="Topics">
          <div className="flex flex-wrap gap-2">
            {lessonTopics.map((t) => (
              <button
                key={t.slug}
                onClick={() => toggle(t.slug)}
                className={clsx(
                  'rounded-full border px-3 py-1 text-xs font-semibold transition',
                  picked.includes(t.slug) ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted hover:text-text',
                )}
              >
                {t.title}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Questions">
            <NumberField value={count} min={1} max={Math.max(1, maxCount)} onChange={setCount} />
            <p className="mt-1 text-xs text-muted">{maxCount} available</p>
          </Field>
          <Field label="Difficulty">
            <div className="flex gap-1">
              {(['all', 'easy', 'medium', 'hard'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={clsx(
                    'flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold capitalize',
                    difficulty === d ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted',
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Seconds per question">
            <NumberField value={perQuestion} min={10} max={300} onChange={setPerQuestion} />
          </Field>
          <Field label="Total minutes (hard ceiling)">
            <NumberField value={totalMinutes} min={1} max={120} onChange={setTotalMinutes} />
            {fitsInCeiling < count && (
              <p className="mt-1 text-xs text-warn">Only {fitsInCeiling} fit the ceiling — the exam ends at whichever bound comes first.</p>
            )}
          </Field>
        </div>

        <Field label="Start">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-muted">
              <input type="checkbox" checked={!!scheduledAt} onChange={(e) => setScheduledAt(e.target.checked ? new Date(Date.now() + 300000).toISOString().slice(0, 16) : '')} />{' '}
              at a set time
            </label>
            {scheduledAt && <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="rounded-lg border border-line bg-bg px-2 py-1 text-sm" />}
            {!scheduledAt && <span className="text-xs text-muted">when I press Start</span>}
          </div>
        </Field>

        <Field label="Rules">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
            <Check label="Live leaderboard" on={showBoard} onChange={setShowBoard} />
            <Check label="Late join" on={lateJoin} onChange={setLateJoin} />
            <Check label="Answer card after each question" on={showCard} onChange={setShowCard} />
            <Check label="Time bonus" on={timeBonus} onChange={setTimeBonus} />
          </div>
        </Field>

        {error && <p className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}

        <button
          onClick={create}
          disabled={busy || picked.length === 0 || maxCount === 0}
          className="mt-5 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-on-brand disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create exam'}
        </button>
      </section>

      <section className="h-fit rounded-xl border border-line bg-surface p-6 shadow-card">
        <h2 className="text-lg font-bold">Join</h2>
        <p className="mt-1 text-xs text-muted">Type the code your host read out.</p>
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder="ABC123"
          className="mt-3 w-full rounded-lg border border-line bg-bg px-3 py-2 text-center font-mono text-2xl tracking-[0.2em]"
        />
        <input
          value={joinName}
          onChange={(e) => setJoinName(e.target.value.slice(0, 24))}
          placeholder="Your name (optional)"
          className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
        />
        <a
          href={joinCode.length === 6 ? `/exam/${joinCode}?name=${encodeURIComponent(joinName)}` : undefined}
          aria-disabled={joinCode.length !== 6}
          className={clsx(
            'mt-3 block rounded-lg px-4 py-2 text-center text-sm font-bold',
            joinCode.length === 6 ? 'bg-brand text-on-brand' : 'cursor-not-allowed border border-line text-muted',
          )}
        >
          Join exam
        </a>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      {children}
    </div>
  );
}

function NumberField({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
      className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm"
    />
  );
}

function Check({ label, on, onChange }: { label: string; on: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** Absolute join link, read at click time so nothing here depends on the origin during render. */
function joinUrl(code: string) {
  return `${window.location.origin}/exam/${code}`;
}

/**
 * `navigator.clipboard` is only exposed in a secure context, and the host running a workshop often
 * opens this page over a LAN address (`http://192.168.1.20:3000`), where it is undefined. The textarea
 * fallback still copies there, so the button does not turn into a "Failed" label for the one person who
 * most needs it.
 */
async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.readOnly = true;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('copy command rejected');
}

/** Copies on demand and flashes the result for two seconds, the same feedback shape ExportMenu uses. */
function CopyButton({ getText, label }: { getText: () => string; label: string }) {
  const [fb, setFb] = useState<'idle' | 'copied' | 'error'>('idle');

  async function copy() {
    try {
      await copyToClipboard(getText());
      setFb('copied');
    } catch {
      setFb('error');
    }
    setTimeout(() => setFb('idle'), 2000);
  }

  return (
    <button
      onClick={copy}
      className={clsx(
        'rounded-lg border border-line px-3 py-1.5 text-xs font-semibold transition',
        fb === 'copied' ? 'border-good/40 text-good' : fb === 'error' ? 'border-bad/40 text-bad' : 'text-muted hover:bg-surface-2 hover:text-text',
      )}
    >
      {fb === 'copied' ? (
        <span aria-live="polite">{label} ✓</span>
      ) : fb === 'error' ? (
        <span>Select and press Ctrl+C</span>
      ) : (
        label
      )}
    </button>
  );
}
