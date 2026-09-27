import { DomainError } from '../errors.js';

/** Zona operativa única de la instalación (ADR-0010). */
export const CARACAS = 'America/Caracas';

const cache = new Map<string, Intl.DateTimeFormat>();

/**
 * `Intl` acepta identificadores de desplazamiento (`-04:00`), que es justo lo que
 * ADR-0010 prohíbe: un offset escrito a mano queda obsoleto en el próximo cambio
 * de zona y nadie se entera. Por eso se rechazan antes de consultar IANA.
 */
const OFFSET_ESTILO = /^([+-])?\d{1,2}(:?\d{2})?$/;

/** Valida que la zona exista en la base de zonas de IANA; falla rápido al arrancar. */
export function assertValidTimeZone(timeZone: string): void {
  if (timeZone.trim() === '') {
    throw new DomainError('zona_horaria_invalida', 'La zona horaria no puede estar vacía');
  }
  if (OFFSET_ESTILO.test(timeZone.trim())) {
    throw new DomainError(
      'zona_horaria_invalida',
      `Use un nombre de zona IANA, no el desplazamiento ${timeZone}`,
      { timeZone },
    );
  }
  try {
    formatInZone(timeZone);
  } catch {
    throw new DomainError('zona_horaria_invalida', `Zona horaria desconocida: ${timeZone}`, {
      timeZone,
    });
  }
}

export function formatInZone(timeZone: string, instante: Date = new Date()): Intl.DateTimeFormat {
  const existente = cache.get(timeZone);
  if (existente) return existente;
  const formato = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  cache.set(timeZone, formato);
  return formato;
}

export interface ZoneParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

/** Descompone un instante en sus piezas de calendario dentro de la zona indicada. */
export function zoneParts(instante: Date, timeZone: string): ZoneParts {
  const piezas: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const { type, value } of formatInZone(timeZone).formatToParts(instante)) piezas[type] = value;
  return {
    year: entero(piezas.year),
    month: entero(piezas.month),
    day: entero(piezas.day),
    hour: entero(piezas.hour),
    minute: entero(piezas.minute),
    second: entero(piezas.second),
  };
}

function entero(valor: string | undefined): number {
  return valor === undefined ? Number.NaN : Number.parseInt(valor, 10);
}
