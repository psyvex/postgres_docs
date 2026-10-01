import { NextResponse } from 'next/server';
import { createExam } from '@/lib/exam/server/store';
import { eligibleCount } from '@/lib/exam/paper';
import { EXAM_BANK } from '@/content/exam-bank';
import type { ExamSettings } from '@/lib/exam/types';

export const runtime = 'nodejs';

/** POST /api/exam/create — creates an exam and returns the code and a host token. */
export async function POST(request: Request) {
  let body: Partial<ExamSettings>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const settings: ExamSettings = {
    title: String(body.title ?? 'Postgres Exam').trim().slice(0, 80),
    topicSlugs: Array.isArray(body.topicSlugs) ? body.topicSlugs.filter((s) => typeof s === 'string') : [],
    count: Math.max(1, Math.min(50, Number(body.count) || 10)),
    difficulty: ['easy', 'medium', 'hard', 'all'].includes(body.difficulty ?? '') ? (body.difficulty as ExamSettings['difficulty']) : 'all',
    perQuestionSeconds: Math.max(10, Math.min(300, Number(body.perQuestionSeconds) || 60)),
    totalSeconds: Math.max(60, Math.min(7200, Number(body.totalSeconds) || 600)),
    startTrigger: typeof body.startTrigger === 'string' && body.startTrigger !== 'host' ? body.startTrigger : 'host',
    showLeaderboard: Boolean(body.showLeaderboard ?? true),
    allowLateJoin: Boolean(body.allowLateJoin ?? true),
    showAnswerCard: Boolean(body.showAnswerCard ?? true),
    timeBonus: Boolean(body.timeBonus ?? false),
    tiebreaker: ['time', 'accuracy'].includes(body.tiebreaker ?? '') ? (body.tiebreaker as ExamSettings['tiebreaker']) : 'time',
  };

  if (settings.topicSlugs.length === 0) {
    return NextResponse.json({ error: 'at least one topic is required' }, { status: 400 });
  }

  const eligible = eligibleCount(EXAM_BANK, { topicSlugs: settings.topicSlugs, difficulty: settings.difficulty });
  if (eligible === 0) {
    return NextResponse.json({ error: 'no questions available for the selected topics' }, { status: 400 });
  }

  if (settings.count > eligible) {
    settings.count = eligible;
  }

  const { exam, hostToken } = createExam(settings);

  const response = NextResponse.json({
    code: exam.code,
    count: exam.questionIds.length,
    maxCount: eligible,
  });

  // The host token is set as a cookie so only the creating browser can issue host commands.
  response.cookies.set('exam-host', hostToken, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 2, // 2 hours
    path: '/',
  });

  return response;
}
