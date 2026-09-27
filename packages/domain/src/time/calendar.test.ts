import { describe, expect, it } from 'vitest';

import { CARACAS, assertValidTimeZone } from './timezone.js';
import {
  addBusinessDays,
  addDays,
  countBusinessDays,
  dayOfWeek,
  diffCalendarDays,
  formatDateEsVE,
  isBusinessDay,
  isWeekend,
  localDateTimeToInstant,
  payPeriodRange,
  shiftDate,
  toLocalDate,
} from './calendar.js';
import { DomainError } from '../errors.js';

describe('assertValidTimeZone', () => {
  it('acepta America/Caracas', () => {
    expect(() => assertValidTimeZone(CARACAS)).not.toThrow();
  });

  it('acepta otras zonas IANA', () => {
    expect(() => assertValidTimeZone('Europe/Madrid')).not.toThrow();
  });

  it('rechaza un offset escrito a mano', () => {
    expect(() => assertValidTimeZone('-04:00')).toThrow(DomainError);
  });

  it('rechaza un nombre de zona inventado', () => {
    expect(() => assertValidTimeZone('America/Caracas_1980')).toThrow(DomainError);
  });

  it('rechaza una zona horaria vacía', () => {
    expect(() => assertValidTimeZone('')).toThrow(DomainError);
    expect(() => assertValidTimeZone('   ')).toThrow(DomainError);
  });
});

describe('toLocalDate', () => {
  it('devuelve el día local, no el día UTC', () => {
    const instante = new Date('2026-09-27T03:30:00.000Z');
    expect(toLocalDate(instante, CARACAS)).toBe('2026-09-26');
  });

  it('acota correctamente los dos días de un mismo instante UTC', () => {
    const instante = new Date('2026-09-27T04:30:00.000Z');
    expect(toLocalDate(instante, CARACAS)).toBe('2026-09-27');
  });

  it('no se mueve de día a las 23:59:59 ni a las 00:00:00', () => {
    expect(toLocalDate(new Date('2026-09-28T03:59:59.999Z'), CARACAS)).toBe('2026-09-27');
    expect(toLocalDate(new Date('2026-09-28T04:00:00.000Z'), CARACAS)).toBe('2026-09-28');
  });

  it('mantiene el día en 31 de diciembre y 1 de enero', () => {
    expect(toLocalDate(new Date('2026-12-31T20:00:00.000Z'), CARACAS)).toBe('2026-12-31');
    expect(toLocalDate(new Date('2027-01-01T03:00:00.000Z'), CARACAS)).toBe('2026-12-31');
  });
});

describe('localDateTimeToInstant', () => {
  it('interpreta la hora como hora local de Caracas', () => {
    const instante = localDateTimeToInstant('2026-09-27', '00:00', CARACAS);
    expect(instante.toISOString()).toBe('2026-09-27T04:00:00.000Z');
  });

  it('interpreta las 22:00 del día de inicio del turno', () => {
    expect(localDateTimeToInstant('2026-09-27', '22:00', CARACAS).toISOString()).toBe(
      '2026-09-28T02:00:00.000Z',
    );
  });

  it('interpreta hora con segundos explícitos', () => {
    expect(localDateTimeToInstant('2026-09-27', '08:30:15', CARACAS).toISOString()).toBe(
      '2026-09-27T12:30:15.000Z',
    );
  });

  it('rechaza una fecha imposible', () => {
    expect(() => localDateTimeToInstant('2026-02-30', '08:00', CARACAS)).toThrow(DomainError);
    expect(() => localDateTimeToInstant('2026-13-01', '08:00', CARACAS)).toThrow(DomainError);
  });

  it('rechaza una hora imposible', () => {
    expect(() => localDateTimeToInstant('2026-09-27', '25:00', CARACAS)).toThrow(DomainError);
  });
});

describe('addDays y diffCalendarDays', () => {
  it('suma días cruzando el cambio de mes', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('suma días en año bisiesto', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('resta días hacia atrás cruzando el año', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('diferencia por días de calendario, no por 86400 segundos', () => {
    expect(diffCalendarDays('2026-02-28', '2026-03-01')).toBe(1);
  });

  it('la diferencia es simétrica y con signo', () => {
    expect(diffCalendarDays('2026-01-01', '2026-01-31')).toBe(30);
    expect(diffCalendarDays('2026-01-31', '2026-01-01')).toBe(-30);
  });
});

describe('shiftDate', () => {
  it('un turno que cruza medianoche pertenece al día de inicio', () => {
    const inicio = localDateTimeToInstant('2026-09-27', '22:00', CARACAS);
    const fin = localDateTimeToInstant('2026-09-28', '06:00', CARACAS);
    expect(shiftDate(inicio, fin, CARACAS)).toBe('2026-09-27');
  });

  it('un turno de mañana pertenece a su propio día', () => {
    const inicio = localDateTimeToInstant('2026-09-27', '08:00', CARACAS);
    const fin = localDateTimeToInstant('2026-09-27', '16:00', CARACAS);
    expect(shiftDate(inicio, fin, CARACAS)).toBe('2026-09-27');
  });

  it('rechaza un turno que termina antes de empezar', () => {
    const inicio = localDateTimeToInstant('2026-09-27', '16:00', CARACAS);
    const fin = localDateTimeToInstant('2026-09-27', '08:00', CARACAS);
    expect(() => shiftDate(inicio, fin, CARACAS)).toThrow(DomainError);
  });
});

describe('payPeriodRange', () => {
  it('la primera quincena va del 1 al 15', () => {
    expect(payPeriodRange(2026, 9, 1)).toEqual({ start: '2026-09-01', end: '2026-09-15' });
  });

  it('la segunda quincena va del 16 al último día del mes', () => {
    expect(payPeriodRange(2026, 9, 2)).toEqual({ start: '2026-09-16', end: '2026-09-30' });
  });

  it('respeta la longitud de febrero en año bisiesto y no bisiesto', () => {
    expect(payPeriodRange(2028, 2, 2).end).toBe('2028-02-29');
    expect(payPeriodRange(2026, 2, 2).end).toBe('2026-02-28');
  });

  it('rechaza un mes fuera de rango', () => {
    expect(() => payPeriodRange(2026, 0, 1)).toThrow(DomainError);
    expect(() => payPeriodRange(2026, 13, 1)).toThrow(DomainError);
  });

  it('rechaza una quincena que no es 1 ni 2', () => {
    expect(() => payPeriodRange(2026, 9, 3 as 1)).toThrow(DomainError);
  });
});

describe('formatDateEsVE', () => {
  it('muestra dd/mm/aaaa, no ISO', () => {
    expect(formatDateEsVE('2026-09-27')).toBe('27/09/2026');
  });
});

describe('días de la semana y días hábiles (LOTTT)', () => {
  // 2026-09-21 es lunes, 2026-09-26 es sábado, 2026-09-27 es domingo
  it('dayOfWeek calcula el día correcto en UTC puro', () => {
    expect(dayOfWeek('2026-09-21')).toBe(1); // Lunes
    expect(dayOfWeek('2026-09-25')).toBe(5); // Viernes
    expect(dayOfWeek('2026-09-26')).toBe(6); // Sábado
    expect(dayOfWeek('2026-09-27')).toBe(0); // Domingo
  });

  it('isWeekend identifica sábado y domingo', () => {
    expect(isWeekend('2026-09-21')).toBe(false);
    expect(isWeekend('2026-09-25')).toBe(false);
    expect(isWeekend('2026-09-26')).toBe(true);
    expect(isWeekend('2026-09-27')).toBe(true);
  });

  it('isBusinessDay descarta fines de semana y feriados pasados', () => {
    const feriados = ['2026-09-24']; // Feriado local de ejemplo
    expect(isBusinessDay('2026-09-21', feriados)).toBe(true);
    expect(isBusinessDay('2026-09-24', feriados)).toBe(false);
    expect(isBusinessDay('2026-09-26', feriados)).toBe(false);
    expect(isBusinessDay('2026-09-27', feriados)).toBe(false);
  });

  it('countBusinessDays cuenta días hábiles en rango inclusive', () => {
    const feriados = ['2026-09-24'];
    // Del lunes 21 al viernes 25 son 5 días, con feriado el 24 son 4 días hábiles
    expect(countBusinessDays('2026-09-21', '2026-09-25', feriados)).toBe(4);
    // Del lunes 21 al domingo 27: 4 días hábiles (feriado 24, sáb 26, dom 27 no cuentan)
    expect(countBusinessDays('2026-09-21', '2026-09-27', feriados)).toBe(4);
    // Un solo día que es hábil
    expect(countBusinessDays('2026-09-21', '2026-09-21')).toBe(1);
    // Un solo día que es domingo
    expect(countBusinessDays('2026-09-27', '2026-09-27')).toBe(0);
  });

  it('countBusinessDays rechaza rangos invertidos', () => {
    expect(() => countBusinessDays('2026-09-25', '2026-09-21')).toThrow(DomainError);
  });

  it('addBusinessDays suma días hábiles omitiendo sábados, domingos y feriados', () => {
    const feriados = ['2026-09-24'];
    // Desde lunes 21 sumar 3 hábiles: mar 22 (1), mié 23 (2), jue 24 (feriado salta), vie 25 (3)
    expect(addBusinessDays('2026-09-21', 3, feriados)).toBe('2026-09-25');
    // Desde viernes 25 sumar 1 hábil: salta sáb 26 y dom 27 → lunes 28
    expect(addBusinessDays('2026-09-25', 1)).toBe('2026-09-28');
    // Sumar 0 días hábiles devuelve la misma fecha
    expect(addBusinessDays('2026-09-21', 0)).toBe('2026-09-21');
  });

  it('addBusinessDays rechaza cantidad negativa o no entera', () => {
    expect(() => addBusinessDays('2026-09-21', -1)).toThrow(DomainError);
    expect(() => addBusinessDays('2026-09-21', 1.5)).toThrow(DomainError);
  });
});

describe('errores de formato de fecha y hora', () => {
  it('localDateTimeToInstant rechaza fecha u hora con formato inválido', () => {
    expect(() => localDateTimeToInstant('no-fecha', '08:00', CARACAS)).toThrow(DomainError);
    expect(() => localDateTimeToInstant('2026-09-21', 'no-hora', CARACAS)).toThrow(DomainError);
  });
});
