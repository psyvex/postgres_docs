import type { Metadata } from 'next';
import { ExamRoom } from '@/components/exam/ExamRoom';

export const metadata: Metadata = {
  title: 'Exam room',
  robots: { index: false, follow: false },
};

export default async function ExamRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { code } = await params;
  const { name } = await searchParams;
  // The Join card can only link here — a link cannot POST and receive an httpOnly cookie on the way,
  // so the join itself has to happen in the room. The name arrives as a prop for that.
  return (
    <ExamRoom
      code={code.toUpperCase()}
      initialName={typeof name === 'string' ? name.slice(0, 24) : ''}
    />
  );
}
