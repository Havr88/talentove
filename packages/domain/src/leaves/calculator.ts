import { DomainError } from '../errors.js';
import type {
  LeaveDayDetail,
  LeaveType,
  LeaveStatus,
  VacationEntitlement,
  WorkerVacationBalance,
} from './types.js';

/**
 * Calcula los días de vacaciones y bono vacacional según los Artículos 190 y 192 de la LOTTT.
 * Base primer año: 15 días hábiles.
 * Adicional: +1 día por cada año sucesivo hasta un tope máximo de 30 días.
 */
export function calculateVacationEntitlement(yearsOfService: number): VacationEntitlement {
  if (yearsOfService < 1) {
    return {
      yearsOfService,
      vacationDays: 0,
      bonusDays: 0,
    };
  }

  const additionalDays = Math.floor(yearsOfService) - 1;
  const vacationDays = Math.min(15 + additionalDays, 30);
  const bonusDays = Math.min(15 + additionalDays, 30);

  return {
    yearsOfService: Math.floor(yearsOfService),
    vacationDays,
    bonusDays,
  };
}

/**
 * Genera el desglose diario de un permiso/vacación clasificando días hábiles y feriados.
 * Implementa la separación granular diaria inspirada en IceHrm.
 */
export function breakDownLeavePeriod(
  startDateStr: string,
  endDateStr: string,
  holidays: readonly string[] = []
): readonly LeaveDayDetail[] {
  const start = new Date(`${startDateStr}T00:00:00Z`);
  const end = new Date(`${endDateStr}T00:00:00Z`);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new DomainError('fecha_invalida', 'Formato de fecha inválido en el período de permiso.');
  }

  if (start.getTime() > end.getTime()) {
    throw new DomainError('periodo_invalido', 'La fecha de inicio no puede ser posterior a la de fin.');
  }

  const holidaySet = new Set(holidays);
  const details: LeaveDayDetail[] = [];
  const current = new Date(start);

  while (current.getTime() <= end.getTime()) {
    const isoDate = current.toISOString().slice(0, 10);
    const dayOfWeek = current.getUTCDay(); // 0 = Domingo, 6 = Sábado
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidaySet.has(isoDate);
    const isBusinessDay = !isWeekend && !isHoliday;

    details.push({
      date: isoDate,
      fraction: 'COMPLETO',
      isBusinessDay,
      isHoliday,
      dayCount: isBusinessDay ? 1 : 0,
    });

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return Object.freeze(details);
}

/**
 * Calcula la fecha esperada de reintegro laboral (siguiente día hábil tras la finalización).
 */
export function calculateReturnDate(
  endDateStr: string,
  holidays: readonly string[] = []
): string {
  const holidaySet = new Set(holidays);
  const current = new Date(`${endDateStr}T00:00:00Z`);
  current.setUTCDate(current.getUTCDate() + 1);

  while (true) {
    const dayOfWeek = current.getUTCDay();
    const isoDate = current.toISOString().slice(0, 10);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidaySet.has(isoDate);

    if (!isWeekend && !isHoliday) {
      return isoDate;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
}

/**
 * Computa el balance de vacaciones de un trabajador deduciendo días gozados y pendientes.
 */
export function calculateVacationBalance(
  workerId: string,
  yearsOfService: number,
  daysTaken: number,
  daysPending: number
): WorkerVacationBalance {
  const entitlement = calculateVacationEntitlement(yearsOfService);
  const daysAvailable = Math.max(0, entitlement.vacationDays - daysTaken - daysPending);

  return {
    workerId,
    yearsOfService: entitlement.yearsOfService,
    entitlementDays: entitlement.vacationDays,
    bonusDays: entitlement.bonusDays,
    daysTaken,
    daysPending,
    daysAvailable,
  };
}
