import { NextResponse } from 'next/server';
import { joinExam } from '@/lib/exam/server/store';

export const runtime = 'nodejs';

/** POST /api/exam/[code]/join — registers a participant, returns their id. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  let body: { displayName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const result = joinExam(code, String(body.displayName ?? ''));

  if ('error' in result) return NextResponse.json(result, { status: 400 });

  const response = NextResponse.json({ participantId: result.id, displayName: result.displayName });
  response.cookies.set('exam-participant', result.id, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 2,
    path: '/',
  });
  return response;
}
