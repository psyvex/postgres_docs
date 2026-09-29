'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Terminal } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import { Reveal } from './Reveal';

/**
 * Closing call-to-action. Deep navy base (easy on the eyes, strong contrast for white text)
 * with two soft glows drifting slowly, a faint grid and an occasional light sweep.
 */
export function FinalCta({ firstLesson }: { firstLesson: string }) {
  const still = useReducedMotion();
  const drift = (x: string[], y: string[], duration: number) => (still ? {} : { animate: { x, y }, transition: { duration, repeat: Infinity, repeatType: 'mirror' as const, ease: 'easeInOut' as const } });

  return (
    <section className="py-16">
      <Reveal>
        <div className="relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-[#0f1d2e] px-6 py-16 text-center shadow-card sm:px-12">
          {/* soft glows */}
          <motion.div aria-hidden className="absolute -left-24 -top-32 -z-10 h-[26rem] w-[26rem] rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgb(0 137 255 / 0.35), transparent 65%)' }} {...drift(['0%', '35%', '10%'], ['0%', '20%', '40%'], 18)} />
          <motion.div aria-hidden className="absolute -bottom-40 -right-24 -z-10 h-[28rem] w-[28rem] rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgb(123 92 240 / 0.22), transparent 65%)' }} {...drift(['0%', '-30%', '-10%'], ['0%', '-25%', '-5%'], 22)} />

          {/* faint grid, strongest in the middle */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-[0.07]"
            style={{
              backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
              backgroundSize: '44px 44px',
              maskImage: 'radial-gradient(60% 75% at 50% 50%, black, transparent)',
              WebkitMaskImage: 'radial-gradient(60% 75% at 50% 50%, black, transparent)',
            }}
          />

          {/* slow light sweep */}
          {!still && (
            <motion.div
              aria-hidden
              className="absolute inset-y-0 -z-10 w-1/3 -skew-x-12"
              style={{ background: 'linear-gradient(90deg, transparent, rgb(255 255 255 / 0.05), transparent)' }}
              initial={{ left: '-40%' }}
              animate={{ left: '140%' }}
              transition={{ duration: 7, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }}
            />
          )}

          <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-white shadow-[0_12px_40px_-8px_rgb(0_137_255_/_0.45)]">
            <BrandMark size={50} mode="once" />
          </div>
          <h2 className="font-display text-[clamp(2rem,4vw,3.5rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-white">
            Ready to <span className="text-[#5cb4ff]">break something?</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-white/70">Five lessons, fifty-plus live examples, zero setup. Your database is already running.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={firstLesson} className="flex min-h-[52px] items-center gap-2 rounded-2xl bg-white px-6 font-bold text-[#14273D] shadow-card transition hover:-translate-y-0.5">
              Start learning <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/playground" className="flex min-h-[52px] items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/10">
              <Terminal className="h-4 w-4" /> Open the playground
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
