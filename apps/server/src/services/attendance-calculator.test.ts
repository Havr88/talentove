import { describe, expect, it } from 'vitest';
import {
  computeDailyHours,
  computeWeeklySummary,
  timeToMinutes,
} from './attendance-calculator.js';

describe('attendance-calculator (LOTTT)', () => {
  it('timeToMinutes convierte cadenas HH:MM a minutos correctamente', () => {
    expect(timeToMinutes('08:00')).toBe(480);
    expect(timeToMinutes('17:30')).toBe(1050);
    expect(timeToMinutes('00:00')).toBe(0);
  });

  it('calcula jornada regular de 8 horas sin extras', () => {
    const res = computeDailyHours('08:00', '16:00', 8);
    expect(res.regularHours).toBe(8);
    expect(res.overtimeDayHours).toBe(0);
    expect(res.overtimeNightHours).toBe(0);
  });

  it('calcula 2 horas extras diurnas cuando labora 10 horas de día', () => {
    const res = computeDailyHours('08:00', '18:00', 8);
    expect(res.regularHours).toBe(8);
    expect(res.overtimeDayHours).toBe(2);
    expect(res.overtimeNightHours).toBe(0);
  });

  it('calcula horas nocturnas después de las 19:00', () => {
    const res = computeDailyHours('14:00', '22:00', 8);
    expect(res.regularHours).toBe(8);
    // De 19:00 a 22:00 son 3 horas nocturnas
    expect(res.nightShiftHours).toBe(3);
  });

  it('computeWeeklySummary calcula acumulados semanales por empleado', () => {
    const records = [
      {
        employeeId: 'emp-1',
        status: 'asistio',
        regularHours: 8,
        overtimeDayHours: 1.5,
        overtimeNightHours: 0,
        nightShiftHours: 0,
        workerSigned: true,
      },
      {
        employeeId: 'emp-1',
        status: 'asistio',
        regularHours: 8,
        overtimeDayHours: 0,
        overtimeNightHours: 0,
        nightShiftHours: 0,
        workerSigned: true,
      },
      {
        employeeId: 'emp-1',
        status: 'falta_injustificada',
        regularHours: 0,
        overtimeDayHours: 0,
        overtimeNightHours: 0,
        nightShiftHours: 0,
        workerSigned: false,
      },
    ];

    const summaries = computeWeeklySummary(records);
    const s1 = summaries.get('emp-1');
    expect(s1).toBeDefined();
    expect(s1?.daysAttended).toBe(2);
    expect(s1?.daysUnjustified).toBe(1);
    expect(s1?.totalRegularHours).toBe(16);
    expect(s1?.totalOvertimeDay).toBe(1.5);
    expect(s1?.allSigned).toBe(true);
  });
});
