import type { MDXContent } from 'mdx/types';

/** Static import map so every lesson is bundled and type-checked. Add new topics here. */
const loaders: Record<string, () => Promise<{ default: MDXContent }>> = {
  'row-level-security': () => import('./topics/row-level-security.mdx'),
  'roles-and-privileges': () => import('./topics/roles-and-privileges.mdx'),
  'functions-and-procedures': () => import('./topics/functions-and-procedures.mdx'),
  triggers: () => import('./topics/triggers.mdx'),
  'production-security': () => import('./topics/production-security.mdx'),
  'break-rls': () => import('./topics/break-rls.mdx'),
  indexes: () => import('./topics/indexes.mdx'),
  'transactions-mvcc': () => import('./topics/transactions-mvcc.mdx'),
  'partitioning': () => import('./topics/partitioning.mdx'),
  'backup-replication': () => import('./topics/backup-replication.mdx'),
  jsonb: () => import('./topics/jsonb.mdx'),
  'live-database': () => import('./topics/live-database.mdx'),
};

/** Every lesson that `generateStaticParams` will emit must have a key here, or the page builds as a 404. */
export const loadedSlugs = Object.keys(loaders);

export async function loadTopic(slug: string) {
  const loader = loaders[slug];
  return loader ? (await loader()).default : null;
}
