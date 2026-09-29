import { TRANSCRIPTION, transcriptionConfigured } from '@/lib/ai/server';

export const runtime = 'nodejs';

const MAX_BYTES = 15 * 1024 * 1024;

/** Whisper needs a filename with a recognised extension to detect the format. */
function fileNameForMime(mime: string) {
  if (mime.includes('webm')) return 'audio.webm';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'audio.mp4';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'audio.mp3';
  if (mime.includes('wav')) return 'audio.wav';
  if (mime.includes('ogg')) return 'audio.ogg';
  return 'audio.webm';
}

/**
 * Audio → text via a Whisper-compatible endpoint (pattern from the research repo's
 * TranscriptionService). Optional: without TRANSCRIPTION_API_KEY the client falls back to
 * the browser's own speech recognition.
 */
export async function POST(request: Request) {
  if (!transcriptionConfigured()) return Response.json({ error: 'Transcription is not configured.' }, { status: 503 });
  const form = await request.formData();
  const audio = form.get('audio');
  if (!(audio instanceof Blob) || audio.size === 0) return Response.json({ error: 'No audio received.' }, { status: 400 });
  if (audio.size > MAX_BYTES) return Response.json({ error: 'Recording is too long.' }, { status: 413 });

  const upstream = new FormData();
  upstream.append('file', audio, fileNameForMime(audio.type));
  upstream.append('model', TRANSCRIPTION.model());
  const language = form.get('language');
  if (typeof language === 'string' && /^[a-z]{2}$/.test(language)) upstream.append('language', language);

  try {
    const res = await fetch(TRANSCRIPTION.url(), { method: 'POST', headers: { Authorization: `Bearer ${TRANSCRIPTION.key()}` }, body: upstream });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? '').trim();
    if (!text) throw new Error('empty transcript');
    return Response.json({ text });
  } catch (error) {
    console.warn('[transcribe] failed:', error);
    return Response.json({ error: 'Could not transcribe the recording, try again or type instead.' }, { status: 502 });
  }
}
