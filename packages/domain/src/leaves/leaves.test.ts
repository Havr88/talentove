import { describe, expect, it } from 'vitest';
import {
  calculateVacationEntitlement,
  breakDownLeavePeriod,
  calculateReturnDate,
  calculateVacationBalance,
} from './index.js';

describe('Leaves & Vacation Domain (LOTTT)', () => {
  it('calcula correctamente la escala de vacaciones y bono según antigüedad (Art. 190 y 192 LOTTT)', () => {
    // 0 años: 0 días
    const e0 = calculateVacationEntitlement(0.5);
    expect(e0.vacationDays).toBe(0);
    expect(e0.bonusDays).toBe(0);

    // 1er año: 15 días hábiles
    const e1 = calculateVacationEntitlement(1);
    expect(e1.vacationDays).toBe(15);
    expect(e1.bonusDays).toBe(15);

    // 3 años: 15 + 2 = 17 días
    const e3 = calculateVacationEntitlement(3);
    expect(e3.vacationDays).toBe(17);
    expect(e3.bonusDays).toBe(17);

    // 16 años: 15 + 15 = 30 días (tope legal)
    const e16 = calculateVacationEntitlement(16);
    expect(e16.vacationDays).toBe(30);
    expect(e16.bonusDays).toBe(30);

    // 25 años: tope 30 días
    const e25 = calculateVacationEntitlement(25);
    expect(e25.vacationDays).toBe(30);
    expect(e25.bonusDays).toBe(30);
  });

  it('desglosa días hábiles excluyendo fines de semana y feriados nacionales', () => {
    // 2026-10-08 (Jueves) al 2026-10-14 (Miércoles).
    // Feriado: 2026-10-12 (Lunes, Día de la Resistencia Indígena).
    // Fines de semana: 2026-10-10 (Sábado), 2026-10-11 (Domingo).
    // Días hábiles esperados: 8 (Jue), 9 (Vie), 13 (Mar), 14 (Mié) = 4 días hábiles.
    const holidays = ['2026-10-12'];
    const days = breakDownLeavePeriod('2026-10-08', '2026-10-14', holidays);

    expect(days.length).toBe(7); // 7 días calendario
    const businessDays = days.filter((d) => d.isBusinessDay);
    expect(businessDays.length).toBe(4);

    const oct12 = days.find((d) => d.date === '2026-10-12');
    expect(oct12?.isHoliday).toBe(true);
    expect(oct12?.isBusinessDay).toBe(false);

    const oct10 = days.find((d) => d.date === '2026-10-10');
    expect(oct10?.isBusinessDay).toBe(false);
  });

  it('calcula la fecha de reintegro laboral saltando fines de semana y feriados', () => {
    // Si termina el viernes 2026-10-09, reintegro el lunes 2026-10-12 a menos que sea feriado.
    // Con 12 feriado, reintegro el martes 2026-10-13.
    const holidays = ['2026-10-12'];
    const returnDate = calculateReturnDate('2026-10-09', holidays);
    expect(returnDate).toBe('2026-10-13');
  });

  it('calcula el saldo disponible de vacaciones correctamente', () => {
    const balance = calculateVacationBalance('w-123', 3, 5, 2);
    expect(balance.entitlementDays).toBe(17);
    expect(balance.daysTaken).toBe(5);
    expect(balance.daysPending).toBe(2);
    expect(balance.daysAvailable).toBe(10); // 17 - 5 - 2 = 10
  });
});
