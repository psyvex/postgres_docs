import { ImageResponse } from 'next/og';
import { getTopic, readyTopics } from '@/content/registry';
import { SITE_NAME } from '@/lib/site';

/**
 * One share card per lesson, generated from the registry entry — the same
 * source the page renders from, so a preview can't drift from the lesson.
 *
 * The card is a query editor, not a poster: a link to this site should look
 * like the thing it points at. Colours are literal copies of the dark-theme
 * tokens in globals.css (satori gets no CSS variables — it renders in a
 * sandbox with no stylesheet), so a token change needs a look here.
 */

export const alt = 'Postgres Lab lesson';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const C = {
  bg: '#12151c',
  surface: '#191d27',
  line: '#2c3243',
  text: '#e8ebf2',
  muted: '#9aa3b5',
  brand: '#6aa6d8',
  accent: '#a28bff',
  good: '#3ecf8e',
  bad: '#ff6b5f',
};

export function generateStaticParams() {
  return readyTopics.map((t) => ({ topic: t.slug }));
}

export default async function LessonOgImage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic: slug } = await params;
  const t = getTopic(slug);
  if (!t) return new ImageResponse(<div style={{ display: 'flex' }} />, { ...size });

  const isBreak = t.status === 'break';
  const facts = [isBreak ? `${t.challengeCount ?? 0} challenges` : null, t.minutes ? `${t.minutes} min` : null].filter(
    Boolean,
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: 56,
          gap: 26,
          background: C.bg,
          color: C.text,
          fontFamily: 'sans-serif',
        }}
      >
        {/* window chrome */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 15, height: 15, borderRadius: 999, background: C.bad }} />
          <div style={{ width: 15, height: 15, borderRadius: 999, background: '#f5b942' }} />
          <div style={{ width: 15, height: 15, borderRadius: 999, background: C.good }} />
          {/* One string, not three children: satori requires explicit flex on anything
              with more than a single node, and JSX splits text around an expression. */}
          <div style={{ marginLeft: 10, fontSize: 22, color: C.muted, fontFamily: 'monospace' }}>
            {`${SITE_NAME.toLowerCase().replace(/ /g, '-')} / learn / ${slug}`}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            alignSelf: 'flex-start',
            gap: 10,
            padding: '8px 20px',
            borderRadius: 999,
            border: `2px solid ${isBreak ? C.bad : C.accent}`,
            color: isBreak ? C.bad : C.accent,
            fontSize: 22,
            letterSpacing: 3,
            textTransform: 'uppercase',
            whiteSpace: 'pre',
          }}
        >
          {isBreak ? 'Break-it lab' : `${t.track} track`}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flexGrow: 1 }}>
          <div style={{ fontSize: 78, lineHeight: 1.05, fontWeight: 700, letterSpacing: -1.5 }}>{t.title}</div>
          <div style={{ fontSize: 31, lineHeight: 1.35, color: C.muted, maxWidth: 900 }}>{t.tagline}</div>
        </div>

        {/* the query the lesson is about */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '20px 26px',
            borderRadius: 16,
            background: C.surface,
            border: `2px solid ${C.line}`,
            fontFamily: 'monospace',
            fontSize: 27,
          }}
        >
          <span style={{ color: C.brand }}>SELECT</span>
          <span style={{ color: C.text }}>*</span>
          <span style={{ color: C.brand }}>FROM</span>
          <span style={{ color: C.text }}>{`${slug.replace(/-/g, '_')};`}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 12, height: 12, borderRadius: 999, background: C.good }} />
            <span style={{ color: C.text, fontWeight: 700 }}>{SITE_NAME}</span>
            <span style={{ color: C.muted }}>PostgreSQL 18 running in your browser</span>
          </div>
          <span style={{ color: C.muted }}>{facts.join(' · ')}</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
