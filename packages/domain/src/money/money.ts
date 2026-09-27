import { DomainError } from '../errors.js';
import { MONEY_SCALE, RATE_SCALE, formatScaled, toDecimal, toScale } from '../numeric.js';
import type { Dec } from '../numeric.js';

const MONEDAS = ['VES', 'USD'] as const;

export type CurrencyCode = (typeof MONEDAS)[number];

/** Montos: inmutable, con escala de 2 decimales y moneda obligatoria (ADR-0011). */
export interface Money {
  readonly amount: string;
  readonly currency: CurrencyCode;
}

export type MoneyInput = string | bigint | Dec;

function assertCurrency(currency: string): asserts currency is CurrencyCode {
  if (!MONEDAS.includes(currency as CurrencyCode)) {
    throw new DomainError('moneda_invalida', `Moneda no soportada: ${currency}`, {
      soportadas: MONEDAS.join(', '),
    });
  }
}

/** Construye un monto redondeando a 2 decimales (*half away from zero*). */
export function money(value: MoneyInput, currency: CurrencyCode): Money {
  assertCurrency(currency);
  return { amount: formatScaled(toScale(toDecimal(value, 'importe_invalido'), MONEY_SCALE), MONEY_SCALE), currency };
}

export function zero(currency: CurrencyCode): Money {
  return money(0n, currency);
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new DomainError('operacion_entre_monedas', `No se puede operar ${a.currency} con ${b.currency}`, {
      izquierda: a.currency,
      derecha: b.currency,
    });
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(toDecimal(a.amount, 'importe_invalido').plus(toDecimal(b.amount, 'importe_invalido')), a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(toDecimal(a.amount, 'importe_invalido').minus(toDecimal(b.amount, 'importe_invalido')), a.currency);
}

export function sum(items: readonly Money[], currency: CurrencyCode): Money {
  return items.reduce<Money>((total, item) => add(total, item), zero(currency));
}

export function multiply(m: Money, factor: MoneyInput): Money {
  return money(toDecimal(m.amount, 'importe_invalido').times(toDecimal(factor, 'importe_invalido')), m.currency);
}

export function divide(m: Money, divisor: MoneyInput): Money {
  const div = toDecimal(divisor, 'importe_invalido');
  if (div.isZero()) {
    throw new DomainError('importe_invalido', 'No se puede dividir un monto por cero');
  }
  return money(toDecimal(m.amount, 'importe_invalido').div(div), m.currency);
}

export function equals(a: Money, b: Money): boolean {
  return a.currency === b.currency && toDecimal(a.amount, 'importe_invalido').equals(toDecimal(b.amount, 'importe_invalido'));
}

export function greaterThan(a: Money, b: Money): boolean {
  assertSameCurrency(a, b);
  return toDecimal(a.amount, 'importe_invalido').greaterThan(toDecimal(b.amount, 'importe_invalido'));
}

export function lessThan(a: Money, b: Money): boolean {
  assertSameCurrency(a, b);
  return toDecimal(a.amount, 'importe_invalido').lessThan(toDecimal(b.amount, 'importe_invalido'));
}

export function greaterThanOrEqual(a: Money, b: Money): boolean {
  assertSameCurrency(a, b);
  return toDecimal(a.amount, 'importe_invalido').greaterThanOrEqualTo(toDecimal(b.amount, 'importe_invalido'));
}

export function lessThanOrEqual(a: Money, b: Money): boolean {
  assertSameCurrency(a, b);
  return toDecimal(a.amount, 'importe_invalido').lessThanOrEqualTo(toDecimal(b.amount, 'importe_invalido'));
}

export function isZero(m: Money): boolean {
  return toDecimal(m.amount, 'importe_invalido').isZero();
}

export function isPositive(m: Money): boolean {
  const d = toDecimal(m.amount, 'importe_invalido');
  return d.isPositive() && !d.isZero();
}

export function isNegative(m: Money): boolean {
  const d = toDecimal(m.amount, 'importe_invalido');
  return d.isNegative() && !d.isZero();
}

export function abs(m: Money): Money {
  return money(toDecimal(m.amount, 'importe_invalido').abs(), m.currency);
}

export function min(...items: readonly Money[]): Money {
  const primero = items[0];
  if (!primero) {
    throw new DomainError('importe_invalido', 'min requiere al menos un monto');
  }
  return items.reduce((menor, item) => (lessThan(item, menor) ? item : menor), primero);
}

export function max(...items: readonly Money[]): Money {
  const primero = items[0];
  if (!primero) {
    throw new DomainError('importe_invalido', 'max requiere al menos un monto');
  }
  return items.reduce((mayor, item) => (greaterThan(item, mayor) ? item : mayor), primero);
}

/** Aplica una tasa expresada en su propia unidad: `14.5` significa 14,5 %. */
export function applyRate(base: Money, r: Rate): Money {
  return multiply(base, toDecimal(r.value, 'tasa_invalida').div(100));
}

/** Tasa legal o parámetro: 6 decimales, nunca hardcodeada en el código (ADR-0011). */
export interface Rate {
  readonly value: string;
}

export function rate(value: MoneyInput): Rate {
  const decimal = toDecimal(value, 'tasa_invalida');
  if (decimal.isNegative() && !decimal.isZero()) {
    throw new DomainError('tasa_invalida', 'Una tasa no puede ser negativa', { value: formatScaled(decimal, 6) });
  }
  return { value: formatScaled(toScale(decimal, RATE_SCALE), RATE_SCALE) };
}

/** Importe en texto para `numeric(20,2)`: el tipo que pg espera y devuelve. */
export function toDbAmount(m: Money): string {
  return formatScaled(toDecimal(m.amount, 'importe_invalido'), MONEY_SCALE);
}

/** Formato de presentación: lo decide `Intl`, no una constante en el código. */
export function formatMoney(m: Money, locale = 'es-VE'): string {
  // `Intl` formatea texto con precisión arbitraria (ToIntlMathematicalValue), mientras
  // que un `number` ya viene con error de coma flotante. El cast es deliberado.
  return new Intl.NumberFormat(locale, { style: 'currency', currency: m.currency }).format(
    m.amount as unknown as number,
  );
}
