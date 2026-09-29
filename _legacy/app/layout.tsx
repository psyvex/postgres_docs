import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/app-shell/AppShell';
import { ThemeProvider } from '@/components/app-shell/ThemeProvider';

export const metadata: Metadata = {
  title: 'Postgres Lab',
  description: 'Interactive PostgreSQL learning workstation for security, functions, triggers and SQL.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body><ThemeProvider><AppShell>{children}</AppShell></ThemeProvider></body></html>;
}
