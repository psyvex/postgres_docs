import { getExam, advanceIfDue, buildLeaderboard } from '@/lib/exam/server/store';
import { questionDeadline } from '@/lib/exam/types';

export const runtime = 'nodejs';

/** How often the stream re-reads state and emits a frame if anything changed. */
const TICK_MS = 1000;
const MAX_STREAM_MS = 2 * 60 * 60 * 1000;

/**
 * GET /api/exam/[code]/stream — server-sent events for the exam.
 *
 * This is an *enhancement*, not the source of truth. The next line of the bundled BFF guide is the
 * reason: "Long-running handlers may be terminated due to timeouts" and "WebSockets won't work because
 * the connection closes on timeout, or after the response is generated." SSE survives where a
 * WebSocket cannot, but it is still a long-running handler, and it is still per-instance — on a
 * multi-instance host a stream only sees requests that landed on its own instance.
 *
 * So the stream carries frames of the same state the polling endpoint returns, tagged with a revision
 * the client can reconcile against. If an event is lost, the client's next poll fixes it. Nothing in
 * the exam depends on delivery.
 *
 * Each tick re-reads state rather than being told about changes, because there is no process here that
 * can persistently own a timer — the handler exists only while a request is in flight.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const encoder = new TextEncoder();

  // Rejected here so a client that never reads cannot pin an instance open for the full window.
  const streamStartedAt = Date.now();
  let lastFrame = '';

  const stream = new ReadableStream({
    async start(controller) {
      const timer = setInterval(() => {
        if (request.signal.aborted || Date.now() - streamStartedAt > MAX_STREAM_MS) {
          clearInterval(timer);
          controller.close();
          return;
        }

        const exam = getExam(code);
        if (!exam) {
          controller.enqueue(encoder.encode(`event: gone\ndata: {}\n\n`));
          clearInterval(timer);
          controller.close();
          return;
        }

        const now = Date.now();
        advanceIfDue(exam, now);

        const frame = JSON.stringify({
          status: exam.status,
          currentIndex: exam.currentQuestionIndex,
          participantCount: Object.keys(exam.participants).length,
          deadline: exam.startedAt !== null && exam.currentQuestionIndex >= 0
            ? questionDeadline(exam.startedAt, exam.currentQuestionIndex, exam.settings.perQuestionSeconds)
            : null,
          serverNow: now,
          leaderboard: exam.settings.showLeaderboard ? buildLeaderboard(exam) : null,
        });

        // Emitting only on change keeps a room of 50 open streams from re-serialising identical state
        // every second.
        if (frame !== lastFrame) {
          lastFrame = frame;
          controller.enqueue(encoder.encode(`event: state\ndata: ${frame}\n\n`));
        } else {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        }
      }, TICK_MS);

      request.signal.addEventListener('abort', () => {
        clearInterval(timer);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
