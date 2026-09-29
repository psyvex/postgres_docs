import type { Metadata } from 'next';
import { Bricolage_Grotesque, Caveat, JetBrains_Mono, Source_Sans_3 } from 'next/font/google';
import { AppHeader } from '@/components/shell/AppHeader';
import { SplashScreen } from '@/components/brand/SplashScreen';
import './globals.css';

const heading = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-heading', weight: ['600', '700', '800'] });
const body = Source_Sans_3({ subsets: ['latin'], variable: '--font-body' });
const code = JetBrains_Mono({ subsets: ['latin'], variable: '--font-code' });
const hand = Caveat({ subsets: ['latin'], variable: '--font-hand-src', weight: ['600'] });

export const metadata: Metadata = {
  title: { default: 'Postgres Lab', template: '%s · Postgres Lab' },
  description: 'Learn PostgreSQL security hands-on: RLS, roles, functions, triggers — with a real Postgres running in your browser.',
};

// Before paint: apply the saved theme (no light/dark flash) and hide the splash if it already played this session.
const themeScript = `try{var t=localStorage.getItem('postgres-lab:theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark');if(sessionStorage.getItem('postgres-lab:splash-seen')==='1')document.documentElement.dataset.splash='seen'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${heading.variable} ${body.variable} ${code.variable} ${hand.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <SplashScreen />
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
