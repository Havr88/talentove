import { Decimal } from 'decimal.js';

import { DomainError } from './errors.js';
import type { DomainErrorCode } from './errors.js';

/** Escala de los montos: `numeric(20,2)`. */
export const MONEY_SCALE = 2;
/** Escala de tasas y cantidades: `numeric(20,6)`. */
export const RATE_SCALE = 6;
/** Escala de los identificadores de personas. */
export const ID_SCALE = 0;

/** `numeric(20,2)`: 20 dígitos en total, de los cuales 2 son decimales → 18 enteros. */
const MAX_TOTAL_DIGITS = 20;

/**
 * Tipo de instancia de `decimal.js`. La librería fusiona clase y namespace, así que el
 * import por defecto no sirve ni como tipo ni como constructor: se importa el símbolo
 * nombrado y se usa la fábrica (`Decimal('1.5')`), que es la forma que declara.
 */
export type Dec = Decimal;
export type DecimalInput = string | bigint | Dec;

/**
 * Rechaza `number` de JavaScript a propósito (ADR-0011): en ese punto el valor ya
 * perdió precisión y es mejor que el código truene a que el error se propague.
 */
export function toDecimal(value: unknown, code: DomainErrorCode): Dec {
  if (typeof value === 'number') {
    throw new DomainError(code, 'No se acepta un número de JavaScript: use texto, bigint o Decimal');
  }
  if (typeof value === 'bigint') return Decimal(value.toString());
  if (Decimal.isDecimal(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError(code, 'El valor debe ser un texto numérico');
  }
  const limpio = value.trim().replace(/,/g, '');
  if (!/^[+-]?\d+(\.\d+)?$/.test(limpio)) {
    throw new DomainError(code, `Valor no numérico: ${value}`);
  }
  return Decimal(limpio);
}

/** Redondeo único del dominio: *half away from zero* (ADR-0011). */
export function roundHalfUp(value: unknown, scale: number): Dec {
  if (!Number.isInteger(scale) || scale < 0) {
    throw new DomainError('escala_invalida', 'La escala debe ser un entero no negativo', { scale });
  }
  return toDecimal(value, 'importe_invalido').toDecimalPlaces(scale, Decimal.ROUND_HALF_UP);
}

/** `numeric(20,2)` no admite más de 18 dígitos enteros: fallar aquí, no al insertar. */
export function assertFitsPrecision(value: Dec, scale: number): void {
  // El exponente de la cifra más significativa da los dígitos enteros, que es lo que
  // limita `numeric(20,escala)`; contar dígitos significativos contaría también los decimales.
  const exponente = value.abs().e;
  const digitosEnteros = Number.isFinite(exponente) ? Math.max(0, exponente + 1) : 0;
  if (digitosEnteros > MAX_TOTAL_DIGITS - scale) {
    throw new DomainError('escala_fuera_de_rango', `El importe excede numeric(${MAX_TOTAL_DIGITS},${scale})`, {
      precision: `numeric(${MAX_TOTAL_DIGITS},${scale})`,
    });
  }
}

/** Representación de texto a escala fija, sin `toFixed` ni coma flotante. */
export function formatScaled(value: Dec, scale: number): string {
  const redondeado = value.toDecimalPlaces(scale, Decimal.ROUND_HALF_UP);
  if (redondeado.isZero()) return scale === 0 ? '0' : `0.${'0'.repeat(scale)}`;
  const texto = redondeado.toString();
  if (/[eE]/.test(texto)) {
    throw new DomainError('importe_invalido', 'Exponente inesperado en la representación decimal', { texto });
  }
  const [entero, decimales = ''] = texto.replace('-', '').split('.');
  const signo = redondeado.isNegative() ? '-' : '';
  const enteros = (entero ?? '0').length === 0 ? '0' : (entero ?? '0');
  return scale === 0
    ? `${signo}${enteros}`
    : `${signo}${enteros}.${decimales.padEnd(scale, '0')}`;
}

/** Redondea a la escala indicada y verifica que quepa en `numeric(20,2)`. */
export function toScale(value: Dec, scale: number): Dec {
  const redondeado = value.toDecimalPlaces(scale, Decimal.ROUND_HALF_UP);
  assertFitsPrecision(redondeado, scale);
  return redondeado;
}
