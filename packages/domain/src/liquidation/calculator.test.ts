import { describe, it, expect } from 'vitest';
import { money } from '../money/money.js';
import {
  calculateLiquidation,
  computeServiceDuration,
} from './calculator.js';
import type { LiquidationInput } from './types.js';

describe('Cálculo de Liquidación de Prestaciones Sociales (LOTTT)', () => {
  it('computeServiceDuration calcula años, meses y días de servicio de forma pura', () => {
    const dur1 = computeServiceDuration('2023-01-15', '2026-09-30');
    expect(dur1.years).toBe(3);
    expect(dur1.months).toBe(8);
    expect(dur1.days).toBe(15);
  });

  it('calculateLiquidation calcula finiquito por renuncia voluntaria correctamente', () => {
    const input: LiquidationInput = {
      employeeId: 'emp-101',
      hireDate: '2023-01-15',
      terminationDate: '2026-09-30', // 3 años y 8 meses -> 4 años equivalentes (fracción > 6 meses)
      reason: 'renuncia_voluntaria',
      baseSalaryMonthly: money('3000.00', 'VES'), // 100 Bs/día
      lastIntegralSalaryDaily: money('120.00', 'VES'),
      pendingVacationDays: 0,
      daysOfUtilitiesAnnual: 30,
    };

    const res = calculateLiquidation(input, '2026-09-30T10:00:00Z');

    expect(res.reason).toBe('renuncia_voluntaria');
    expect(res.serviceDuration.years).toBe(3);
    // Garantía Art. 142 lit a y c: 4 años * 30 días = 120 días * 120 Bs = 14400 Bs
    const garantiaConcept = res.concepts.find((c) => c.code === 'PRESTACIONES_GARANTIA');
    expect(garantiaConcept).toBeDefined();
    expect(garantiaConcept?.factorDays).toBe(120);
    expect(garantiaConcept?.amount.amount).toBe('14400.00');

    // Días adicionales antigüedad: (3 años - 1) * 2 = 4 días adicionales * 120 Bs = 480 Bs
    const addConcept = res.concepts.find((c) => c.code === 'DIAS_ADICIONALES_ANTIGUEDAD');
    expect(addConcept).toBeDefined();
    expect(addConcept?.factorDays).toBe(4);
    expect(addConcept?.amount.amount).toBe('480.00');

    // Sin indemnización de despido en renuncia voluntaria
    expect(res.totals.totalIndemnizaciones.amount).toBe('0.00');
    expect(parseFloat(res.totals.netToPay.amount)).toBeGreaterThan(14880);
  });

  it('calculateLiquidation duplica prestaciones en caso de despido injustificado (Art. 92 LOTTT)', () => {
    const input: LiquidationInput = {
      employeeId: 'emp-102',
      hireDate: '2024-01-01',
      terminationDate: '2025-01-01', // 1 año exacto
      reason: 'despido_injustificado',
      baseSalaryMonthly: money('3000.00', 'VES'),
      lastIntegralSalaryDaily: money('100.00', 'VES'),
    };

    const res = calculateLiquidation(input, '2025-01-01T10:00:00Z');
    expect(res.reason).toBe('despido_injustificado');

    // Prestaciones: 30 días * 100 = 3000 Bs
    const garantia = res.concepts.find((c) => c.code === 'PRESTACIONES_GARANTIA');
    expect(garantia?.amount.amount).toBe('3000.00');

    // Indemnización Art. 92: igual a las prestaciones (3000 Bs)
    const indem = res.concepts.find((c) => c.code === 'INDEMNIZACION_DESPIDO_ART92');
    expect(indem).toBeDefined();
    expect(indem?.amount.amount).toBe('3000.00');
    expect(res.totals.totalIndemnizaciones.amount).toBe('3000.00');
  });
});
