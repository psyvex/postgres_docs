import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/**
 * Everything is meant to be read, including the lab pages. `/api/` is off
 * limits: those routes run SQL and call a model, and a crawler fetching them
 * spends the deployment's AI quota and pollutes the query log with bot traffic.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: siteUrl('/sitemap.xml'),
    host: siteUrl('/'),
  };
}
