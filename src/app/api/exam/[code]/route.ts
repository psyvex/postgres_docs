import { NextResponse } from 'next/server';
import { getExam } from '@/lib/exam/server/store';

export const runtime = 'nodejs';

/** GET /api/exam/[code] — returns exam metadata and participant count. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const exam = getExam(code);
  if (!exam) return NextResponse.json({ error: 'exam not found' }, { status: 404 });

  return NextResponse.json({
    code: exam.code,
    status: exam.status,
    questionCount: exam.questionIds.length,
    participantCount: Object.keys(exam.participants).length,
    settings: {
      title: exam.settings.title,
      topicSlugs: exam.settings.topicSlugs,
      difficulty: exam.settings.difficulty,
      perQuestionSeconds: exam.settings.perQuestionSeconds,
      totalSeconds: exam.settings.totalSeconds,
      startTrigger: exam.settings.startTrigger,
      showLeaderboard: exam.settings.showLeaderboard,
      showAnswerCard: exam.settings.showAnswerCard,
      timeBonus: exam.settings.timeBonus,
    },
  });
}
