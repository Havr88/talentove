import { money, add, multiply, type Money } from '../money/money.js';
import type {
  LiquidationConcept,
  LiquidationInput,
  LiquidationResult,
} from './types.js';

/**
 * Calcula la diferencia en años, meses y días entre dos fechas ISO YYYY-MM-DD de forma pura.
 */
export function computeServiceDuration(startIso: string, endIso: string): {
  totalDays: number;
  years: number;
  months: number;
  days: number;
} {
  const [sY, sM, sD] = startIso.split('-').map((v) => parseInt(v, 10)) as [number, number, number];
  const [eY, eM, eD] = endIso.split('-').map((v) => parseInt(v, 10)) as [number, number, number];

  let years = eY - sY;
  let months = eM - sM;
  let days = eD - sD;

  if (days < 0) {
    months -= 1;
    days += 30;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  years = Math.max(0, years);
  months = Math.max(0, months);
  days = Math.max(0, days);

  const totalDays = years * 360 + months * 30 + days;

  return { totalDays, years, months, days };
}

/**
 * Calculador de Liquidación y Finiquito conforme a la LOTTT.
 */
export function calculateLiquidation(input: LiquidationInput, calculatedAt: string): LiquidationResult {
  const duration = computeServiceDuration(input.hireDate, input.terminationDate);
  const currency = input.lastIntegralSalaryDaily.currency;

  const dailyIntegral = parseFloat(input.lastIntegralSalaryDaily.amount);
  const baseMonthly = parseFloat(input.baseSalaryMonthly.amount);
  const dailyBase = baseMonthly / 30;

  const concepts: LiquidationConcept[] = [];

  // 1. Garantía de Prestaciones Sociales (Art. 142 literal a y c LOTTT)
  // Al término: 30 días por año o fracción superior a 6 meses
  let effectiveYears = duration.years;
  if (duration.months >= 6) {
    effectiveYears += 1;
  }
  if (effectiveYears < 1 && duration.months >= 3) {
    effectiveYears = 0.5; // Al menos un trimestre cumplido
  }

  const daysGuarantee = Math.max(15, Math.round(effectiveYears * 30));
  const amountGuarantee = (daysGuarantee * dailyIntegral).toFixed(2);

  concepts.push({
    code: 'PRESTACIONES_GARANTIA',
    description: `Garantía Prestaciones Sociales Art. 142 LOTTT (${effectiveYears} años eq.)`,
    factorDays: daysGuarantee,
    dailyRate: input.lastIntegralSalaryDaily,
    amount: money(amountGuarantee, currency),
  });

  // 2. Días adicionales de antigüedad (Art. 142 literal b)
  // 2 días por año a partir del 2do año, tope 30 días
  let additionalDays = 0;
  if (duration.years >= 2) {
    additionalDays = Math.min(30, (duration.years - 1) * 2);
  }

  if (additionalDays > 0) {
    const amountAdd = (additionalDays * dailyIntegral).toFixed(2);
    concepts.push({
      code: 'DIAS_ADICIONALES_ANTIGUEDAD',
      description: `Días Adicionales por Antigüedad Art. 142 lit. b (${duration.years} años servicio)`,
      factorDays: additionalDays,
      dailyRate: input.lastIntegralSalaryDaily,
      amount: money(amountAdd, currency),
    });
  }

  // 3. Indemnización por Despido Injustificado (Art. 92 LOTTT)
  let totalIndemnizacion = money('0.00', currency);
  if (input.reason === 'despido_injustificado') {
    const totalPrestaciones = parseFloat(amountGuarantee) + (additionalDays * dailyIntegral);
    const amountIndem = totalPrestaciones.toFixed(2);
    const indemMoney = money(amountIndem, currency);
    totalIndemnizacion = indemMoney;

    concepts.push({
      code: 'INDEMNIZACION_DESPIDO_ART92',
      description: 'Indemnización por Despido Injustificado (Doblete Art. 92 LOTTT)',
      factorDays: daysGuarantee + additionalDays,
      dailyRate: input.lastIntegralSalaryDaily,
      amount: indemMoney,
      isLegalIndemnity: true,
    });
  }

  // 4. Vacaciones y Bono Vacacional Fraccionados (Art. 192 y 196 LOTTT)
  const fractionMonths = duration.months + (duration.days >= 15 ? 1 : 0);
  const baseVacationDays = Math.min(30, 15 + Math.max(0, duration.years - 1));
  const vacFracDays = parseFloat(((baseVacationDays / 12) * fractionMonths).toFixed(2));
  const vacFracAmount = (vacFracDays * dailyBase).toFixed(2);

  concepts.push({
    code: 'VACACIONES_FRACCIONADAS',
    description: `Vacaciones Fraccionadas Art. 196 LOTTT (${fractionMonths} meses)`,
    factorDays: vacFracDays,
    dailyRate: money(dailyBase.toFixed(2), currency),
    amount: money(vacFracAmount, currency),
  });

  const bonoVacFracDays = vacFracDays; // Art. 192 otorga los mismos días de bono
  const bonoVacFracAmount = (bonoVacFracDays * dailyBase).toFixed(2);

  concepts.push({
    code: 'BONO_VACACIONAL_FRACCIONADO',
    description: `Bono Vacacional Fraccionado Art. 192 LOTTT (${fractionMonths} meses)`,
    factorDays: bonoVacFracDays,
    dailyRate: money(dailyBase.toFixed(2), currency),
    amount: money(bonoVacFracAmount, currency),
  });

  // 5. Utilidades Fraccionadas (Art. 131 LOTTT)
  const annualUtilDays = input.daysOfUtilitiesAnnual || 30;
  const utilFracDays = parseFloat(((annualUtilDays / 12) * fractionMonths).toFixed(2));
  const utilFracAmount = (utilFracDays * dailyBase).toFixed(2);

  concepts.push({
    code: 'UTILIDADES_FRACCIONADAS',
    description: `Utilidades Fraccionadas Art. 131 LOTTT (${annualUtilDays} días/año ref.)`,
    factorDays: utilFracDays,
    dailyRate: money(dailyBase.toFixed(2), currency),
    amount: money(utilFracAmount, currency),
  });

  // 6. Consolidación de Totales
  let totalGross = 0;
  for (const c of concepts) {
    totalGross += parseFloat(c.amount.amount);
  }

  const prestacionesSocialesTotal = (parseFloat(amountGuarantee) + (additionalDays * dailyIntegral)).toFixed(2);
  const vacTot = (parseFloat(vacFracAmount) + parseFloat(bonoVacFracAmount)).toFixed(2);
  const utilTot = utilFracAmount;

  const totalGrossMoney = money(totalGross.toFixed(2), currency);
  const deductionsMoney = money('0.00', currency);

  return {
    employeeId: input.employeeId,
    hireDate: input.hireDate,
    terminationDate: input.terminationDate,
    reason: input.reason,
    serviceDuration: duration,
    concepts,
    totals: {
      totalPrestacionesSociales: money(prestacionesSocialesTotal, currency),
      totalIndemnizaciones: totalIndemnizacion,
      totalVacacionesFraccionadas: money(vacTot, currency),
      totalUtilidadesFraccionadas: money(utilTot, currency),
      totalGrossLiquidation: totalGrossMoney,
      deductions: deductionsMoney,
      netToPay: totalGrossMoney,
    },
    calculatedAt,
  };
}
