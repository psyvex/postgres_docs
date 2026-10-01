/**
 * Vitest stand-in for the `server-only` marker package. Its real index.js throws on import,
 * which is exactly right in a bundle and useless in a node test that wants to unit-test a
 * server module, so vitest.config.ts aliases this empty module in its place.
 */
export {};
