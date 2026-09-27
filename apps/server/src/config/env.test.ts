import { describe, expect, it } from 'vitest';
import { envSchema } from './env.js';

describe('envSchema', () => {
  const validSecret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  it('valida un entorno correcto con valores por defecto', () => {
    const env = envSchema.parse({
      SESSION_SECRET: validSecret,
    });
    expect(env.PORT).toBe(3000);
    expect(env.TZ).toBe('America/Caracas');
    expect(env.SESSION_COOKIE_NAME).toBe('tv_sid');
  });

  it('rechaza secretos prohibidos o placeholders', () => {
    expect(() =>
      envSchema.parse({
        SESSION_SECRET: 'CAMBIAR',
      }),
    ).toThrow();

    expect(() =>
      envSchema.parse({
        SESSION_SECRET: 'changeme',
      }),
    ).toThrow();
  });

  it('rechaza secretos menores a 32 caracteres', () => {
    expect(() =>
      envSchema.parse({
        SESSION_SECRET: 'muy_corto',
      }),
    ).toThrow();
  });
});
