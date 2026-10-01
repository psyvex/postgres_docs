import type { MetadataRoute } from 'next';
import { APP_BG, APP_BRAND, SITE_DESCRIPTION, SITE_NAME } from '@/lib/site';

/**
 * The install manifest. A file rather than a `public/manifest.json` so the name, the description and
 * the colours come from the same constants the metadata and the share cards already use: a fork that
 * renames the site renames the installed app, and cannot end up with a manifest that describes a
 * different product than the one it serves.
 *
 * `start_url` is the playground, not the home page. This is an installed app because it is a tool:
 * the thing worth putting on a homescreen is the editor with a database in it, and a launch that
 * lands on marketing copy wastes the one screen an app gets. `scope` keeps every link the reader
 * follows (lessons, settings) inside the same window rather than opening a browser tab mid-lesson.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME}: PostgreSQL you can break`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    id: '/',
    start_url: '/playground',
    scope: '/',
    display: 'standalone',
    background_color: APP_BG,
    theme_color: APP_BRAND,
    lang: 'en',
    categories: ['education', 'developer tools', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
