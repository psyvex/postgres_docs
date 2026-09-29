import { Fragment } from 'react';

const KEYWORDS = new Set(
  `select from where and or not insert into values update set delete create table alter drop grant revoke on to as
  policy using with check enable disable force row level security role roles function procedure returns return returns
  language begin end declare if then else elsif case when trigger before after instead of for each execute call
  schema public usage all privileges in is null true false limit order by group having join left right inner outer
  primary key references default constraint unique index view security definer invoker stable volatile immutable
  plpgsql sql new old raise exception notice perform loop exists distinct union returning commit rollback nologin
  login inherit noinherit bypassrls cascade restrict owner replace or statement do select current_user session_user
  permissive restrictive transaction show reset search_path strict leakproof parallel safe`
    .split(/\s+/)
    .filter(Boolean),
);

const TOKEN = /(--[^\n]*)|('(?:[^']|'')*')|(\$[a-z_]*\$)|(\b\d+(?:\.\d+)?\b)|([a-z_][a-z0-9_]*)(?=\s*\()|([A-Za-z_][A-Za-z0-9_]*)/gi;

/** Tiny, dependency-free SQL highlighter for read-only snippets. */
export function highlightSql(sql: string) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of sql.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) parts.push(sql.slice(last, i));
    const [text, com, str, dollar, num, fn, word] = m;
    const cls = com ? 'tok-com' : str || dollar ? 'tok-str' : num ? 'tok-num' : fn ? (KEYWORDS.has(fn.toLowerCase()) ? 'tok-kw' : 'tok-fn') : word && KEYWORDS.has(word.toLowerCase()) ? 'tok-kw' : null;
    parts.push(cls ? <span key={i} className={cls}>{text}</span> : <Fragment key={i}>{text}</Fragment>);
    last = i + text.length;
  }
  if (last < sql.length) parts.push(sql.slice(last));
  return parts;
}
