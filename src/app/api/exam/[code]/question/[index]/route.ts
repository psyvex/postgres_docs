import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { advanceIfDue, findSubmission, getExam, paperFor, recordSubmission } from '@/lib/exam/server/store';
import { gradeSubmission } from '@/lib/exam/server/grader';
import { countStatements } from '@/lib/exam/server/db';
import { EXAM_BANK } from '@/content/exam-bank';
import { questionDeadline, questionOpensAt, type SerialisedQuestion } from '@/lib/exam/types';

export const runtime = 'nodejs';

const byId = new Map(EXAM_BANK.map((q) => [q.id, q]));

/**
 * Strips everything that would give the answer away. The oracle and the reference SQL stay on the
 * server; the answer card is delivered separately, only after the question closes.
 */
function serialise(questionId: string, index: number, timeSeconds: number): SerialisedQuestion | null {
  const q = byId.get(questionId);
  if (!q) return null;
  return {
    id: q.id,
    index,
    topicSlug: q.topicSlug,
    difficulty: q.difficulty,
    prompt: q.prompt,
    stimulus: q.stimulus,
    persona: q.persona.name,
    points: q.points,
    timeSeconds,
  };
}

/**
 * Statements that would break the grading transaction if a participant submitted them.
 *
 * Each answer is graded inside a transaction that is always rolled back, which is what keeps one
 * participant's `DELETE FROM tasks` from changing the database for the next person. A participant who
 * submits `COMMIT` would end that transaction early and make their writes permanent — poisoning the
 * shared database for every subsequent answer. `BEGIN` nests (Postgres warns and ignores) but
 * `COMMIT`/`END` are fatal, so all transaction control is refused.
 */
const FORBIDDEN = /\b(begin|commit|end|rollback|savepoint|start\s+transaction)\b/i;

/** GET — the question at `index` on *this participant's* paper. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string; index: string }> },
) {
  const { code, index: rawIndex } = await params;
  const index = Number(rawIndex);
  const participantId = (await cookies()).get('exam-participant')?.value;

  const exam = getExam(code);
  if (!exam) return NextResponse.json({ error: 'exam not found' }, { status: 404 });
  if (!Number.isInteger(index) || index < 0) return NextResponse.json({ error: 'bad index' }, { status: 400 });

  advanceIfDue(exam);
  if (exam.status === 'created' || exam.status === 'waiting') {
    return NextResponse.json({ error: 'exam has not started', status: exam.status }, { status: 425 });
  }
  if (exam.status === 'finished') return NextResponse.json({ error: 'exam finished' }, { status: 410 });
  if (!participantId || !exam.participants[participantId]) return NextResponse.json({ error: 'join first' }, { status: 403 });

  const paper = paperFor(exam, participantId);
  if (index >= paper.length) return NextResponse.json({ error: 'no such question' }, { status: 404 });

  const question = serialise(paper[index], index, exam.settings.perQuestionSeconds);
  if (!question) return NextResponse.json({ error: 'question missing from bank' }, { status: 500 });

  const deadline = questionDeadline(exam.startedAt!, index, exam.settings.perQuestionSeconds);
  return NextResponse.json({
    question,
    // The server's own deadline, so a client renders a countdown from the same authority that grades
    // lateness. A reload cannot buy time, because the number is absolute, not a fresh per-question span.
    deadline,
    serverNow: Date.now(),
    finished: index >= exam.currentQuestionIndex + 1,
  });
}

/** POST — grade this participant's answer to question `index`. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string; index: string }> },
) {
  const { code, index: rawIndex } = await params;
  const index = Number(rawIndex);
  const participantId = (await cookies()).get('exam-participant')?.value;

  const exam = getExam(code);
  if (!exam) return NextResponse.json({ error: 'exam not found' }, { status: 404 });
  if (!participantId || !exam.participants[participantId]) return NextResponse.json({ error: 'join first' }, { status: 403 });
  if (!Number.isInteger(index) || index < 0) return NextResponse.json({ error: 'bad index' }, { status: 400 });

  const now = Date.now();
  advanceIfDue(exam, now);
  if (exam.status !== 'active') return NextResponse.json({ error: 'exam is not running' }, { status: 409 });

  const paper = paperFor(exam, participantId);
  const questionId = paper[index];
  if (!questionId) return NextResponse.json({ error: 'no such question' }, { status: 404 });

  const question = byId.get(questionId);
  if (!question) return NextResponse.json({ error: 'question missing from bank' }, { status: 500 });

  // Already answered: replay the recorded verdict rather than grading again. Grading a second time
  // would return a response the leaderboard ignores — and every fresh `detail` is another look at the
  // oracle, which is how "one answer" quietly becomes unlimited attempts.
  const prior = findSubmission(exam, participantId, questionId);
  if (prior) {
    return NextResponse.json({
      correct: prior.correct,
      score: prior.score,
      detail: prior.correct ? undefined : prior.detail,
      duplicate: true,
      ...(exam.settings.showAnswerCard ? { card: { questionId, answerSql: question.answerSql, explanation: question.explanation } } : {}),
    });
  }

  // Grading is against the question on *this* participant's paper. A submission naming some other
  // question id is not honoured, so nobody can shop for an easier item.
  const { sql } = (await request.json().catch(() => ({ sql: '' }))) as { sql?: unknown };
  const answer = typeof sql === 'string' ? sql.trim() : '';
  if (!answer) return NextResponse.json({ error: 'no answer submitted' }, { status: 400 });
  if (answer.length > 4000) return NextResponse.json({ error: 'answer too long' }, { status: 413 });
  if (FORBIDDEN.test(answer)) return NextResponse.json({ error: 'transaction control is not allowed in an answer' }, { status: 400 });
  if (countStatements(answer) > 3) return NextResponse.json({ error: 'answer must be one statement' }, { status: 400 });

  const deadline = questionDeadline(exam.startedAt!, index, exam.settings.perQuestionSeconds);
  if (now > deadline) return NextResponse.json({ error: 'time is up for this question' }, { status: 408 });

  // Measured here, not taken from the browser: a client-reported duration is a client's opinion.
  const openAt = questionOpensAt(exam.startedAt!, index, exam.settings.perQuestionSeconds);
  const timeMs = Math.min(Math.max(0, now - openAt), exam.settings.perQuestionSeconds * 1000);

  const graded = await gradeSubmission({
    question,
    sql: answer,
    timeMs,
    timeSeconds: exam.settings.perQuestionSeconds,
    timeBonus: exam.settings.timeBonus,
  });

  recordSubmission(exam, participantId, {
    questionId,
    sql: answer,
    submittedAt: now,
    timeMs,
    correct: graded.correct,
    score: graded.score,
    detail: graded.detail,
  });

  return NextResponse.json({
    correct: graded.correct,
    score: graded.score,
    // Only this participant sees why they failed; the leaderboard broadcasts the fact, not the reason.
    detail: graded.correct ? undefined : graded.detail,
    ...(exam.settings.showAnswerCard ? { card: { questionId, answerSql: question.answerSql, explanation: question.explanation } } : {}),
  });
}
