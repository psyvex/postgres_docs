import type { MDXContent } from 'mdx/types';

/** Static import map so every lesson is bundled and type-checked. Add new topics here. */
const loaders: Record<string, () => Promise<{ default: MDXContent }>> = {
  'row-level-security': () => import('./topics/row-level-security.mdx'),
  'roles-and-privileges': () => import('./topics/roles-and-privileges.mdx'),
  'functions-and-procedures': () => import('./topics/functions-and-procedures.mdx'),
  triggers: () => import('./topics/triggers.mdx'),
  'production-security': () => import('./topics/production-security.mdx'),
};

export async function loadTopic(slug: string) {
  const loader = loaders[slug];
  return loader ? (await loader()).default : null;
}
