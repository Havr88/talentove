import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { normalizeNativeId, parseIdCatalog, validateNativeId } from './native-id.js';
import { DomainError } from '../errors.js';

const CATALOGO = parseIdCatalog(
  JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../data/ve/identificadores.json', import.meta.url)), 'utf8'),
  ) as unknown,
);

describe('normalizeNativeId', () => {
  it.each([
    ['V-12345678', 'V12345678'],
    ['V-12.345.678', 'V12345678'],
    ['v 12345678', 'V12345678'],
    ['  J000029709  ', 'J000029709'],
    ['G200099976', 'G200099976'],
  ])('normaliza %s a %s', (entrada, esperado) => {
    expect(normalizeNativeId(entrada)).toBe(esperado);
  });

  it('rechaza una entrada vacía o solo con separadores', () => {
    expect(() => normalizeNativeId('   ')).toThrow(DomainError);
    expect(() => normalizeNativeId('---')).toThrow(DomainError);
  });

  it('normaliza la forma aunque el prefijo no exista en el catálogo', () => {
    // Normalizar es sintaxis; si el prefijo es válido según el catálogo, lo decide validateNativeId.
    expect(normalizeNativeId('X12345678')).toBe('X12345678');
  });

  it.each(['12345678', 'V12A34', 'V', 'AB12'])('rechaza %s: no tiene la forma prefijo + dígitos', (entrada) => {
    expect(() => normalizeNativeId(entrada)).toThrow(DomainError);
  });
});

describe('validateNativeId', () => {
  it('acepta una cédula con longitud declarada en el catálogo', () => {
    const resultado = validateNativeId('V-12345678', CATALOGO);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value).toBe('V12345678');
      expect(resultado.tipo).toBe('persona_natural');
    }
  });

  it('expone que el catálogo no está verificado en vez de ocultarlo', () => {
    const resultado = validateNativeId('V12345678', CATALOGO);
    expect(resultado.verificado).toBe(false);
  });

  it('rechaza un prefijo desconocido', () => {
    const resultado = validateNativeId('X12345678', CATALOGO);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.code).toBe('prefijo_desconocido');
  });

  it('rechaza una longitud que el catálogo no declara, sin adivinar', () => {
    const resultado = validateNativeId('V1234', CATALOGO);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.code).toBe('longitud');
  });

  it('no calcula el dígito verificador mientras no esté verificado', () => {
    const resultado = validateNativeId('V99999999', CATALOGO);
    expect(resultado.ok).toBe(true);
  });

  it('el mensaje de error es utilizable en la interfaz', () => {
    const resultado = validateNativeId('X12345678', CATALOGO);
    if (!resultado.ok) expect(resultado.message.length).toBeGreaterThan(10);
  });

  it('captura errores de formato cuando la entrada no puede normalizarse', () => {
    const resVacio = validateNativeId('', CATALOGO);
    expect(resVacio.ok).toBe(false);
    if (!resVacio.ok) {
      expect(resVacio.code).toBe('formato');
      expect(resVacio.message).toContain('vacío');
    }

    const resSeparadores = validateNativeId('---', CATALOGO);
    expect(resSeparadores.ok).toBe(false);
    if (!resSeparadores.ok) {
      expect(resSeparadores.code).toBe('formato');
    }
  });
});

describe('contrato con el registro interbancario público', () => {
  const bancos = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../data/ve/bancos.json', import.meta.url)), 'utf8'),
  ) as { instituciones: Array<{ nombre: string; rif: string }> };

  it.each(bancos.instituciones.map((b) => [b.nombre, b.rif] as const))(
    'el RIF de %s valida contra el catálogo',
    (_nombre, rif) => {
      expect(validateNativeId(rif, CATALOGO).ok).toBe(true);
    },
  );
});

describe('parseIdCatalog', () => {
  it('lanza si el catálogo no cumple el contrato', () => {
    expect(() => parseIdCatalog({ prefijos: [] })).toThrow(DomainError);
    expect(() => parseIdCatalog({ prefijos: [{ prefijo: 'V' }] })).toThrow(DomainError);
  });

  it('procesa catálogo verificado y con metadatos completos', () => {
    const cat = parseIdCatalog({
      _meta: { verificacion: 'VERIFICADO_SENIAT_2026', fecha_consulta: '2026-09-27' },
      prefijos: [
        { prefijo: 'V', tipo: 'persona_natural', significado: 'Venezolano', longitudes_digitos: [7, 8], confianza: 'alta' },
      ],
    });
    expect(cat.verificado).toBe(true);
    expect(cat.fechaConsulta).toBe('2026-09-27');
    expect(cat.prefijos[0]?.significado).toBe('Venezolano');
    expect(cat.prefijos[0]?.confianza).toBe('alta');
  });

  it('asigna valores por defecto si _meta o campos opcionales no son strings', () => {
    const cat = parseIdCatalog({
      prefijos: [
        { prefijo: 'E', tipo: 'persona_natural', longitudes_digitos: [7, 8] },
      ],
    });
    expect(cat.verificado).toBe(false);
    expect(cat.fechaConsulta).toBe('desconocida');
    expect(cat.prefijos[0]?.significado).toBe('');
    expect(cat.prefijos[0]?.confianza).toBe('baja');
  });
});
