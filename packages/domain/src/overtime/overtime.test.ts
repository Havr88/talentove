import { describe, expect, it } from 'vitest';
import {
  getOvertimeMultiplier,
  calculateEffectiveHoursInWindow,
  calculateOvertimePayroll,
  type OvertimeRequest,
} from './index.js';

describe('Overtime & Night Surcharge Domain (LOTTT)', () => {
  it('aplica los factores de recargo legales según la LOTTT', () => {
    expect(getOvertimeMultiplier('DIURNA')).toBe(1.5);
    expect(getOvertimeMultiplier('NOCTURNA')).toBe(1.95);
    expect(getOvertimeMultiplier('FERIADO_DESCANSO')).toBe(1.5);
    expect(getOvertimeMultiplier('BONO_NOCTURNO_ORDINARIO')).toBe(0.3);
  });

  it('calcula las horas efectivas dentro de una ventana de período de nómina', () => {
    // Solicitud de 18:00 a 22:00 (4 horas)
    // Ventana de corte a las 20:00: horas efectivas deben ser 2
    const hours = calculateEffectiveHoursInWindow(
      '2026-10-01T18:00:00Z',
      '2026-10-01T22:00:00Z',
      '2026-10-01T00:00:00Z',
      '2026-10-01T20:00:00Z'
    );
    expect(hours).toBe(2);
  });

  it('calcula la liquidación acumulada de horas extras y bonos nocturnos', () => {
    const baseHourlyRate = 100; // 100 Bs por hora
    const requests: OvertimeRequest[] = [
      {
        id: 'ot-1',
        workerId: 'w-1',
        date: '2026-10-01',
        startTime: '17:00',
        endTime: '19:00',
        category: 'DIURNA',
        hours: 2,
        status: 'APROBADO',
      },
      {
        id: 'ot-2',
        workerId: 'w-1',
        date: '2026-10-02',
        startTime: '20:00',
        endTime: '22:00',
        category: 'NOCTURNA',
        hours: 2,
        status: 'APROBADO',
      },
      {
        id: 'ot-3',
        workerId: 'w-1',
        date: '2026-10-03',
        startTime: '10:00',
        endTime: '12:00',
        category: 'DIURNA',
        hours: 2,
        status: 'RECHAZADO', // Debe ser ignorado
      },
    ];

    const result = calculateOvertimePayroll(requests, baseHourlyRate);

    // Diurna: 2 horas * 150 = 300
    // Nocturna: 2 horas * 195 = 390
    // Total horas aprobadas = 4
    // Total a pagar = 690
    expect(result.totalHours).toBe(4);
    expect(result.hoursByCategory.DIURNA).toBe(2);
    expect(result.hoursByCategory.NOCTURNA).toBe(2);
    expect(result.payByCategory.DIURNA).toBe(300);
    expect(result.payByCategory.NOCTURNA).toBe(390);
    expect(result.totalOvertimePay).toBe(690);
  });
});
