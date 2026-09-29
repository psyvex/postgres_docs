import type { IconName } from '@/components/icons';

/** Demo personas matching the seed data, used by "Run as…" selectors and animations. */
export type Persona = { id: string; label: string; role: string; memberId?: number; orgId?: number; icon: IconName };

export const PERSONAS: Persona[] = [
  { id: 'owner', label: 'Superuser (you)', role: '', icon: 'superuser' },
  { id: 'alice', label: 'Alice · Acme owner', role: 'app_member', memberId: 1, orgId: 1, icon: 'astronaut' },
  { id: 'bob', label: 'Bob · Acme member', role: 'app_member', memberId: 2, orgId: 1, icon: 'member' },
  { id: 'carol', label: 'Carol · Globex owner', role: 'app_member', memberId: 3, orgId: 2, icon: 'scientist' },
  { id: 'anon', label: 'Anonymous visitor', role: 'app_anon', icon: 'anon' },
];

export type SessionContext = { role?: string; memberId?: number; orgId?: number };

export function personaContext(id: string | undefined): SessionContext {
  const p = PERSONAS.find((x) => x.id === id);
  return p ? { role: p.role || undefined, memberId: p.memberId, orgId: p.orgId } : {};
}

/**
 * Statements that simulate an app request: switch to a database role and set the
 * request-scoped identity that RLS policies read via current_setting().
 */
export function contextStatements(ctx: SessionContext): string[] {
  const out: string[] = [];
  if (ctx.memberId != null) out.push(`SET app.member_id = '${Number(ctx.memberId)}'`);
  if (ctx.orgId != null) out.push(`SET app.org_id = '${Number(ctx.orgId)}'`);
  if (ctx.role) out.push(`SET ROLE ${/^[a-z_][a-z0-9_]*$/.test(ctx.role) ? ctx.role : `"${ctx.role.replaceAll('"', '""')}"`}`);
  return out;
}

export function withContext(sql: string, ctx: SessionContext) {
  const prefix = contextStatements(ctx);
  return { sql: prefix.length ? `${prefix.join(';\n')};\n${sql}` : sql, skip: prefix.length };
}
