import type { Metadata } from 'next';
import { ExamSetup } from '@/components/exam/ExamSetup';

export const metadata: Metadata = {
  title: 'Exam',
  description: 'Host a timed, visual SQL exam. Everyone gets their own random paper; the leaderboard updates live.',
};

export default function ExamPage() {
  return <ExamSetup />;
}
