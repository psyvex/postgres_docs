import 'server-only';
import { examEndsAt, questionDeadline, questionOpensAt, questionsThatFit, type Exam, type ExamSettings, type LeaderboardEntry, type Participant, type Submission } from '@/lib/exam/types';
import { generatePaper, newPaperSeed, paperSeedFor } from '@/lib/exam/paper';
import { EXAM_BANK } from '@/content/exam-bank';

/**
 * The exam store.
 *
 * An in-process Map. Not a database.
 *
 * On a single self-hosted Node server — which is what this project targets — this is correct and
 * adequate for a 50-person workshop. On a lambda host where "Route Handlers cannot share data between
 * requests", each cold-start creates a new Map and the exam becomes invisible between two consecutive
 * requests. The `globalThis` guard prevents this from being a problem during dev-server hot reloads,
 * but cannot fix it across processes. A production deployment that needs multi-instance needs Redis.
 *
 * What's stored: one Exam object per active code, keyed by code. Expired exams are swept lazily when
 * a request touches them — not by a timer, because a timer that runs after a route handler exits is
 * a lambda timeout.
 *
 * Timing: `currentQuestionIndex` is never set by a client. It advances when any request handler calls
 * `advanceIfDue()`, which compares `Date.now()` against the absolute deadline derived from
 * `examStartsAt + i * perQuestionMs`. That arithmetic is in `types.ts`; the store reads it, not
 * re-implements it, so the server and every client countdown agree on exactly the same deadline.
 */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const EXAM_TTL_MS = 60 * 60 * 1000; // exams expire 1 hour after finish

function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** Generates a code, retrying up to 8 times to avoid an existing exam. */
function uniqueCode(store: Map<string, Exam>): string {
  for (let i = 0; i < 8; i++) {
    const code = generateCode();
    if (!store.has(code)) return code;
  }
  throw new Error('could not generate a unique exam code after 8 attempts');
}

function newParticipantId(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** A token the host stores as a cookie so only their browser can issue host commands. */
function newHostToken(): string {
  const b = new Uint32Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(36)).join('');
}

// ── Store ─────────────────────────────────────────────────────────────────────

const store = globalThis as typeof globalThis & { __examStore?: Map<string, Exam> };

function getMap(): Map<string, Exam> {
  store.__examStore ??= new Map();
  return store.__examStore;
}

/**
 * Removes finished exams that are older than the TTL. Called before any map read so cleanup does
 * not need a background timer that would be killed by a lambda timeout.
 */
function sweep(now = Date.now()) {
  for (const [code, exam] of getMap()) {
    const expired =
      exam.status === 'finished' && exam.finishedAt !== null && now - exam.finishedAt > EXAM_TTL_MS;
    if (expired) getMap().delete(code);
  }
}

// ── Create / Read ─────────────────────────────────────────────────────────────

export function createExam(settings: ExamSettings): { exam: Exam; hostToken: string } {
  sweep();
  const map = getMap();
  const hostToken = newHostToken();
  const code = uniqueCode(map);

  // Derive the paper from the settings, capping the count to what the total time ceiling allows.
  const cappedSettings: ExamSettings = { ...settings, count: questionsThatFit(settings) };
  const paperSeed = newPaperSeed();
  const questionIds = generatePaper(EXAM_BANK, cappedSettings, paperSeed);

  const exam: Exam = {
    code,
    status: settings.startTrigger === 'host' ? 'created' : 'waiting',
    hostToken,
    settings: cappedSettings,
    paperSeed,
    questionIds,
    createdAt: Date.now(),
    startsAt: settings.startTrigger === 'host' ? null : new Date(settings.startTrigger).getTime(),
    startedAt: null,
    finishedAt: null,
    currentQuestionIndex: -1,
    openSince: null,
    participants: {},
  };

  map.set(code, exam);
  return { exam, hostToken };
}

/** Returns the exam or undefined. Sweeps before reading. */
export function getExam(code: string): Exam | undefined {
  sweep();
  return getMap().get(code.toUpperCase().trim());
}

/**
 * A participant's paper — derived, never stored.
 *
 * Every participant in an exam is dealt a different set of questions, which is the whole point of the
 * feature: sitting next to someone should tell you nothing. It costs no storage and no state sync,
 * because the paper is a pure function of the exam's seed and the participant's id.
 *
 * Two properties are load-bearing here and both fall out of the derivation being pure:
 *
 * - **A reload cannot reshuffle.** A participant who refreshes, or whose connection drops mid-exam,
 *   gets the same paper they started. Anything stored-and-rewritten would risk dealing a new set.
 * - **The server can check a claim.** "Question 9 of my paper was unfair" is answerable by
 *   re-deriving that participant's paper and reading index 9, rather than trusting what the client
 *   says it was shown.
 *
 * `exam.questionIds` is kept alongside as a representative paper: every paper in an exam has the same
 * length and difficulty mix by construction, so timers and the host's progress display can reason
 * about *length* from it while the *content* comes from here.
 */
export function paperFor(exam: Exam, participantId: string): string[] {
  return generatePaper(EXAM_BANK, exam.settings, paperSeedFor(exam.paperSeed, participantId));
}

// ── Join ──────────────────────────────────────────────────────────────────────

export function joinExam(code: string, displayName: string): Participant | { error: string } {
  const exam = getExam(code);
  if (!exam) return { error: 'exam not found' };
  if (exam.status === 'finished') return { error: 'exam has already finished' };
  if (exam.status === 'active' && !exam.settings.allowLateJoin) return { error: 'late join is disabled' };

  const participant: Participant = {
    id: newParticipantId(),
    displayName: displayName.trim() || 'Participant',
    joinedAt: Date.now(),
    finishedAt: null,
    submissions: {},
    totalScore: 0,
    totalTimeMs: 0,
    wrongCount: 0,
  };
  exam.participants[participant.id] = participant;

  if (exam.status === 'created') exam.status = 'waiting';
  return participant;
}

// ── Start ─────────────────────────────────────────────────────────────────────

/** Host presses Start (or the scheduled time is reached on the first request after it). */
export function startExam(exam: Exam): void {
  if (exam.status === 'active' || exam.status === 'finished') return;
  exam.startedAt = Date.now();
  exam.currentQuestionIndex = 0;
  exam.openSince = exam.startedAt;
  exam.status = 'active';
}

// ── Timer advance ─────────────────────────────────────────────────────────────

/**
 * Advances `currentQuestionIndex` if the current question's deadline has passed, and finishes the
 * exam if its total end time has been reached. Idempotent: calling it repeatedly is safe and
 * produces no additional effect once the state has caught up with the clock.
 *
 * Called at the top of every request handler that reads exam state, so the transition happens the
 * moment any participant makes a request after the deadline. On a lambda host there is no persistent
 * timer, so this pull-based advance is the design, not a fallback.
 */
export function advanceIfDue(exam: Exam, now = Date.now()): { advanced: boolean; finished: boolean } {
  if (exam.status !== 'active' || exam.startedAt === null) return { advanced: false, finished: false };

  const endsAt = examEndsAt(exam.startedAt, exam.settings, exam.questionIds.length);
  if (now >= endsAt) {
    finishExam(exam, now);
    return { advanced: true, finished: true };
  }

  const currentDeadline = questionDeadline(exam.startedAt, exam.currentQuestionIndex, exam.settings.perQuestionSeconds);
  if (now < currentDeadline) return { advanced: false, finished: false };

  // Advance to the question whose deadline has not yet passed, skipping questions that time has
  // blown past while no request was in flight (e.g. a lambda cold-start).
  const nextIndex = exam.questionIds.findIndex(
    (_, i) => i > exam.currentQuestionIndex && now < questionDeadline(exam.startedAt!, i, exam.settings.perQuestionSeconds),
  );
  const targetIndex = nextIndex >= 0 ? nextIndex : exam.questionIds.length;

  if (targetIndex >= exam.questionIds.length) {
    finishExam(exam, now);
    return { advanced: true, finished: true };
  }

  exam.currentQuestionIndex = targetIndex;
  exam.openSince = questionOpensAt(exam.startedAt, targetIndex, exam.settings.perQuestionSeconds);
  return { advanced: true, finished: false };
}

// ── Submission ────────────────────────────────────────────────────────────────

export function recordSubmission(exam: Exam, participantId: string, sub: Submission): void {
  const p = exam.participants[participantId];
  if (!p) return;
  // First answer wins. A participant may reconnect and see the question again, but they do not get a
  // second attempt: with retrying, an exam becomes an oracle — submit, read the failure detail, adjust,
  // repeat, until something passes. The route replays the recorded verdict instead of grading twice,
  // so this is also the reason a duplicate costs nothing.
  if (p.submissions[sub.questionId]) return;
  p.submissions[sub.questionId] = sub;
  p.totalScore += sub.score;
  p.totalTimeMs += sub.timeMs;
  if (!sub.correct) p.wrongCount += 1;
}

/**
 * The answer already on record for this participant and question, if there is one.
 *
 * Read by the POST handler before it spends a database round-trip grading an answer that would be
 * discarded anyway.
 */
export function findSubmission(exam: Exam, participantId: string, questionId: string): Submission | undefined {
  return exam.participants[participantId]?.submissions[questionId];
}

// ── Finish ────────────────────────────────────────────────────────────────────

export function finishExam(exam: Exam, now = Date.now()): void {
  if (exam.status === 'finished') return;
  exam.status = 'finished';
  exam.finishedAt = now;
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

/**
 * Builds the leaderboard from current state. Sorted by totalScore then the tiebreaker.
 * Called on every state read so the host and participants see the same list.
 */
export function buildLeaderboard(exam: Exam): LeaderboardEntry[] {
  const entries = Object.values(exam.participants).map((p): LeaderboardEntry => ({
    rank: 0,
    participantId: p.id,
    displayName: p.displayName,
    totalScore: p.totalScore,
    answered: Object.keys(p.submissions).filter((id) => p.submissions[id].correct).length,
    wrongCount: p.wrongCount,
    byQuestion: Object.fromEntries(Object.entries(p.submissions).map(([id, s]) => [id, s.score])),
  }));

  const { tiebreaker } = exam.settings;
  entries.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (tiebreaker === 'accuracy') return a.wrongCount - b.wrongCount;
    const aTotal = exam.participants[a.participantId]?.totalTimeMs ?? Infinity;
    const bTotal = exam.participants[b.participantId]?.totalTimeMs ?? Infinity;
    return aTotal - bTotal;
  });

  return entries.map((e, i) => ({ ...e, rank: i + 1 }));
}

/** The host's participant ID is their session token — used to gate host-only API calls. */
export function isHost(exam: Exam, hostToken: string | null): boolean {
  return Boolean(hostToken) && exam.hostToken === hostToken;
}
