import type { Persona, PersonaName } from './types';

/**
 * The five identities exam answers are executed as — the same five lesson blocks run under, and the
 * same table `scripts/verify-lessons.mjs` carries. Keeping it in one place means a question authored
 * as `bob` behaves identically in the lesson, in CI and in a live exam.
 */
export const PERSONAS: Record<PersonaName, Persona> = {
  owner: { name: 'owner' },
  alice: { name: 'alice', role: 'app_member', memberId: 1, orgId: 1 },
  bob: { name: 'bob', role: 'app_member', memberId: 2, orgId: 1 },
  carol: { name: 'carol', role: 'app_member', memberId: 3, orgId: 2 },
  anon: { name: 'anon', role: 'app_anon' },
};

export const personaNamed = (name: PersonaName): Persona => PERSONAS[name];
