import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import nextShareable from 'eslint-config-next/core-web-vitals';
import { defineConfig, globalIgnores } from 'eslint/config';

/**
 * ESLint 9 flat config, for Next 16.
 *
 * Next 16 deleted `next lint`, and eslint-config-next v16 exports *flat* config arrays, so the
 * answer is to spread them: one import brings the whole Next rule set with its plugins registered
 * (react, react-hooks, jsx-a11y, import, `@typescript-eslint` + its parser, `@next/next`).
 *
 * Two bridges were tried and do not work, so do not "fix" this back into them:
 *   - `@eslint/eslintrc`'s FlatCompat validates these objects as eslintrc data and dies with
 *     "Converting circular structure to JSON".
 *   - `extends: ['next/core-web-vitals']` resolves against `@next/eslint-plugin-next`, whose own
 *     flat config registers only `@next/next` — every `react/*` rule then fails to find its plugin.
 *
 * The TypeScript rules need `typescript` to expose a JS API, which TS 7 does not. package.json
 * aliases `typescript` to `@typescript/typescript6` for tooling and keeps the TS 7 compiler as
 * `typescript-cli` — whose `tsc` is what `pnpm typecheck` runs.
 */
const next = Array.isArray(nextShareable) ? nextShareable : [nextShareable];

export default defineConfig([
  // `_legacy` is the archived research app: not routed, not built, and excluded from tsconfig —
  // linting it would report a codebase that no longer exists.
  globalIgnores(['.next/**', '_legacy/**', 'node_modules/**', 'out/**', 'coverage/**', 'next-env.d.ts']),
  ...next,
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    rules: {
      // App Router only: there is no pages/ directory for it to resolve against.
      '@next/next/no-html-link-for-pages': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'react/no-unknown-property': 'warn',
      // The two React Compiler-era rules that react-hooks v6 ships as errors. Both patterns are
      // deliberate here, and the fix for each is a refactor this repo is not asking for yet:
      //  - refs: the Monaco/voice bridges keep "latest props" in a ref so a callback created once
      //    reads current values; React prefers an effect, which adds a render of staleness.
      //  - set-state-in-effect: 25 panels load data when a tab/persona/table changes, which is the
      //    documented fetch-on-change shape until this app moves to server components for data.
      // Warn, so the count is visible in `pnpm lint` output and CI stays green while it shrinks.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // Flat config requires a rule's plugin to be registered in the *same* object as the rule, and
    // the shareable registers its parser only for `**/*.ts(x)` — so TS rules live here, with their
    // own parser, rather than in the JS-wide block above.
    files: ['**/*.{ts,mts,cts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2024, sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Tests legitimately cast to `any` to fake a server Response.
    files: ['**/*.test.ts'],
    plugins: { '@typescript-eslint': tsPlugin },
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
]);
