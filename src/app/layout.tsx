import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Caveat, JetBrains_Mono, Source_Sans_3 } from 'next/font/google';
import { AppHeader } from '@/components/shell/AppHeader';
import { CommandPaletteLauncher } from '@/components/shell/CommandPalette';
import { ServiceWorkerRegister } from '@/components/shell/ServiceWorkerRegister';
import { SplashScreen } from '@/components/brand/SplashScreen';
import { UiLanguageSync } from '@/components/shell/UiLanguageSync';
import { TooltipLayer } from '@/components/ui/Tooltip';
import { rootMeta, rootViewport } from '@/lib/site-meta';
import './globals.css';

const heading = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-heading', weight: ['600', '700', '800'] });
const body = Source_Sans_3({ subsets: ['latin'], variable: '--font-body' });
const code = JetBrains_Mono({ subsets: ['latin'], variable: '--font-code' });
const hand = Caveat({ subsets: ['latin'], variable: '--font-hand-src', weight: ['600'] });

export const metadata: Metadata = rootMeta;
export const viewport: Viewport = rootViewport;

// Before paint: apply the saved theme (no light/dark flash) and hide the splash if it already played this session.
const themeScript = `try{var t=localStorage.getItem('postgres-lab:theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark');if(sessionStorage.getItem('postgres-lab:splash-seen')==='1')document.documentElement.dataset.splash='seen'}catch(e){}`;

// Same trick, same reason: an Arabic page that paints LTR and flips a frame later is the flash this
// script exists to avoid. `dir` is not a JSX prop, so React has no value of its own to write back
// over it (`suppressHydrationWarning` on `<html>` already makes React skip this node).
// The 'ar'-only rule duplicates `dirOf()` in lib/i18n/languages.ts; this runs before any module does.
const languageScript = `try{var l=localStorage.getItem('postgres-lab:ui-lang');if(['ar','es','hi','ja','zh'].includes(l)){document.documentElement.lang=l;if(l==='ar')document.documentElement.dir='rtl'}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${heading.variable} ${body.variable} ${code.variable} ${hand.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: languageScript }} />
      </head>
      <body className="min-h-screen">
        <SplashScreen />
        <UiLanguageSync />
        <ServiceWorkerRegister />
        <AppHeader />
        {children}
        <TooltipLayer />
        <CommandPaletteLauncher />
      </body>
    </html>
  );
}
