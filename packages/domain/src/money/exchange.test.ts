import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors.js';
import { convert, parseDolarApiResponse } from './exchange.js';
import { money } from './money.js';

describe('convert (Bs / USD)', () => {
  it('convierte USD a VES multiplicando por la tasa', () => {
    const usd = money('100.00', 'USD');
    const tasa = '65.50';
    const ves = convert(usd, 'VES', tasa);
    expect(ves).toEqual({ amount: '6550.00', currency: 'VES' });
  });

  it('convierte VES a USD dividiendo entre la tasa', () => {
    const ves = money('6550.00', 'VES');
    const tasa = '65.50';
    const usd = convert(ves, 'USD', tasa);
    expect(usd).toEqual({ amount: '100.00', currency: 'USD' });
  });

  it('devuelve el mismo monto si la moneda origen y destino coinciden', () => {
    const m = money('150.00', 'VES');
    expect(convert(m, 'VES', '70.00')).toBe(m);
  });

  it('rechaza tasa de cambio menor o igual a cero', () => {
    const usd = money('10.00', 'USD');
    expect(() => convert(usd, 'VES', '0')).toThrow(DomainError);
    expect(() => convert(usd, 'VES', '-10.50')).toThrow(DomainError);
  });

  it('rechaza conversión entre monedas no soportadas', () => {
    const fake = { amount: '10.00', currency: 'EUR' as 'VES' };
    expect(() => convert(fake, 'VES', '60.00')).toThrow(DomainError);
  });
});

describe('parseDolarApiResponse', () => {
  it('parsea correctamente un payload válido de DolarAPI', () => {
    const payload = {
      promedio: 65.4821,
      fechaActualizacion: '2026-09-27T10:00:00.000Z',
    };
    const res = parseDolarApiResponse(payload);
    expect(res.rate).toBe('65.482100');
    expect(res.source).toBe('BCV');
    expect(res.fetchedAt).toBe('2026-09-27T10:00:00.000Z');
    expect(res.notes).toContain('DolarAPI Oficial');
  });

  it('acepta promedio como string numérico', () => {
    const payload = {
      promedio: '65.50',
    };
    const res = parseDolarApiResponse(payload, '2026-09-27T12:00:00.000Z');
    expect(res.rate).toBe('65.500000');
    expect(res.fetchedAt).toBe('2026-09-27T12:00:00.000Z');
  });

  it('rechaza payloads no objetos o nulos', () => {
    expect(() => parseDolarApiResponse(null)).toThrow(DomainError);
    expect(() => parseDolarApiResponse('string')).toThrow(DomainError);
  });

  it('rechaza si falta el campo promedio o no es válido', () => {
    expect(() => parseDolarApiResponse({})).toThrow(DomainError);
    expect(() => parseDolarApiResponse({ promedio: null })).toThrow(DomainError);
    expect(() => parseDolarApiResponse({ promedio: 'invalido' })).toThrow(DomainError);
    expect(() => parseDolarApiResponse({ promedio: '' })).toThrow(DomainError);
    expect(() => parseDolarApiResponse({ promedio: '   ' })).toThrow(DomainError);
    expect(() => parseDolarApiResponse({ promedio: -5 })).toThrow(DomainError);
    expect(() => parseDolarApiResponse({ promedio: 0 })).toThrow(DomainError);
  });
});
