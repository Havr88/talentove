import { DomainError } from '../errors.js';
import { assertValidTimeZone, zoneParts } from './timezone.js';

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;
const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export type LocalDate = string;
export type LocalTime = string;

export interface DateRange {
  readonly start: LocalDate;
  readonly end: LocalDate;
}

function esBisiesto(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return month === 2 && esBisiesto(year) ? 29 : (DIAS_POR_MES[month - 1] ?? 0);
}

/** Descompone y valida una fecha local; rechaza `2026-02-30` y `2026-13-01`. */
function parseLocalDate(date: LocalDate): { year: number; month: number; day: number } {
  const coincidencia = FECHA.exec(date);
  if (!coincidencia) {
    throw new DomainError('fecha_invalida', `Fecha inválida: ${date}`, { date });
  }
  const year = Number.parseInt(coincidencia[1] ?? '', 10);
  const month = Number.parseInt(coincidencia[2] ?? '', 10);
  const day = Number.parseInt(coincidencia[3] ?? '', 10);
  const limite = daysInMonth(year, month);
  if (limite === 0 || day < 1 || day > limite) {
    throw new DomainError('fecha_invalida', `Fecha inexistente: ${date}`, { date });
  }
  return { year, month, day };
}

function pad(valor: number, largo = 2): string {
  return String(valor).padStart(largo, '0');
}

/** Instante → día local de la zona indicada. Nunca usa la zona del proceso. */
export function toLocalDate(instante: Date, timeZone: string): LocalDate {
  assertValidTimeZone(timeZone);
  const { year, month, day } = zoneParts(instante, timeZone);
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Desplazamiento de la zona, en milisegundos, para un instante dado. */
function zoneOffsetMs(instante: Date, timeZone: string): number {
  const { year, month, day, hour, minute, second } = zoneParts(instante, timeZone);
  const comoUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return comoUtc - Math.trunc(instante.getTime() / 1000) * 1000;
}

/** Fecha y hora locales → instante. Reconstruye el offset en dos pasos (evita el borde). */
export function localDateTimeToInstant(date: LocalDate, time: LocalTime, timeZone: string): Date {
  assertValidTimeZone(timeZone);
  const { year, month, day } = parseLocalDate(date);
  const coincidencia = HORA.exec(time);
  if (!coincidencia) {
    throw new DomainError('hora_invalida', `Hora inválida: ${time}`, { time });
  }
  const hour = Number.parseInt(coincidencia[1] ?? '', 10);
  const minute = Number.parseInt(coincidencia[2] ?? '', 10);
  const second = Number.parseInt(coincidencia[3] ?? '0', 10);
  if (hour > 23 || minute > 59 || second > 59) {
    throw new DomainError('hora_invalida', `Hora inexistente: ${time}`, { time });
  }
  const suposición = Date.UTC(year, month - 1, day, hour, minute, second);
  let instante = new Date(suposición - zoneOffsetMs(new Date(suposición), timeZone));
  instante = new Date(suposición - zoneOffsetMs(instante, timeZone));
  return instante;
}

/** Suma días de calendario; no toca la zona porque solo hay fecha. */
export function addDays(date: LocalDate, days: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  const desplazado = new Date(Date.UTC(year, month - 1, day + days));
  return `${pad(desplazado.getUTCFullYear(), 4)}-${pad(desplazado.getUTCMonth() + 1)}-${pad(
    desplazado.getUTCDate(),
  )}`;
}

/** Diferencia por días de calendario, no por 86400 segundos (ADR-0010). */
export function diffCalendarDays(desde: LocalDate, hasta: LocalDate): number {
  const a = parseLocalDate(desde);
  const b = parseLocalDate(hasta);
  const diasA = Date.UTC(a.year, a.month - 1, a.day);
  const diasB = Date.UTC(b.year, b.month - 1, b.day);
  return Math.trunc((diasB - diasA) / 86_400_000);
}

/** El turno que cruza medianoche pertenece al día de inicio (ADR-0010). */
export function shiftDate(inicio: Date, fin: Date, timeZone: string): LocalDate {
  if (fin.getTime() < inicio.getTime()) {
    throw new DomainError('turno_invalido', 'El turno termina antes de empezar', {
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
    });
  }
  return toLocalDate(inicio, timeZone);
}

/** Quincena 1 (1–15) o 2 (16–fin de mes) en fechas locales. */
export function payPeriodRange(year: number, month: number, half: 1 | 2): DateRange {
  const ultimo = daysInMonth(year, month);
  if (ultimo === 0 || half !== 1 && half !== 2) {
    throw new DomainError('periodo_invalido', 'Período de pago inválido', { year, month, half });
  }
  return half === 1
    ? { start: `${pad(year, 4)}-${pad(month)}-01`, end: `${pad(year, 4)}-${pad(month)}-${pad(15)}` }
    : { start: `${pad(year, 4)}-${pad(month)}-16`, end: `${pad(year, 4)}-${pad(month)}-${pad(ultimo)}` };
}

/** Formato de interfaz: `dd/mm/aaaa`. */
export function formatDateEsVE(date: LocalDate): string {
  const { year, month, day } = parseLocalDate(date);
  return `${pad(day)}/${pad(month)}/${pad(year, 4)}`;
}

/**
 * Día de la semana (0 = domingo, 1 = lunes, ..., 6 = sábado).
 * Basado en UTC puro sin tocar la zona horaria del proceso (ADR-0010).
 */
export function dayOfWeek(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Determina si una fecha local corresponde a fin de semana (sábado o domingo). */
export function isWeekend(date: LocalDate): boolean {
  const d = dayOfWeek(date);
  return d === 0 || d === 6;
}

/**
 * Determina si una fecha local es día hábil según LOTTT (no es fin de semana ni feriado).
 */
export function isBusinessDay(date: LocalDate, holidays: readonly LocalDate[] = []): boolean {
  if (isWeekend(date)) return false;
  return !holidays.includes(date);
}

/**
 * Cuenta los días hábiles entre dos fechas locales [desde, hasta] inclusive (LOTTT Art. 190).
 */
export function countBusinessDays(desde: LocalDate, hasta: LocalDate, holidays: readonly LocalDate[] = []): number {
  const diff = diffCalendarDays(desde, hasta);
  if (diff < 0) {
    throw new DomainError('periodo_invalido', 'La fecha inicial no puede ser posterior a la fecha final', {
      desde,
      hasta,
    });
  }
  let habiles = 0;
  for (let i = 0; i <= diff; i++) {
    const dia = addDays(desde, i);
    if (isBusinessDay(dia, holidays)) {
      habiles++;
    }
  }
  return habiles;
}

/**
 * Suma días hábiles a una fecha local, saltando fines de semana y feriados.
 */
export function addBusinessDays(date: LocalDate, count: number, holidays: readonly LocalDate[] = []): LocalDate {
  if (!Number.isInteger(count) || count < 0) {
    throw new DomainError('periodo_invalido', 'La cantidad de días hábiles a sumar debe ser un entero no negativo', {
      count,
    });
  }
  let actual = date;
  let restantes = count;
  while (restantes > 0) {
    actual = addDays(actual, 1);
    if (isBusinessDay(actual, holidays)) {
      restantes--;
    }
  }
  return actual;
}
