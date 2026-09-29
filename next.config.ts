import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  pageExtensions: ['ts', 'tsx', 'md', 'mdx'],
  // pg is Node-only (live mode API route). PGlite runs in the browser, never on the server.
  serverExternalPackages: ['pg', '@electric-sql/pglite'],
};

// Turbopack needs plugins referenced by package name (no functions can cross into Rust).
export default createMDX({
  options: {
    remarkPlugins: ['remark-gfm'],
    rehypePlugins: ['rehype-slug'],
  },
})(nextConfig);
