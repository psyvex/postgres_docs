'use client';

import { BookOpen, Lightbulb } from 'lucide-react';
import { lessons } from '@/config/lessons';
import { useLabStore } from '@/lib/store';

export function LessonPanel() {
  const lab = useLabStore((state) => state.activeLab);
  const lesson = lessons[lab];
  return <div className="glass rounded-2xl p-5"><div className="flex items-center gap-2 text-sm font-semibold"><BookOpen size={15} className="text-cyan-300"/> Session guide</div><p className="mt-3 text-xs leading-5 text-slate-300">{lesson.goal}</p><div className="mt-4 flex flex-wrap gap-2">{lesson.concepts.map((concept) => <span key={concept} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[10px] text-slate-400">{concept}</span>)}</div><div className="mt-4 space-y-2">{lesson.talkingPoints.map((point) => <div key={point} className="flex gap-2 rounded-lg bg-white/[.02] p-3 text-[11px] leading-5 text-slate-400"><Lightbulb size={13} className="mt-0.5 shrink-0 text-amber-300"/>{point}</div>)}</div></div>;
}
