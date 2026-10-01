'use client';

/**
 * The live exam room.
 *
 * Renders once as a full-page shell, then polls `/api/exam/[code]/state` every 3 seconds to refresh.
 * Polling rather than SSE is the resilient path here — if an event is lost, the next poll fixes it.
 * Nothing in the exam requires delivery, so an occasional missed update costs a delayed leaderboard
 * rather than a wrong one.
 *
 * Host and participant share the same shell; the API response carries `isHost` and `me` to determine
 * which view is rendered. A reload always re-fetches state, so there's no client-side state that can
 * drift from the server.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import type { SerialisedQuestion, Stimulus } from '@/lib/exam/types';

/**
 * Fetches the question at the current index once, and only once per index.
 *
 * Keyed on `index` rather than polled with the state, because a question's content never changes
 * during its window — only which question is current changes. Re-fetching it every poll would be
 * wasted work, and a stale question on screen after an advance is the failure this avoids by
 * clearing on index change.
 */
function useQuestion(code: string, index: number, enabled: boolean) {
  // Tagged with the index it was fetched for, and compared during render. Storing the answer
  // untagged and clearing it in an effect would mean one render — the one between the index changing
  // and the effect running — still showing the previous question.
  const [fetched, setFetched] = useState<{ index: number; question: SerialisedQuestion | null } | null>(null);
  const [failed, setFailed] = useState<{ index: number; message: string } | null>(null);

  useEffect(() => {
    if (!enabled || index < 0) return;
    let alive = true;
    fetch(`/api/exam/${code}/question/${index}`)
      .then(async (r) => {
        if (r.status === 408 || r.status === 410) return null;
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? 'could not load the question');
        return j.question as SerialisedQuestion;
      })
      .then((q) => {
        if (alive && q) setFetched({ index, question: q });
      })
      .catch((e: Error) => {
        if (alive) setFailed({ index, message: e.message });
      });
    return () => {
      alive = false;
    };
  }, [code, index, enabled]);

  return {
    question: fetched?.index === index ? fetched.question : null,
    error: failed?.index === index ? failed.message : null,
  };
}

// ── State shape ────────────────────────────────────────────────────────────────

type State = {
  code: string;
  status: 'created' | 'waiting' | 'active' | 'finished';
  isHost: boolean;
  title: string;
  questionCount: number;
  currentIndex: number;
  deadline: number | null;
  endsAt: number | null;
  startsAt: number | null;
  serverNow: number;
  participantCount: number;
  perQuestionSeconds: number;
  showLeaderboard: boolean;
  showAnswerCard: boolean;
  timeBonus: boolean;
  paper: string[];
  leaderboard: LeaderboardEntry[];
  me: Me | null;
};

type Me = { id: string; displayName: string; totalScore: number; wrongCount: number; answered: string[]; rank: number | null };

type LeaderboardEntry = { rank: number; participantId: string; displayName: string; totalScore: number; wrongCount: number; byQuestion: Record<string, number> };

// ── Shell ──────────────────────────────────────────────────────────────────

export function ExamRoom({ code, initialName = '' }: { code: string; initialName?: string }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/exam/${code}/state`);
      if (!res.ok) {
        // Exams live in this process's memory, so a restart or a deploy erases one that is mid-flight
        // and every poll from then on is a 404. Raw JSON like {"error":"exam not found"} on a screen
        // in front of a room of people explains nothing; say what happened and what to do.
        setError(res.status === 404
          ? `Exam ${code} no longer exists on this server. Exams are held in memory, so a restart or redeploy ends one that is in progress — create a new one and share the new code.`
          : `The exam server answered ${res.status}. Waiting for it to come back…`);
        return;
      }
      const json = await res.json();
      setState(json);
      setError(null);
    } catch {
      setError('could not reach the exam server');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => { poll(); const id = setInterval(poll, 3000); return () => clearInterval(id); }, [poll]);

  /**
   * Registers this browser as a participant. The join card can only link to the room — a link cannot
   * POST and pick up the httpOnly participant cookie on the way — so arriving is what has to do the
   * registering. Without it nothing ever called `/join`, the exam sat at "0 participants", the host's
   * Start button stayed disabled, and the participant's question request came back 403 "join first".
   */
  const join = useCallback(async (displayName: string) => {
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/exam/${code}/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName }),
      });
      if (!res.ok) setJoinError((await res.json().catch(() => ({}))).error ?? 'could not join that exam');
      await poll();
    } catch {
      setJoinError('could not reach the exam server');
    } finally {
      setJoining(false);
    }
  }, [code, poll]);

  // Arriving with `?name=` from the join card joins once, and only for someone who is neither the
  // host nor already registered by cookie — a reload must not add a second seat to the room.
  const joinedOnArrival = useRef(false);
  useEffect(() => {
    if (!state || joinedOnArrival.current || !initialName) return;
    if (state.isHost || state.me) return;
    joinedOnArrival.current = true;
    void join(initialName);
  }, [state, initialName, join]);

  if (loading) return <Shell><Pulse /></Shell>;
  if (error) return <Shell><p className="text-center text-bad py-12">{error}</p></Shell>;
  if (!state) return null;

  // Not the host and not registered: the room has nothing this browser can do yet, so ask for the
  // one thing that makes it a participant instead of rendering questions that will be refused.
  if (!state.isHost && !state.me) {
    return (
      <Shell>
        <JoinGate code={code} initialName={initialName} joining={joining} error={joinError} onJoin={join} />
      </Shell>
    );
  }

  return (
    <Shell>
      <StatusBar state={state} onRefresh={poll} />
      {state.isHost ? <HostView state={state} /> : <ParticipantView state={state} code={code} />}
    </Shell>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────

function Shell({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>;
}

function Pulse() {
  return <div className="flex items-center justify-center py-24"><div className="h-8 w-8 animate-pulse rounded-full bg-brand opacity-60" /></div>;
}

/**
 * The name-and-join card, for a browser that has arrived at a room it is not registered in.
 *
 * Carries the name over from `?name=` so someone who came from the join card usually has one keypress
 * of work left, and still works when they arrive with no name at all — a bare link to `/exam/AB12CD`
 * has to work too. The submit is what actually registers the seat; arriving never does it alone,
 * because the host may have shared the code without a name attached.
 */
function JoinGate({
  code, initialName, joining, error, onJoin,
}: { code: string; initialName: string; joining: boolean; error: string | null; onJoin: (name: string) => void }) {
  const [name, setName] = useState(initialName);

  return (
    <div className="rounded-xl border border-line bg-surface p-6 text-center shadow-card">
      <p className="text-lg font-bold">Join exam <span className="font-mono text-brand">{code}</span></p>
      <p className="mt-1 text-sm text-muted">Pick a display name — it appears on the leaderboard for this exam only.</p>
      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && !joining) onJoin(name.trim());
        }}
      >
        <label className="sr-only" htmlFor="join-name">Your name</label>
        <input
          id="join-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ada"
          maxLength={24}
          className="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!name.trim() || joining}
          className="rounded-lg bg-brand px-6 py-2.5 text-sm font-bold text-on-brand disabled:opacity-50"
        >
          {joining ? 'Joining…' : 'Join exam'}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      <p className="mt-4 text-sm">
        <a href="/exam" className="text-muted underline hover:text-text">← back to exam setup</a>
      </p>
    </div>
  );
}

// ── Status bar ───────────────────────────────────────────────────────────────

function StatusBar({ state, onRefresh }: { state: State; onRefresh: () => void }) {
  const { code, status, participantCount, isHost, questionCount, currentIndex } = state;

  const statusLabel: Record<string, string> = {
    created: 'Waiting to start',
    waiting: `Waiting · ${participantCount} joined`,
    active: `Q${currentIndex + 1} of ${questionCount}`,
    finished: 'Finished',
  };

  return (
    <div className="mb-6 flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs font-bold tracking-widest text-brand">{code}</span>
        <span className="h-4 w-px bg-line" />
        <span className="text-sm font-medium">{state.title}</span>
        <span className={clsx('rounded-full px-2 py-0.5 text-xs font-bold', {
          'bg-warn-soft text-warn': status === 'waiting' || status === 'created',
          'bg-brand-soft text-brand': status === 'active',
          'bg-good-soft text-good': status === 'finished',
        })}>
          {statusLabel[status] ?? status}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {!isHost && state.me && (
          <span className="text-sm text-muted">{state.me.displayName} · #{state.me.rank ?? '—'}</span>
        )}
        <button onClick={onRefresh} className="rounded-lg border border-line px-2 py-1 text-xs text-muted hover:text-text">
          ↻
        </button>
      </div>
    </div>
  );
}

// ── Host view ────────────────────────────────────────────────────────────────

function HostView({ state }: { state: State }) {
  const { status, participantCount, questionCount } = state;
  const [starting, setStarting] = useState(false);

  async function start() {
    setStarting(true);
    await fetch(`/api/exam/${state.code}/start`, { method: 'POST' }).catch(() => undefined);
    setStarting(false);
  }

  return (
    <div className="space-y-6">
      {/*
        `created` is the state a host-triggered exam sits in from the moment it exists until the first
        participant joins, so this is the first screen a host ever sees. Rendering it only for
        `waiting` left the room blank — no code to share, no way to start — until somebody joined,
        which is the one thing the screen exists to tell the host how to cause.
      */}
      {(status === 'created' || status === 'waiting') && (
        <div className="rounded-xl border border-line bg-surface p-6 text-center shadow-card">
          <p className="text-lg font-bold">{participantCount} participant{participantCount !== 1 ? 's' : ''} waiting</p>
          <p className="mt-1 text-sm text-muted">Share the code <span className="font-mono font-bold text-brand">{state.code}</span> to let more people join.</p>
          <button
            onClick={start}
            disabled={starting || participantCount === 0}
            className="mt-4 rounded-lg bg-brand px-6 py-2.5 text-sm font-bold text-on-brand disabled:opacity-50"
          >
            {starting ? 'Starting…' : `Start now · ${questionCount} questions`}
          </button>
          {participantCount === 0 && <p className="mt-2 text-xs text-muted">No one has joined yet — share the code first.</p>}
        </div>
      )}

      <Leaderboard board={state.leaderboard} title="Live Leaderboard" />

      {status === 'active' && <HostProgress state={state} />}
    </div>
  );
}

/**
 * How far along the exam is, from the host's seat.
 *
 * The strip measures the *clock*, not the players, and that is deliberate: every participant works a
 * different paper, so `byQuestion` is keyed by question ids the host cannot line up against an index.
 * "How many people have finished question 3" is not answerable from this data without leaking papers.
 * What is answerable — and what a host actually wants — is how much of the run is behind us, and how
 * many answers have landed in total.
 */
function HostProgress({ state }: { state: State }) {
  const { questionCount, currentIndex, leaderboard, participantCount } = state;
  const answersIn = leaderboard.reduce((n, e) => n + Object.keys(e.byQuestion).length, 0);
  const expected = participantCount * questionCount;

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <p className="text-sm font-medium">
        Question {currentIndex + 1} of {questionCount}
      </p>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: questionCount }, (_, i) => (
          <div
            key={i}
            className={clsx('h-2 flex-1 rounded-full', i < currentIndex ? 'bg-good' : i === currentIndex ? 'bg-brand animate-pulse' : 'bg-line')}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        {answersIn} of {expected || '—'} answers submitted
      </p>
    </div>
  );
}

// ── Participant view ─────────────────────────────────────────────────────────

function ParticipantView({ state, code }: { state: State; code: string }) {
  const { status, currentIndex, deadline, showLeaderboard, showAnswerCard } = state;
  const { me } = state;

  // The draft text and the verdict are both tagged with the question they belong to and compared
  // during render, so advancing needs no reset effect — and a typed-but-unsubmitted answer can never
  // leak onto the next question, which a `useEffect` reset would briefly allow.
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<{ index: number; text: string } | null>(null);
  const [verdict, setVerdict] = useState<{ index: number; correct: boolean; score: number; detail?: string; card?: AnswerCard } | null>(null);

  const input = draft?.index === currentIndex ? draft.text : '';
  const result = verdict?.index === currentIndex ? verdict : null;

  // A submitted answer stands until the index moves, so the result card survives the next poll.
  const { question, error: questionError } = useQuestion(code, currentIndex, status === 'active' && !result);

  // The countdown is a `now` that a timer bumps; the number itself is derived, so there is exactly one
  // place that decides what time is left. The deadline is the server's absolute timestamp, which is
  // why the display measures against a clock the server also set rather than a client-side duration
  // that would drift for every tab opened late.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [deadline]);

  const secondsLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;

  async function submit() {
    if (!input.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/exam/${code}/question/${currentIndex}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sql: input }),
      });
      const json = await res.json();
      if (res.ok) setVerdict({ index: currentIndex, ...json });
      else setVerdict({ index: currentIndex, correct: false, score: 0, detail: json.error });
    } catch {
      setVerdict({ index: currentIndex, correct: false, score: 0, detail: 'network error' });
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'created' || status === 'waiting') {
    return (
      <div className="rounded-xl border border-line bg-surface p-8 text-center shadow-card">
        <p className="text-lg font-bold">Waiting for the host to start…</p>
        <p className="mt-2 text-sm text-muted">{state.participantCount} participant{state.participantCount !== 1 ? 's' : ''} here so far.</p>
      </div>
    );
  }

  if (status === 'finished') {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-surface p-6 text-center shadow-card">
          <p className="text-2xl font-bold">Exam complete!</p>
          <p className="mt-2 text-lg">
            {me ? (
              <>You scored <span className="text-brand font-bold">{me.totalScore}</span> points{me.rank ? ` · rank ${me.rank}` : ''}</>
            ) : 'Thanks for playing.'}
          </p>
        </div>
        {showLeaderboard && <Leaderboard board={state.leaderboard} title="Final results" />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {result ? (
        <ResultCard result={result} showCard={showAnswerCard} secondsLeft={secondsLeft} />
      ) : questionError ? (
        <Notice tone="bad">{questionError}</Notice>
      ) : !question ? (
        <Pulse />
      ) : (
        <QuestionCard
          question={question}
          secondsLeft={secondsLeft}
          input={input}
          onInput={(text) => setDraft({ index: currentIndex, text })}
          onSubmit={submit}
          submitting={submitting}
          timeUp={!!deadline && secondsLeft <= 0}
        />
      )}

      {showLeaderboard && state.leaderboard.length > 0 && <Leaderboard board={state.leaderboard} title="Leaderboard" />}
    </div>
  );
}

// ── Question card ───────────────────────────────────────────────────────────

function QuestionCard({
  question, secondsLeft, input, onInput, onSubmit, submitting, timeUp,
}: {
  question: SerialisedQuestion; secondsLeft: number; input: string; onInput: (s: string) => void;
  onSubmit: () => void; submitting: boolean; timeUp: boolean;
}) {
  const urgent = secondsLeft < 10;
  return (
    <div className="rounded-xl border border-line bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="text-xs font-bold text-muted">
          Question {question.index + 1} · {question.points} pts · as <span className="font-mono">{question.persona}</span>
        </span>
        <span className={clsx('font-mono text-sm font-bold tabular-nums', urgent ? 'text-bad animate-pulse' : 'text-text')}>
          {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}
        </span>
      </div>

      <div className="border-b border-line px-4 py-3">
        <p className="text-base font-semibold">{question.prompt}</p>
      </div>

      <StimulusView stimulus={question.stimulus} />

      <div className="p-4">
        <textarea
          value={input}
          onChange={(e) => onInput(e.target.value)}
          placeholder="Write the SQL that answers it"
          aria-label="Your SQL answer"
          className="w-full resize-none rounded-lg border border-line bg-bg px-3 py-2 font-mono text-sm"
          rows={3}
          disabled={submitting || timeUp}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmit(); }}
        />
        <button
          onClick={onSubmit}
          disabled={!input.trim() || submitting || timeUp}
          className="mt-3 w-full rounded-lg bg-brand px-4 py-2 text-sm font-bold text-on-brand disabled:opacity-50"
        >
          {timeUp ? 'Time is up' : submitting ? 'Grading…' : 'Submit'}
        </button>
      </div>
    </div>
  );
}

/**
 * Draws the question's picture.
 *
 * Every branch also renders its own text equivalent, and not as an afterthought: "visual questions"
 * must not mean "inaccessible questions". The table branch draws a real `<table>` with a `<caption>`,
 * the SQL branch draws the statements in a `role="group"` with the caption as its label, and the heap
 * branch reads as a list of rows with their visibility marked in words. A screen reader gets the same
 * facts, in the same order, because both come from the same object — the bank stores one `stimulus`
 * and this renders it two ways, so the two cannot disagree.
 */
function StimulusView({ stimulus }: { stimulus: Stimulus }) {
  if (stimulus.kind === 'table') {
    return (
      <div className="px-4 py-3">
        <p className="mb-2 font-mono text-xs text-muted">{stimulus.caption}</p>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{stimulus.caption}</caption>
            <thead className="bg-bg">
              <tr>
                {stimulus.columns.map((c) => (
                  <th key={c} className="px-3 py-1.5 font-mono text-xs font-bold text-muted">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stimulus.rows.map((row, i) => (
                <tr key={i} className="border-t border-line">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-1.5 font-mono">{cell === null ? <Null /> : cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (stimulus.kind === 'sql') {
    return (
      <div className="px-4 py-3" role="group" aria-label={stimulus.caption}>
        <p className="mb-2 text-xs text-muted">{stimulus.caption}</p>
        <pre className="overflow-x-auto rounded-lg bg-code-bg px-3 py-2 font-mono text-xs leading-relaxed text-code-text">
          {stimulus.lines.join('\n')}
        </pre>
      </div>
    );
  }

  return (
    <div className="px-4 py-3" role="group" aria-label={stimulus.caption}>
      <p className="mb-2 text-xs text-muted">{stimulus.caption}</p>
      <ul className="space-y-1">
        {stimulus.rows.map((r) => (
          <li key={r.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 font-mono text-xs">
            <span className="font-bold">{r.id}</span>
            <span className="text-muted">visible to {r.visibleTo}</span>
            <span className="ml-auto">{r.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Null() {
  return <span className="italic text-muted">NULL</span>;
}

function Notice({ tone, children }: { tone: 'bad' | 'muted'; children: ReactNode }) {
  return (
    <p className={clsx('rounded-xl border px-4 py-3 text-sm', tone === 'bad' ? 'border-bad bg-bad-soft text-bad' : 'border-line text-muted')}>
      {children}
    </p>
  );
}

// ── Result card ─────────────────────────────────────────────────────────────

type AnswerCard = { questionId: string; answerSql: string; explanation: string };

/**
 * The immediate verdict.
 *
 * Deliberately has no "next" button. The server owns the clock — it advances on its own and the poll
 * picks the new question up within 3 s — so a button here would be a fake affordance for something the
 * player cannot actually control. Worse, clearing this card locally would re-render the question that
 * was just answered with an empty editor, inviting a resubmit the server refuses anyway ("first answer
 * wins"). The honest UI says what is true: answered, and waiting on the clock.
 */
function ResultCard({
  result, showCard, secondsLeft,
}: {
  result: { correct: boolean; score: number; detail?: string; card?: AnswerCard }; showCard: boolean;
  secondsLeft: number;
}) {
  return (
    <div className={clsx('rounded-xl border p-4 shadow-card', result.correct ? 'border-good bg-good-soft' : 'border-bad bg-bad-soft')}>
      <p className={clsx('text-lg font-bold', result.correct ? 'text-good' : 'text-bad')}>
        {result.correct ? `+${result.score} pts` : 'No points'}
      </p>
      {result.detail && <p className="mt-1 text-sm text-muted">{result.detail}</p>}
      {showCard && result.card && (
        <div className="mt-3 rounded-lg border border-line bg-surface p-3">
          <p className="mb-1 text-xs font-bold text-muted">Reference answer</p>
          <pre className="overflow-x-auto text-xs text-text">{result.card.answerSql}</pre>
          <p className="mt-2 text-xs text-muted">{result.card.explanation}</p>
        </div>
      )}
      <p className="mt-3 text-center text-xs text-muted">
        {secondsLeft > 0 ? `Answered — next question in ${secondsLeft}s` : 'Answered — moving on…'}
      </p>
    </div>
  );
}

// ── Leaderboard ─────────────────────────────────────────────────────────────

function Leaderboard({ board, title }: { board: LeaderboardEntry[]; title: string }) {
  if (!board.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface shadow-card">
      <div className="border-b border-line px-4 py-3">
        <p className="text-sm font-bold">{title}</p>
      </div>
      <div className="divide-y divide-line">
        {board.slice(0, 20).map((e) => (
          <div key={e.participantId} className="flex items-center gap-3 px-4 py-2.5">
            <span className={clsx('w-6 text-center text-sm font-bold tabular-nums', e.rank === 1 ? 'text-good' : e.rank === 2 ? 'text-muted' : e.rank === 3 ? 'text-warn' : 'text-muted')}>
              {e.rank}
            </span>
            <span className="flex-1 truncate text-sm font-medium">{e.displayName}</span>
            <span className="text-sm font-bold tabular-nums text-brand">{e.totalScore}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
