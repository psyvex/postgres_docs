import { describe, expect, it } from 'vitest';
import { PERSONAS, contextStatements, personaContext, withContext } from './session';

describe('contextStatements', () => {
  it('switches role and identity in the order RLS needs', () => {
    expect(contextStatements({ role: 'app_member', memberId: 2, orgId: 1 })).toEqual([
      "SET app.member_id = '2'",
      "SET app.org_id = '1'",
      'SET ROLE app_member',
    ]);
  });

  it('sends nothing for the superuser, who needs no context', () => {
    expect(contextStatements(personaContext('owner'))).toEqual([]);
  });

  it('quotes a role that is not a bare lowercase identifier', () => {
    expect(contextStatements({ role: 'App Member' })).toEqual(['SET ROLE "App Member"']);
  });

  it('doubles quotes, so a role name cannot close its own literal', () => {
    // Without doubling this would be: SET ROLE "a"; DROP TABLE members; --"
    expect(contextStatements({ role: 'a"; DROP TABLE members; --' })).toEqual([
      'SET ROLE "a""; DROP TABLE members; --"',
    ]);
  });

  it('passes member ids through Number, so a string id can never inject SQL', () => {
    expect(contextStatements({ memberId: 1 })).toContain("SET app.member_id = '1'");
    // A hostile value becomes `NaN`, not a statement: the quoted literal stays closed.
    expect(contextStatements({ memberId: "1'; DROP TABLE members; --" as unknown as number })).toEqual([
      "SET app.member_id = 'NaN'",
    ]);
  });
});

describe('withContext', () => {
  it('prefixes the statements and reports how many to skip when displaying results', () => {
    const { sql, skip } = withContext('SELECT * FROM members;', { role: 'app_anon' });
    expect(sql).toBe('SET ROLE app_anon;\nSELECT * FROM members;');
    expect(skip).toBe(1);
  });

  it('leaves the sql untouched and skips nothing when there is no context', () => {
    expect(withContext('SELECT 1;', {})).toEqual({ sql: 'SELECT 1;', skip: 0 });
  });

  it('ends every prefix statement with a semicolon so the user statement cannot merge into it', () => {
    const { sql } = withContext('SELECT 1', { memberId: 1, orgId: 1 });
    expect(sql.split(';\n')).toHaveLength(3);
    expect(sql.endsWith('SELECT 1')).toBe(true);
  });
});

describe('PERSONAS', () => {
  it('has ids that resolve, and only the superuser runs with no role', () => {
    for (const p of PERSONAS) expect(personaContext(p.id)).toMatchObject({ role: p.role || undefined });
    expect(personaContext('nobody')).toEqual({});
    expect(PERSONAS.filter((p) => !p.role).map((p) => p.id)).toEqual(['owner']);
  });

  it('gives every persona its own icon, and the superuser a crown rather than the AI sparkle', () => {
    expect(new Set(PERSONAS.map((p) => p.icon)).size).toBe(PERSONAS.length);
    expect(PERSONAS[0].icon).toBe('superuser');
  });
});
