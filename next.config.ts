import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  pageExtensions: ['ts', 'tsx', 'md', 'mdx'],
  // pg is Node-only (live mode API route). PGlite runs in the browser, never on the server.
  serverExternalPackages: ['pg', '@electric-sql/pglite'],
  // Browsers revalidate /sw.js on their own schedule, but only if they are allowed to look. A cached
  // worker is a worker that never learns about the next build, so the file that decides what
  // offline means has to be re-fetched every visit; the assets it serves stay cacheable.
  async headers() {
    return [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] }];
  },
};

// Turbopack needs plugins referenced by package name (no functions can cross into Rust).
export default createMDX({
  options: {
    remarkPlugins: ['remark-gfm'],
    rehypePlugins: ['rehype-slug'],
  },
})(nextConfig);
