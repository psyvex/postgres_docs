import { ImageResponse } from 'next/og';
import { readyTopics } from '@/content/registry';
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site';

/**
 * Default share card for the routes without a lesson of their own: the home
 * page, the playground, settings. Same editor framing as the lesson cards
 * (colours copied from the dark tokens in globals.css, which satori can't read).
 */

export const alt = 'Postgres Lab: learn PostgreSQL security hands-on';
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
  warn: '#f5b942',
};

export default function SiteOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: 56,
          gap: 24,
          background: C.bg,
          color: C.text,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 15, height: 15, borderRadius: 999, background: C.bad }} />
          <div style={{ width: 15, height: 15, borderRadius: 999, background: C.warn }} />
          <div style={{ width: 15, height: 15, borderRadius: 999, background: C.good }} />
          <div style={{ marginLeft: 10, fontSize: 22, color: C.muted, fontFamily: 'monospace' }}>
            psql: postgresql 18, in your browser
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flexGrow: 1, justifyContent: 'center' }}>
          <div style={{ display: 'flex', fontSize: 96, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>
            {SITE_NAME}
            <span style={{ display: 'flex', color: C.brand }}>.</span>
          </div>
          <div style={{ fontSize: 32, lineHeight: 1.4, color: C.muted, maxWidth: 940 }}>{SITE_DESCRIPTION}</div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '24px 28px',
            borderRadius: 16,
            background: C.surface,
            border: `2px solid ${C.line}`,
            fontFamily: 'monospace',
            fontSize: 26,
            whiteSpace: 'pre',
          }}
        >
          <div style={{ display: 'flex', gap: 14 }}>
            <span style={{ color: C.brand }}>SET</span>
            <span style={{ color: C.text }}>ROLE bob;</span>
            <span style={{ display: 'flex', color: C.good }}>the role you get to play</span>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <span style={{ color: C.brand }}>SELECT</span>
            <span style={{ color: C.text }}>* FROM notes;</span>
            <span style={{ color: C.bad }}>ERROR: row-level security blocks it</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 12, height: 12, borderRadius: 999, background: C.good }} />
            <span style={{ color: C.muted }}>A real server in WebAssembly. Your SQL never leaves the browser</span>
          </div>
          <span style={{ display: 'flex', color: C.accent }}>{`${readyTopics.length} lessons`}</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
