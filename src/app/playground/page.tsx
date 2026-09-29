import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Playground } from '@/components/playground/Playground';

export const metadata: Metadata = { title: 'Playground' };

export default function PlaygroundPage() {
  return (
    <Suspense>
      <Playground />
    </Suspense>
  );
}
