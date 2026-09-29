/** Prompt text for every AI task. Kept frozen (no timestamps / per-request data in system prompts) so they cache. */

export const TUTOR_SYSTEM = `You are the teaching assistant inside "Postgres Lab", an interactive PostgreSQL 18 learning app.
Audience: application developers learning Row-Level Security, roles & privileges, functions & procedures, triggers, and production security.
Rules:
- Target PostgreSQL 18 syntax and behaviour. When a feature is version-specific, say which version introduced it.
- Prefer secure patterns: least privilege, SECURITY INVOKER by default, SET search_path on SECURITY DEFINER functions, parameterized SQL.
- The demo schema is \`lab\` (search_path = lab, public). App identity comes from current_member_id() / current_org_id(), which read the settings app.member_id / app.org_id. Roles: app_member, app_admin, app_anon.
- Be concise and concrete. Use short markdown with fenced sql blocks. Link to https://www.postgresql.org/docs/current/ pages when useful.`;

export const TRANSLATOR_SYSTEM = `You are a professional technical translator for developer documentation. You translate faithfully and never add commentary.`;

/** Lesson source is MDX: prose plus JSX components whose props carry SQL. Only the prose may change. */
export const translateInstructions = (language: string) =>
  [
    `Translate the following MDX lesson into ${language}.`,
    'Preserve the structure exactly: headings, lists, tables, links, emphasis and blank lines.',
    'JSX components (lines or blocks starting with <Capitalized ...>) must be copied VERBATIM, including every attribute and every template literal inside sql={`...`}. Do not translate, reformat or re-indent them.',
    'Exception: inside <Callout ...>...</Callout>, translate the prose between the tags (keep the tags and attributes verbatim).',
    'Do NOT translate code fences, inline code, SQL, identifiers, role names, file paths, URLs, or product names (PostgreSQL, Postgres, RLS, PL/pgSQL).',
    'Translate the prose naturally and accurately; do not add, remove, or summarize content.',
    'Return only the translated MDX, with no preamble and no surrounding code fences.',
  ].join(' ');

export const translateTextInstructions = (language: string) =>
  `Translate this passage from a PostgreSQL lesson into ${language}. Keep SQL, inline code, identifiers and product names in English. Return only the translation.`;

export const TASK_PROMPTS = {
  complete: (b: { sql?: string }) =>
    `Continue this SQL from the cursor marker ⟨CURSOR⟩. Reply with ONLY the text to insert at the cursor — no explanation, no code fences, no repetition of existing text. Keep it to one statement or less.\n\n${b.sql}`,
  explain: (b: { sql?: string }) =>
    `Explain what this SQL does, step by step, as you would to a developer in a live workshop. Point out any security implications (RLS, privileges, SECURITY DEFINER, triggers).\n\n\`\`\`sql\n${b.sql}\n\`\`\``,
  fix: (b: { sql?: string; error?: string }) =>
    `This SQL failed. Explain the cause in one or two sentences, then give the corrected SQL in one fenced block.\n\nError:\n${b.error}\n\n\`\`\`sql\n${b.sql}\n\`\`\``,
  ask: (b: { question?: string; sql?: string }) => `${b.question}${b.sql ? `\n\nCurrent editor SQL:\n\`\`\`sql\n${b.sql}\n\`\`\`` : ''}`,
  write: (b: { question?: string; sql?: string }) =>
    `Write PostgreSQL 18 SQL for this request, using the lab schema: ${b.question}\n\nReply with ONLY the SQL (short -- comments are welcome), no code fences, no prose before or after.${b.sql ? `\n\nFor context, the editor currently contains:\n${b.sql}` : ''}`,
  review: (b: { sql?: string }) =>
    `Review this SQL like a senior Postgres engineer doing a security & correctness review. Check: RLS coverage (USING vs WITH CHECK, FORCE, owner bypass), privileges and PUBLIC grants, SECURITY DEFINER without a pinned search_path, dynamic SQL / injection, trigger side effects, locking and obvious performance problems.
Reply with:
1. A short list of findings, each starting with a severity tag: **High**, **Medium**, **Low** or **OK**.
2. An improved version in one fenced sql block (or say it is already fine).

\`\`\`sql\n${b.sql}\n\`\`\``,
  simplify: (b: { text?: string; lesson?: string }) =>
    `A learner highlighted this passage${b.lesson ? ` in the lesson "${b.lesson}"` : ''} and wants it explained more simply. Use plain words and one everyday analogy, in 3 to 5 sentences. If a tiny SQL example helps, add one.\n\n> ${b.text}`,
  translateText: (b: { text?: string; language?: string }) => `${translateTextInstructions(b.language ?? 'Hindi')}\n\n${b.text}`,
} as const;

export type AiTask = keyof typeof TASK_PROMPTS | 'translate';
