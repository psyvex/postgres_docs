import Link from 'next/link';
import { topics } from '@/content/registry';
import { HeroUniverse } from '@/components/home/HeroUniverse';
import { HeroBackdrop } from '@/components/home/HeroBackdrop';
import { HeroSketches } from '@/components/home/HeroSketches';
import { KeywordMarquee } from '@/components/home/sections/KeywordMarquee';
import { HowItWorks } from '@/components/home/sections/HowItWorks';
import { TwoModes } from '@/components/home/sections/TwoModes';
import { AiDemo } from '@/components/home/sections/AiDemo';
import { FinalCta } from '@/components/home/sections/FinalCta';
import { Reveal, SectionHeading } from '@/components/home/sections/Reveal';
import { HeroIntro, type HeroStat } from '@/components/home/HeroIntro';
import { ProgressStats } from '@/components/home/sections/ProgressStats';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Icon } from '@/components/icons';

/** Real numbers, computed at build time from the content so they never go stale. */
function heroStats(): HeroStat[] {
  const root = path.join(process.cwd(), 'src');
  const lessons = readdirSync(path.join(root, 'content/topics')).filter((f) => f.endsWith('.mdx'));
  const mdx = lessons.map((f) => readFileSync(path.join(root, 'content/topics', f), 'utf8')).join('\n');
  const runnable = (mdx.match(/<SqlBlock(?![^>]*\bstatic\b)/g) ?? []).length;
  const animations = readdirSync(path.join(root, 'components/animations')).filter((f) => f.endsWith('.tsx')).length;
  return [
    { label: 'Lessons', value: lessons.length },
    { label: 'Runnable examples', value: runnable },
    { label: 'Live animations', value: animations },
    { label: 'PostgreSQL', value: 18 },
  ];
}

/** Total checkable blocks across all lessons, for the home-page progress summary. */
function totalCheckable(): number {
  const root = path.join(process.cwd(), 'src/content/topics');
  let n = 0;
  for (const f of readdirSync(root).filter((f) => f.endsWith('.mdx'))) {
    const raw = readFileSync(path.join(root, f), 'utf8');
    n += (raw.match(/<SqlBlock(?![^>]*\bstatic\b)[^>]*\bassert=/g) ?? []).length;
  }
  return n;
}

export default function Home() {
  const ready = topics.filter((t) => t.status === 'ready');
  const break_ = topics.filter((t) => t.status === 'break');
  const planned = topics.filter((t) => t.status === 'planned');

  return (
    <main dir="ltr" className="w-full px-4 pb-20 sm:px-8 xl:px-12">
      <section className="relative isolate -mx-4 grid min-h-[calc(100vh-3.5rem)] items-center gap-6 px-4 py-10 sm:-mx-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:py-6 xl:-mx-12 xl:px-12">
        <HeroBackdrop coreX={73} coreY={46} />
        <HeroSketches />
        <HeroIntro stats={heroStats()} firstLesson={`/learn/${ready[0].slug}`} />
        <HeroUniverse />
      </section>

      <KeywordMarquee />

      <section className="mx-auto max-w-xl px-4 py-6">
        <ProgressStats totalLessons={ready.length} totalChecks={totalCheckable()} />
      </section>

      <section className="py-16">
        <SectionHeading eyebrow="The lessons" title={<>Security &amp; automation, <span className="text-brand">one story.</span></>} copy="Each lesson builds on the same tiny multi-tenant app, so every concept lands on data you already know." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {ready.map((t, i) => (
            <Reveal key={t.slug} index={i}>
              <Link href={`/learn/${t.slug}`} className="group flex h-full flex-col rounded-3xl border border-line bg-surface p-5 shadow-card transition hover:-translate-y-1 hover:border-brand">
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand transition group-hover:scale-110 group-hover:bg-brand group-hover:text-on-brand"><Icon name={t.icon} size={28} /></span>
                  <span className="font-mono text-xs text-muted">0{i + 1}</span>
                </div>
                <div className="mt-4 font-display text-xl font-bold">{t.title}</div>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">{t.tagline}</p>
                <div className="mt-4 flex items-center justify-between text-xs font-semibold">
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-brand">{t.track}</span>
                  <span className="text-muted">{t.minutes} min</span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {break_.length > 0 && (
        <section className="py-16">
          <SectionHeading eyebrow="Break-it labs" title={<>Turn the lesson <span className="text-warn">against itself.</span></>} copy="You are Bob. Your job: break the RLS policy. Every challenge is a graded assertion, and the answer card tells you what went wrong." />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {break_.map((t, i) => (
              <Reveal key={t.slug} index={i}>
                <Link href={`/learn/${t.slug}`} className="group flex h-full flex-col rounded-3xl border border-warn/30 bg-surface p-5 shadow-card transition hover:-translate-y-1 hover:border-warn">
                  <div className="flex items-center justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: 'color-mix(in srgb, var(--warn) 15%, transparent)', color: 'var(--warn)' }}><Icon name={t.icon} size={28} /></span>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: 'color-mix(in srgb, var(--warn) 15%, transparent)', color: 'var(--warn)' }}>Break it</span>
                  </div>
                  <div className="mt-4 font-display text-xl font-bold">{t.title}</div>
                  <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">{t.tagline}</p>
                  <div className="mt-4 flex items-center justify-between text-xs font-semibold">
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-brand">{t.track}</span>
                    <span className="text-muted">{t.minutes} min</span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <HowItWorks />
      <TwoModes />
      <AiDemo />

      <section className="py-16">
        <SectionHeading eyebrow="Roadmap" title={<>Growing into a <span className="text-brand">full Postgres handbook.</span></>} copy="The same format, more of the database. Planned topics light up as they ship." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {planned.map((t, i) => (
            <Reveal key={t.slug} index={i}>
              <div className="h-full rounded-2xl border border-dashed border-line bg-surface/40 p-4 text-sm transition hover:border-brand/50">
                <div className="flex items-center gap-2 font-semibold"><Icon name={t.icon} size={18} className="text-muted" /> {t.title}</div>
                <div className="mt-1 text-xs text-muted">{t.tagline}</div>
                <div className="mt-3 w-fit rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">coming soon</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <FinalCta firstLesson={`/learn/${ready[0].slug}`} />
    </main>
  );
}

