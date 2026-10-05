import { Decimal } from 'decimal.js';
import { roundHalfUp } from '../numeric.js';
import type {
  OvertimeCategory,
  OvertimeRequest,
  OvertimeCalculationResult,
} from './types.js';

/**
 * Retorna el factor multiplicador del valor por hora según la LOTTT.
 */
export function getOvertimeMultiplier(category: OvertimeCategory): number {
  switch (category) {
    case 'DIURNA':
      // Art. 118 LOTTT: 50% de recargo sobre hora ordinaria
      return 1.5;
    case 'NOCTURNA':
      // Art. 117 + 118 LOTTT: 30% nocturno * 50% horas extras = 1.95
      return 1.95;
    case 'FERIADO_DESCANSO':
      // Art. 119 y 120 LOTTT: 50% de recargo por trabajar en día feriado/descanso
      return 1.5;
    case 'BONO_NOCTURNO_ORDINARIO':
      // Art. 117 LOTTT: Prima adicional del 30% de la hora ordinaria
      return 0.3;
    default:
      return 1.0;
  }
}

/**
 * Calcula las horas efectivas de una solicitud dentro de una ventana de período de nómina.
 * Algoritmo refinado a partir de OvertimePayrollUtils de IceHrm.
 */
export function calculateEffectiveHoursInWindow(
  startIso: string,
  endIso: string,
  windowStartIso: string,
  windowEndIso: string
): number {
  const reqStart = new Date(startIso).getTime();
  const reqEnd = new Date(endIso).getTime();
  const winStart = new Date(windowStartIso).getTime();
  const winEnd = new Date(windowEndIso).getTime();

  if (isNaN(reqStart) || isNaN(reqEnd) || isNaN(winStart) || isNaN(winEnd)) {
    return 0;
  }

  const effectiveStart = Math.max(reqStart, winStart);
  const effectiveEnd = Math.min(reqEnd, winEnd);

  const durationMs = effectiveEnd - effectiveStart;
  if (durationMs <= 0) {
    return 0;
  }

  const hours = Decimal(durationMs).dividedBy(3600000);
  return roundHalfUp(hours.toString(), 2).toNumber();
}

/**
 * Calcula el pago acumulado de horas extras agrupado por categoría para la liquidación de nómina.
 */
export function calculateOvertimePayroll(
  requests: readonly OvertimeRequest[],
  baseHourlyRate: number
): OvertimeCalculationResult {
  const hoursByCategory: Record<OvertimeCategory, number> = {
    DIURNA: 0,
    NOCTURNA: 0,
    FERIADO_DESCANSO: 0,
    BONO_NOCTURNO_ORDINARIO: 0,
  };

  const payByCategory: Record<OvertimeCategory, number> = {
    DIURNA: 0,
    NOCTURNA: 0,
    FERIADO_DESCANSO: 0,
    BONO_NOCTURNO_ORDINARIO: 0,
  };

  let totalHoursDec = Decimal(0);
  let totalPayDec = Decimal(0);

  for (const req of requests) {
    if (req.status !== 'APROBADO') {
      continue;
    }

    const mult = getOvertimeMultiplier(req.category);
    const hourlyPayDec = roundHalfUp(Decimal(baseHourlyRate).times(mult).toString(), 2);
    const amountDec = roundHalfUp(Decimal(req.hours).times(hourlyPayDec).toString(), 2);

    hoursByCategory[req.category] = Decimal(hoursByCategory[req.category]).plus(req.hours).toNumber();
    payByCategory[req.category] = Decimal(payByCategory[req.category]).plus(amountDec).toNumber();

    totalHoursDec = totalHoursDec.plus(req.hours);
    totalPayDec = totalPayDec.plus(amountDec);
  }

  return {
    totalHours: totalHoursDec.toNumber(),
    hoursByCategory,
    payByCategory,
    totalOvertimePay: totalPayDec.toNumber(),
  };
}
