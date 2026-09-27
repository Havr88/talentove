import { describe, expect, it } from 'vitest';

import { MONEY_SCALE, RATE_SCALE, formatScaled, roundHalfUp } from './round.js';
import {
  abs,
  add,
  applyRate,
  divide,
  equals,
  formatMoney,
  greaterThan,
  greaterThanOrEqual,
  isNegative,
  isPositive,
  isZero,
  lessThan,
  lessThanOrEqual,
  max,
  min,
  money,
  multiply,
  rate,
  subtract,
  sum,
  toDbAmount,
  zero,
} from './money.js';
import type { MoneyInput } from './money.js';
import { toDecimal } from '../numeric.js';
import { Decimal } from 'decimal.js';
import { DomainError } from '../errors.js';

describe('roundHalfUp', () => {
  it.each([
    ['0.005', 2, '0.01'],
    ['0.015', 2, '0.02'],
    ['0.025', 2, '0.03'],
    ['-0.005', 2, '-0.01'],
    ['-0.015', 2, '-0.02'],
    ['2.675', 2, '2.68'],
    ['1.004999', 2, '1.00'],
    ['1.005', 2, '1.01'],
    ['1234.565', 2, '1234.57'],
    ['14.5', 0, '15'],
    ['0.5', 0, '1'],
    ['0.4', 0, '0'],
  ])('redondea %s a %i decimales como %s (half away from zero)', (input, scale, expected) => {
    expect(roundHalfUp(input, scale).toFixed(scale)).toBe(expected);
  });

  it('es idempotente sobre un valor ya redondeado', () => {
    const once = roundHalfUp('1234.5678', MONEY_SCALE);
    expect(roundHalfUp(once, MONEY_SCALE).toFixed(MONEY_SCALE)).toBe(once.toFixed(MONEY_SCALE));
  });

  it('conserva la escala declarada para tasas', () => {
    expect(roundHalfUp('15.6666665', RATE_SCALE).toFixed(RATE_SCALE)).toBe('15.666667');
  });

  it('rechaza un number de JavaScript: el valor ya viene manchado', () => {
    expect(() => roundHalfUp(0.1 + 0.2, 2)).toThrow(DomainError);
  });

  it('rechaza una escala negativa o no entera', () => {
    expect(() => roundHalfUp('1.00', -1)).toThrow(DomainError);
    expect(() => roundHalfUp('1.00', 1.5)).toThrow(DomainError);
  });

  it('rechaza un valor que no es numérico', () => {
    expect(() => roundHalfUp('doce', 2)).toThrow(DomainError);
  });
});

describe('money', () => {
  it('redondea a 2 decimales al construirse', () => {
    expect(money('1234.5678', 'VES').amount).toBe('1234.57');
  });

  it('acepta bigint y Decimal, no solo texto', () => {
    expect(money(1235n, 'VES').amount).toBe('1235.00');
  });

  it('rechaza number de JavaScript en el constructor', () => {
    // El tipo ya lo prohíbe; el cast demuestra que la defensa también existe en runtime,
    // para quien llame desde JavaScript o pase el resultado de un `JSON.parse` sin validar.
    expect(() => money(1234.56 as unknown as MoneyInput, 'VES')).toThrow(DomainError);
  });

  it('rechaza el número que llega de un JSON sin validar', () => {
    const desdeJson = JSON.parse('{"amount": 1234.56}') as { amount: number };
    expect(() => money(desdeJson.amount as unknown as MoneyInput, 'VES')).toThrow(DomainError);
  });

  it('rechaza una moneda desconocida', () => {
    expect(() => money('1.00', 'EUR' as 'VES')).toThrow(DomainError);
  });

  it('rechaza un importe con más de 20 dígitos enteros', () => {
    expect(() => money('9'.repeat(21), 'VES')).toThrow(DomainError);
  });

  it('acepta el cero con moneda', () => {
    expect(zero('USD')).toEqual({ amount: '0.00', currency: 'USD' });
  });

  it('es inmutable: sumar devuelve un objeto nuevo', () => {
    const base = money('100.00', 'VES');
    const resultado = add(base, money('0.50', 'VES'));
    expect(resultado).not.toBe(base);
    expect(base.amount).toBe('100.00');
    expect(resultado.amount).toBe('100.50');
  });

  it('no suma dos monedas distintas', () => {
    expect(() => add(money('1.00', 'VES'), money('1.00', 'USD'))).toThrow(DomainError);
  });

  it('suma una lista vacía en cero con la moneda indicada', () => {
    expect(sum([], 'VES')).toEqual({ amount: '0.00', currency: 'VES' });
  });

  it('suma reduce en una sola moneda sin perder centavos', () => {
    const lista = [money('0.10', 'USD'), money('0.20', 'USD'), money('0.05', 'USD')];
    expect(sum(lista, 'USD').amount).toBe('0.35');
  });

  it('multiplica por un factor exacto', () => {
    expect(multiply(money('100.00', 'VES'), '1.5').amount).toBe('150.00');
  });

  it('multiplica redondeando el resultado, no el factor', () => {
    expect(multiply(money('33.33', 'VES'), '3').amount).toBe('99.99');
  });

  it('exporta el importe como texto para numeric(20,2)', () => {
    expect(toDbAmount(money('0.10', 'USD'))).toBe('0.10');
    expect(toDbAmount(money('7', 'VES'))).toBe('7.00');
  });
});

describe('formatMoney', () => {
  it('usa el formato de Venezuela, con el símbolo que decide Intl', () => {
    expect(formatMoney(money('1234.56', 'USD'))).toContain('1.234,56');
  });

  it('permite especificar un locale alternativo', () => {
    expect(formatMoney(money('1234.56', 'USD'), 'en-US')).toContain('1,234.56');
  });

  it('conserva la precisión de un importe que un number no aguantaría', () => {
    // Evidencia del ADR-0011: 18 dígitos enteros no caben en el doble de JavaScript, pero
    // sí en `numeric(20,2)`, y `Intl` formatea el texto sin perderlos.
    expect(formatMoney(money('999999999999999999.99', 'USD'))).toContain('999.999.999.999.999.999,99');
  });

  it('acepta el máximo de numeric(20,2) y rechaza un dígito más', () => {
    expect(money('999999999999999999.99', 'VES').amount).toBe('999999999999999999.99');
    expect(() => money('9999999999999999999.99', 'VES')).toThrow(DomainError);
  });
});

describe('applyRate', () => {
  it('interpreta la tasa en la unidad en que se expresa, no como fracción', () => {
    expect(applyRate(money('1000.00', 'VES'), rate('14.5')).amount).toBe('145.00');
  });

  it('aplica una tasa de retención y descuenta del neto', () => {
    const base = money('1000.00', 'VES');
    const retencion = applyRate(base, rate('1.5'));
    expect(retencion.amount).toBe('15.00');
    expect(multiply(base, '0.985').amount).toBe('985.00');
  });

  it('redondea a 2 decimales el resultado de una tasa con decimales', () => {
    // 1234.56 x 15.666667 % = 193.4144041152 → 193.41 al acreditar
    expect(applyRate(money('1234.56', 'USD'), rate('15.666667')).amount).toBe('193.41');
  });

  it('rechaza una tasa negativa', () => {
    expect(() => rate('-1.5')).toThrow(DomainError);
  });

  it('conserva 6 decimales en la tasa', () => {
    expect(rate('15.6666665').value).toBe('15.666667');
  });

  it('una tasa de cero produce un monto cero con la misma moneda', () => {
    const resultado = applyRate(money('100.00', 'USD'), rate('0'));
    expect(resultado).toEqual({ amount: '0.00', currency: 'USD' });
  });
});

describe('subtract', () => {
  it('resta dos montos de la misma moneda', () => {
    const a = money('100.50', 'VES');
    const b = money('40.20', 'VES');
    expect(subtract(a, b)).toEqual({ amount: '60.30', currency: 'VES' });
  });

  it('permite resultados negativos si corresponde', () => {
    const a = money('50.00', 'USD');
    const b = money('80.00', 'USD');
    expect(subtract(a, b)).toEqual({ amount: '-30.00', currency: 'USD' });
  });

  it('rechaza restar monedas distintas', () => {
    expect(() => subtract(money('100.00', 'VES'), money('10.00', 'USD'))).toThrow(DomainError);
  });
});

describe('divide', () => {
  it('divide un monto entre un divisor entero o decimal', () => {
    const sueldo = money('3000.00', 'VES');
    // Salario diario mensual / 30
    expect(divide(sueldo, '30')).toEqual({ amount: '100.00', currency: 'VES' });
    // Salario por hora diaria 8h
    expect(divide(money('100.00', 'VES'), '8')).toEqual({ amount: '12.50', currency: 'VES' });
  });

  it('rechaza división por cero', () => {
    expect(() => divide(money('100.00', 'VES'), '0')).toThrow(DomainError);
    expect(() => divide(money('100.00', 'VES'), 0n)).toThrow(DomainError);
  });
});

describe('comparaciones y predicados', () => {
  const m100 = money('100.00', 'VES');
  const m100_dup = money('100.00', 'VES');
  const m50 = money('50.00', 'VES');
  const mZero = money('0.00', 'VES');
  const mNeg = money('-10.00', 'VES');
  const usd100 = money('100.00', 'USD');

  it('equals verifica igualdad de monto y moneda', () => {
    expect(equals(m100, m100_dup)).toBe(true);
    expect(equals(m100, m50)).toBe(false);
    expect(equals(m100, usd100)).toBe(false);
  });

  it('greaterThan y lessThan comparan montos de la misma moneda', () => {
    expect(greaterThan(m100, m50)).toBe(true);
    expect(greaterThan(m50, m100)).toBe(false);
    expect(lessThan(m50, m100)).toBe(true);
    expect(lessThan(m100, m50)).toBe(false);
    expect(() => greaterThan(m100, usd100)).toThrow(DomainError);
    expect(() => lessThan(m100, usd100)).toThrow(DomainError);
  });

  it('greaterThanOrEqual y lessThanOrEqual', () => {
    expect(greaterThanOrEqual(m100, m100_dup)).toBe(true);
    expect(greaterThanOrEqual(m100, m50)).toBe(true);
    expect(greaterThanOrEqual(m50, m100)).toBe(false);
    expect(lessThanOrEqual(m100, m100_dup)).toBe(true);
    expect(lessThanOrEqual(m50, m100)).toBe(true);
    expect(lessThanOrEqual(m100, m50)).toBe(false);
    expect(() => greaterThanOrEqual(m100, usd100)).toThrow(DomainError);
    expect(() => lessThanOrEqual(m100, usd100)).toThrow(DomainError);
  });

  it('predicados de signo: isZero, isPositive, isNegative', () => {
    expect(isZero(mZero)).toBe(true);
    expect(isZero(m100)).toBe(false);
    expect(isPositive(m100)).toBe(true);
    expect(isPositive(mZero)).toBe(false);
    expect(isPositive(mNeg)).toBe(false);
    expect(isNegative(mNeg)).toBe(true);
    expect(isNegative(mZero)).toBe(false);
    expect(isNegative(m100)).toBe(false);
  });

  it('abs calcula el valor absoluto', () => {
    expect(abs(mNeg)).toEqual({ amount: '10.00', currency: 'VES' });
    expect(abs(m100)).toEqual({ amount: '100.00', currency: 'VES' });
  });

  it('min y max obtienen el extremo de una lista', () => {
    expect(min(m100, m50, mNeg)).toEqual(mNeg);
    expect(max(m100, m50, mNeg)).toEqual(m100);
    expect(() => min()).toThrow(DomainError);
    expect(() => max()).toThrow(DomainError);
  });
});

describe('casos borde de toDecimal y formatScaled', () => {
  it('toDecimal rechaza valores no texto o vacíos', () => {
    expect(() => toDecimal('', 'importe_invalido')).toThrow(DomainError);
    expect(() => toDecimal('   ', 'importe_invalido')).toThrow(DomainError);
    expect(() => toDecimal(null, 'importe_invalido')).toThrow(DomainError);
    expect(() => toDecimal(undefined, 'importe_invalido')).toThrow(DomainError);
    expect(() => toDecimal({}, 'importe_invalido')).toThrow(DomainError);
    expect(() => toDecimal('12.34.56', 'importe_invalido')).toThrow(DomainError);
  });

  it('toDecimal acepta Decimal directamente', () => {
    const d = Decimal('42.50');
    expect(toDecimal(d, 'importe_invalido')).toBe(d);
  });

  it('formatScaled maneja cero y escala 0', () => {
    expect(formatScaled(Decimal(0), 0)).toBe('0');
    expect(formatScaled(Decimal(0), 2)).toBe('0.00');
    expect(formatScaled(Decimal('15.00'), 0)).toBe('15');
    expect(formatScaled(Decimal('-0.50'), 2)).toBe('-0.50');
  });

  it('formatScaled rechaza números con notación exponencial', () => {
    const mocked = Object.create(Decimal('100'));
    mocked.toDecimalPlaces = () => ({
      isZero: () => false,
      toString: () => '1e+25',
      isNegative: () => false,
    });
    expect(() => formatScaled(mocked as unknown as Decimal, 2)).toThrow(DomainError);
  });
});
