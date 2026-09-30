/**
 * The public address of this deployment, and the copy that describes it to other
 * people (search engines, link previews). Every absolute URL in metadata, the
 * sitemap and share cards is built from here.
 *
 * Set NEXT_PUBLIC_SITE_URL per deployment so canonical links, sitemap entries
 * and og:image point at the real host. The fallback keeps a fresh clone building
 * and previewing sensibly, with the host visible in every URL it produces.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://postgres-lab.example').replace(/\/$/, '');

export const SITE_NAME = 'Postgres Lab';

export const SITE_DESCRIPTION =
  'Learn PostgreSQL security hands-on: RLS, roles, functions, triggers — with a real Postgres running in your browser.';

/** Absolute URL for a path on this site. */
export const siteUrl = (path = '/') => new URL(path, `${SITE_URL}/`).toString();
