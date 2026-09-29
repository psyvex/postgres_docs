import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PostgreSQL Security Lab',
  description: 'Interactive PostgreSQL RLS, roles, functions and triggers lab.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
