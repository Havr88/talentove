import { DomainError } from '../errors.js';
import { formatScaled, toDecimal, toScale, RATE_SCALE } from '../numeric.js';
import { divide, money, multiply } from './money.js';
import type { CurrencyCode, Money, MoneyInput } from './money.js';

export type RateSource = 'BCV' | 'MANUAL' | 'DEFAULT' | 'API';

export interface ExchangeRate {
  readonly rate: string;
  readonly source: RateSource;
  readonly fetchedAt: string;
  readonly notes?: string;
}

/**
 * Convierte un monto de una moneda a otra aplicando una tasa de cambio (Bs/USD).
 * La tasa se interpreta siempre como Bs por 1 USD (convención venezolana del BCV).
 */
export function convert(m: Money, toCurrency: CurrencyCode, rateInput: MoneyInput): Money {
  if (m.currency === toCurrency) {
    return m;
  }

  const tasaDec = toDecimal(rateInput, 'tasa_invalida');
  if (tasaDec.isNegative() || tasaDec.isZero()) {
    throw new DomainError('tasa_invalida', 'La tasa de cambio debe ser un valor positivo mayor a cero', {
      rate: formatScaled(tasaDec, 6),
    });
  }

  if (m.currency === 'USD' && toCurrency === 'VES') {
    return money(toDecimal(m.amount, 'importe_invalido').times(tasaDec), 'VES');
  }

  if (m.currency === 'VES' && toCurrency === 'USD') {
    return divide(money(m.amount, 'USD'), tasaDec);
  }

  throw new DomainError('operacion_entre_monedas', `Conversión no soportada entre ${m.currency} y ${toCurrency}`);
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

/**
 * Parsea y valida de forma pura la respuesta de ve.dolarapi.com/v1/dolares/oficial (BCV).
 * No realiza I/O; valida el contrato del payload externo antes de persistir.
 */
export function parseDolarApiResponse(payload: unknown, ahora: string = new Date().toISOString()): ExchangeRate {
  if (!esObjeto(payload)) {
    throw new DomainError('tasa_invalida', 'El payload de la API de tasas debe ser un objeto');
  }

  const promedio = payload.promedio;
  if (promedio === undefined || promedio === null) {
    throw new DomainError('tasa_invalida', 'La respuesta de la API no contiene el campo promedio');
  }

  const tasaTexto = typeof promedio === 'number' || typeof promedio === 'string'
    ? String(promedio)
    : '';

  if (tasaTexto.trim() === '') {
    throw new DomainError('tasa_invalida', 'El campo promedio no tiene un formato numérico válido');
  }

  const tasaDec = toDecimal(tasaTexto, 'tasa_invalida');
  if (tasaDec.isNegative() || tasaDec.isZero()) {
    throw new DomainError('tasa_invalida', 'La tasa devuelta por la API debe ser estrictamente positiva');
  }

  const fechaActualizacion = typeof payload.fechaActualizacion === 'string' && payload.fechaActualizacion.trim() !== ''
    ? payload.fechaActualizacion
    : ahora;

  return {
    rate: formatScaled(toScale(tasaDec, RATE_SCALE), RATE_SCALE),
    source: 'BCV',
    fetchedAt: fechaActualizacion,
    notes: `Sincronizado vía DolarAPI Oficial (${fechaActualizacion})`,
  };
}
