import type { Check } from '@/lib/learn/check';

/**
 * Types shared by the exam bank, the server grader and the exam UI. Nothing here may import
 * `server-only` or PGlite — the browser builds the same shapes from API responses.
 */

export type ExamStatus = 'created' | 'waiting' | 'active' | 'finished';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type DifficultyFilter = Difficulty | 'all';
export type StartTrigger = 'host' | string; // 'host' or an ISO datetime
export type Tiebreaker = 'time' | 'accuracy';

/** A question as authored. `answerSql` is the reference answer, never sent to a participant. */
export type ExamQuestion = {
  id: string;
  topicSlug: string;
  difficulty: Difficulty;
  /** What the participant reads. The visual stimulus is rendered from `stimulus`. */
  prompt: string;
  /** How the picture is produced. See `Stimulus` below. */
  stimulus: Stimulus;
  /** Runs before the participant's SQL, in the same session. Sets up the scenario. */
  setupSql: string;
  /** Persona the answer is executed as — same five identities the lessons use. */
  persona: Persona;
  /** The oracle. Graded by the lesson grader, unchanged. */
  checks: Check[];
  /** Reference answer, shown on the answer card once the question closes. */
  answerSql: string;
  explanation: string;
  points: number;
};

/**
 * The five identities lesson blocks run as. Mirrors `PERSONAS` in `scripts/verify-lessons.mjs`.
 */
export type PersonaName = 'owner' | 'alice' | 'bob' | 'carol' | 'anon';

export type Persona = {
  name: PersonaName;
  role?: string;
  memberId?: number;
  orgId?: number;
};

/**
 * How the participant is shown the scenario.
 *
 * The lesson explainers take zero props and own their animation state, so the exam cannot embed
 * one and freeze it at a chosen stage. Instead every question carries the data the picture is
 * drawn from — the same row the oracle was computed from, which is what keeps the picture and the
 * correct answer from ever disagreeing.
 *
 * `transcript` is not an alternative presentation, it is the same data: screen readers get a
 * table where sighted participants get the diagram, and nothing is lost by the substitution.
 */
export type Stimulus =
  /** A result table to display, e.g. the rows a session can see. */
  | { kind: 'table'; caption: string; columns: string[]; rows: (string | number | null)[][] }
  /** An excerpt of the scenario's SQL, e.g. the transaction both sessions ran. */
  | { kind: 'sql'; caption: string; lines: string[] }
  /** The rows as they physically sit in the table, with visibility marked per row. */
  | { kind: 'heap'; caption: string; rows: { id: string; visibleTo: string; detail: string }[] };

/** What the API hands a participant mid-exam. No oracle, no reference answer. */
export type SerialisedQuestion = {
  id: string;
  index: number;
  topicSlug: string;
  difficulty: Difficulty;
  prompt: string;
  stimulus: Stimulus;
  persona: PersonaName;
  points: number;
  timeSeconds: number;
};

export type AnswerCard = {
  questionId: string;
  answerSql: string;
  explanation: string;
};

export type ExamSettings = {
  title: string;
  topicSlugs: string[];
  count: number;
  difficulty: DifficultyFilter;
  perQuestionSeconds: number;
  /** Hard ceiling on total exam length. The exam ends at whichever bound comes first. */
  totalSeconds: number;
  startTrigger: StartTrigger;
  showLeaderboard: boolean;
  allowLateJoin: boolean;
  showAnswerCard: boolean;
  timeBonus: boolean;
  tiebreaker: Tiebreaker;
};

export type Submission = {
  questionId: string;
  sql: string;
  submittedAt: number;
  /** Server-measured milliseconds from question open to submit. */
  timeMs: number;
  correct: boolean;
  score: number;
  /** Why a wrong answer was wrong — from `Grade.failures`. Shown to the participant only. */
  detail?: string;
};

export type Participant = {
  id: string;
  displayName: string;
  joinedAt: number;
  finishedAt: number | null;
  submissions: Record<string, Submission>;
  totalScore: number;
  totalTimeMs: number;
  wrongCount: number;
};

export type LeaderboardEntry = {
  rank: number;
  participantId: string;
  displayName: string;
  totalScore: number;
  answered: number;
  wrongCount: number;
  /** Per-question score, keyed by question id — lets the UI draw a strip of results. */
  byQuestion: Record<string, number>;
};

export type Exam = {
  code: string;
  status: ExamStatus;
  hostToken: string;
  settings: ExamSettings;
  /** Derived from `settings` + a stored seed, so the server can re-verify any claim about paper. */
  paperSeed: number;
  questionIds: string[];
  createdAt: number;
  startsAt: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  /** Index into `questionIds`. Advanced by the timer, never by a client. */
  currentQuestionIndex: number;
  /** Question the participant currently owes an answer for, or null between questions. */
  openSince: number | null;
  participants: Record<string, Participant>;
};

export type SSEEvent =
  | { type: 'joined'; count: number }
  | { type: 'started'; startsAt: number; totalSeconds: number }
  | { type: 'question'; index: number; question: SerialisedQuestion; deadline: number }
  | { type: 'answer'; participantId: string; displayName: string; correct: boolean; score: number }
  | { type: 'leaderboard'; entries: LeaderboardEntry[] }
  | { type: 'card'; index: number; card: AnswerCard }
  | { type: 'finished'; finalBoard: LeaderboardEntry[] };

/**
 * When question `i` closes, as an absolute timestamp.
 *
 * Question 0 closes one window after the start, not *at* the start — which is the whole reason this
 * adds `i + 1`. A version that added `i` would name the moment a question opens, and every caller
 * (the scheduler that advances, the countdown that ticks, the grader that refuses a late answer) reads
 * this as a closing time; under that off-by-one the first question would be past its deadline the
 * instant the exam began, and its countdown would read zero.
 */
export function questionDeadline(startedAt: number, i: number, perQuestionSeconds: number): number {
  return startedAt + (i + 1) * perQuestionSeconds * 1000;
}

/** When question `i` opens. `deadline(i - 1)` for any `i > 0`, stated directly so nobody re-derives it. */
export function questionOpensAt(startedAt: number, i: number, perQuestionSeconds: number): number {
  return startedAt + i * perQuestionSeconds * 1000;
}

/**
 * The exam ends at whichever bound arrives first: the pace the host set, or the total ceiling.
 * Stating this once keeps the server scheduler and every client countdown agreeing.
 */
export function examEndsAt(startedAt: number, settings: ExamSettings, count: number): number {
  const byPace = startedAt + count * settings.perQuestionSeconds * 1000;
  const byCeiling = startedAt + settings.totalSeconds * 1000;
  return Math.min(byPace, byCeiling);
}

/**
 * How many questions actually fit inside the total ceiling. Asking for 30 questions at 60s each
 * inside a 10-minute exam is a valid host choice; the honest answer is 10 questions.
 */
export function questionsThatFit(
  settings: Pick<ExamSettings, 'count' | 'totalSeconds' | 'perQuestionSeconds'>,
): number {
  return Math.max(1, Math.min(settings.count, Math.floor(settings.totalSeconds / settings.perQuestionSeconds)));
}
