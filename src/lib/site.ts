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
  'Learn PostgreSQL security hands-on: RLS, roles, functions, triggers, with a real Postgres running in your browser.';

/** Absolute URL for a path on this site. */
export const siteUrl = (path = '/') => new URL(path, `${SITE_URL}/`).toString();

/**
 * The two colours an installed app is painted with, copied from the `:root` tokens in
 * `globals.css` (`--bg` and `--brand`, light theme). A web app manifest is JSON handed to the
 * operating system, so it cannot read a CSS custom property and has to carry the literal; they live
 * here rather than inline in `manifest.ts` so the pairing with the token is written down in one
 * place. Light-theme values are the right choice for both: `background_color` is the splash screen
 * behind the icon, which appears before any stylesheet, and a dark splash with a light first paint
 * flashes.
 */
export const APP_BG = '#fbf8f3';
export const APP_BRAND = '#336791';
