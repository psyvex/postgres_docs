import type { Metadata } from 'next';
import { StoragePanel } from '@/components/settings/StoragePanel';

export const metadata: Metadata = {
  title: 'Storage & privacy',
  description: 'Everything Postgres Lab keeps in this browser — the AI answer cache, your SQL, translations, progress — listed so it can be inspected and erased.',
};

export default function SettingsPage() {
  return <StoragePanel />;
}
