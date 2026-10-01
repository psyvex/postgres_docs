import type { MetadataRoute } from 'next';
import { readyTopics } from '@/content/registry';
import { siteUrl } from '@/lib/site';

/**
 * Generated from the lesson registry, so a lesson cannot be published without
 * appearing here, the `status` field is the only gate. Planned lessons stay
 * out of the index until they have content.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { url: siteUrl('/'), changeFrequency: 'weekly' as const, priority: 0.9 },
    { url: siteUrl('/playground'), changeFrequency: 'weekly' as const, priority: 1 },
  ];

  const lessons = readyTopics.map((t) => ({
    url: siteUrl(`/learn/${t.slug}`),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  // /settings is a per-browser utility with nothing to learn from; it is
  // reachable and indexable, just not interesting to a crawler.
  return [...pages, ...lessons, { url: siteUrl('/settings'), changeFrequency: 'monthly' as const, priority: 0.3 }];
}
