import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, Clock } from 'lucide-react';
import { getTopic, readyTopics } from '@/content/registry';
import { loadTopic } from '@/content/load';
import { TopicSidebar } from '@/components/learn/TopicSidebar';
import { OnThisPage } from '@/components/learn/OnThisPage';
import { MiniSchema } from '@/components/learn/MiniSchema';
import { LessonTranslator } from '@/components/learn/LessonTranslator';
import { LessonAssistant } from '@/components/learn/LessonAssistant';
import { LessonProgress } from '@/components/learn/LessonProgress';
import { BreakLessonHeader } from '@/components/learn/BreakLessonHeader';
import { lessonMeta as lessonDocMeta } from '@/lib/site-meta';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Hash + size of the lesson source: versions cached translations and sizes the progress bar.
 *  Also counts runnable blocks with `assert=` so the progress bar can show "3 of 8 checks solved". */
function lessonMeta(slug: string) {
  try {
    const raw = readFileSync(path.join(process.cwd(), 'src/content/topics', `${slug}.mdx`), 'utf8');
    const assertCount = (raw.match(/<SqlBlock(?![^>]*\bstatic\b)[^>]*\bassert=/g) ?? []).length;
    return {
      version: createHash('sha1').update(raw).digest('hex').slice(0, 12),
      length: raw.length,
      assertCount,
    };
  } catch {
    return { version: 'dev', length: 20_000, assertCount: 0 };
  }
}
import { Icon, type IconName } from '@/components/icons';

export const dynamicParams = false;

export function generateStaticParams() {
  return readyTopics.map((t) => ({ topic: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
  const topic = getTopic((await params).topic);
  if (!topic) return {};
  // Title, tagline, canonical and the share-card copy all come from the registry,
  // which is the same source the page body and the OG image render from.
  return lessonDocMeta(topic.title, topic.tagline, topic.slug);
}

export default async function TopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic: slug } = await params;
  const topic = getTopic(slug);
  const Content = await loadTopic(slug);
  const source = lessonMeta(slug);
  if (!topic || !Content) notFound();

  const index = readyTopics.findIndex((t) => t.slug === slug);
  const prev = readyTopics[index - 1];
  const next = readyTopics[index + 1];

  return (
    <div className="grid w-full grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)_320px]">
      <TopicSidebar active={slug} />

      <main className="min-w-0 px-4 py-8 sm:px-8 xl:px-12">
        <header className="mb-4">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand shadow-card">
              <Icon name={topic.icon} size={32} />
            </span>
            <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight">{topic.title}</h1>
          </div>
        </header>

        {topic.status === 'break' && topic.challengeCount != null
          ? <BreakLessonHeader slug={slug} totalChecks={source.assertCount} challengeTotal={topic.challengeCount} />
          : <LessonProgress slug={slug} totalChecks={source.assertCount} />
        }
        <LessonTranslator
          slug={slug}
          version={source.version}
          sourceLength={source.length}
          meta={
            <>
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-brand">{topic.track}</span>
              {topic.minutes && (
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {topic.minutes} min</span>
              )}
              <span>Targets PostgreSQL 18</span>
            </>
          }
        >
          <Content />
        </LessonTranslator>
        <LessonAssistant slug={slug} title={topic.title} />

        {topic.references && (
          <section className="mt-12 rounded-2xl border border-line bg-surface p-5 2xl:hidden">
            <References refs={topic.references} />
          </section>
        )}

        <nav className="mt-12 grid gap-3 sm:grid-cols-2">
          {prev ? <PagerLink href={`/learn/${prev.slug}`} dir="prev" title={prev.title} icon={prev.icon} /> : <span />}
          {next && <PagerLink href={`/learn/${next.slug}`} dir="next" title={next.title} icon={next.icon} />}
        </nav>
      </main>

      <aside className="hidden 2xl:block">
        <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] space-y-6 overflow-y-auto border-l border-line px-5 py-8">
          <OnThisPage />
          {topic.references && <References refs={topic.references} />}
          <MiniSchema />
        </div>
      </aside>
    </div>
  );
}

function References({ refs }: { refs: { title: string; url: string }[] }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
        <BookOpen className="h-3.5 w-3.5" /> Official references
      </div>
      <ul className="space-y-1.5 text-sm">
        {refs.map((r) => (
          <li key={r.url}>
            <a href={r.url} target="_blank" rel="noreferrer" className="text-brand hover:underline">{r.title} ↗</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PagerLink({ href, dir, title, icon }: { href: string; dir: 'prev' | 'next'; title: string; icon: IconName }) {
  return (
    <Link href={href} className={`group rounded-2xl border border-line bg-surface p-4 shadow-card transition hover:border-brand ${dir === 'next' ? 'text-right sm:col-start-2' : ''}`}>
      <div className={`flex items-center gap-1 text-xs font-semibold text-muted ${dir === 'next' ? 'justify-end' : ''}`}>
        {dir === 'prev' && <ArrowLeft className="h-3.5 w-3.5" />} {dir === 'prev' ? 'Previous' : 'Next'} {dir === 'next' && <ArrowRight className="h-3.5 w-3.5" />}
      </div>
      <div className={`mt-1 flex items-center gap-2 font-display text-lg font-bold ${dir === 'next' ? 'justify-end' : ''}`}><Icon name={icon} className="text-brand" /> {title}</div>
    </Link>
  );
}
