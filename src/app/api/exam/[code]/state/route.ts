import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { advanceIfDue, buildLeaderboard, getExam, isHost, paperFor } from '@/lib/exam/server/store';
import { examEndsAt, questionDeadline } from '@/lib/exam/types';

export const runtime = 'nodejs';

/**
 * GET /api/exam/[code]/state — everything a client needs to render one frame of the exam.
 *
 * Polling this endpoint, rather than depending on a pushed event to arrive, is what makes the exam
 * survive a host that recycles handlers: "Route Handlers cannot share data between requests" and
 * "Long-running handlers may be terminated due to timeouts" (Next.js bundled BFF guide). Correctness
 * comes from reading state, so a lost notification costs a delayed update rather than a wrong board.
 *
 * `deadline` and `serverNow` are both returned so the client can render a countdown from server time
 * without trusting its own clock, and without being able to lengthen it.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const jar = await cookies();
  const participantId = jar.get('exam-participant')?.value;
  const hostToken = jar.get('exam-host')?.value ?? null;

  const exam = getExam(code);
  if (!exam) return NextResponse.json({ error: 'exam not found' }, { status: 404 });

  const now = Date.now();
  advanceIfDue(exam, now);

  const host = isHost(exam, hostToken);
  const started = exam.startedAt !== null;
  const index = exam.currentQuestionIndex;
  const count = exam.questionIds.length;

  const board = buildLeaderboard(exam);
  const me = participantId ? exam.participants[participantId] : undefined;
  const paper = participantId ? paperFor(exam, participantId) : [];

  return NextResponse.json({
    code: exam.code,
    status: exam.status,
    isHost: host,
    title: exam.settings.title,
    questionCount: count,
    currentIndex: index,
    // Absolute instants; a client derives "seconds left" and can neither gain nor lose time by
    // adjusting its own clock.
    deadline: started && index >= 0 ? questionDeadline(exam.startedAt!, index, exam.settings.perQuestionSeconds) : null,
    endsAt: started ? examEndsAt(exam.startedAt!, exam.settings, count) : null,
    startsAt: exam.startsAt,
    serverNow: now,
    participantCount: Object.keys(exam.participants).length,
    perQuestionSeconds: exam.settings.perQuestionSeconds,
    showLeaderboard: exam.settings.showLeaderboard,
    showAnswerCard: exam.settings.showAnswerCard,
    timeBonus: exam.settings.timeBonus,
    // A participant sees their own paper's question ids so they can tell which ones they answered;
    // ids carry no answer information.
    paper,
    leaderboard: exam.settings.showLeaderboard || host ? board : [],
    me: me
      ? {
          id: me.id,
          displayName: me.displayName,
          totalScore: me.totalScore,
          wrongCount: me.wrongCount,
          answered: Object.keys(me.submissions),
          rank: board.find((e) => e.participantId === me.id)?.rank ?? null,
        }
      : null,
  });
}
