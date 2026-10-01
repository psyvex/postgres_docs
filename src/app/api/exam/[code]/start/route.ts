import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getExam, startExam, isHost } from '@/lib/exam/server/store';

export const runtime = 'nodejs';

/** POST /api/exam/[code]/start — host starts the exam. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const hostToken = (await cookies()).get('exam-host')?.value ?? null;
  const exam = getExam(code);

  if (!exam) return NextResponse.json({ error: 'exam not found' }, { status: 404 });
  if (!isHost(exam, hostToken)) return NextResponse.json({ error: 'not the host' }, { status: 403 });

  startExam(exam);
  return NextResponse.json({ startedAt: exam.startedAt });
}
