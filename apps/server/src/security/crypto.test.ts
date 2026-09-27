import { describe, expect, it } from 'vitest';
import {
  deriveKey,
  generateCsrfToken,
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyCsrfToken,
  verifyPassword,
} from './crypto.js';

describe('crypto utilities', () => {
  const masterSecret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  it('deriveKey produce claves distintas para contextos distintos', () => {
    const keyA = deriveKey(masterSecret, 'context-a');
    const keyB = deriveKey(masterSecret, 'context-b');
    expect(keyA).not.toEqual(keyB);
    expect(keyA.length).toBe(32);
  });

  it('generateSessionToken genera tokens aleatorios de 64 caracteres hex', () => {
    const t1 = generateSessionToken();
    const t2 = generateSessionToken();
    expect(t1).not.toBe(t2);
    expect(t1.length).toBe(64);
  });

  it('hashSessionToken es determinista para el mismo token', () => {
    const token = 'abcdef123456';
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token).length).toBe(64);
  });

  it('hashPassword y verifyPassword validan contraseñas correctamente', async () => {
    const pass = 'SuperClaveSegura2026!';
    const hash = await hashPassword(pass);
    expect(hash).toContain(':');
    expect(await verifyPassword(pass, hash)).toBe(true);
    expect(await verifyPassword('ClaveErrada', hash)).toBe(false);
  });

  it('generateCsrfToken y verifyCsrfToken validan tokens CSRF', () => {
    const sessionId = 'session-123';
    const csrf = generateCsrfToken(sessionId, masterSecret);
    expect(verifyCsrfToken(csrf, sessionId, masterSecret)).toBe(true);
    expect(verifyCsrfToken(csrf, 'otra-sesion', masterSecret)).toBe(false);
    expect(verifyCsrfToken('invalido', sessionId, masterSecret)).toBe(false);
  });
});
