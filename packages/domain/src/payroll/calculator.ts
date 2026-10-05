import { money, zero, add, subtract, multiply } from '../money/money.js';
import type { Money, CurrencyCode } from '../money/money.js';
import type {
  EducationLevel,
  PayrollCalculationInput,
  PayrollCalculationResult,
  StatutoryDeductions,
} from './types.js';

/**
 * Tabla normativa de Primas de Instrucción (Administración Pública Nacional - APN)
 * Fuente: sgrhth / Decretos APN
 */
export const EDUCATION_PREMIUM_PERCENTS: Record<EducationLevel, number> = {
  bachiller: 0.0,
  tsu: 20.0,
  universitario: 25.0,
  especializacion: 30.0,
  maestria: 35.0,
  doctorado: 40.0,
};

/**
 * Escalafón de Antigüedad APN (años de servicio a porcentaje)
 * Fuente: sgrhth (salary_seniority)
 */
export const SENIORITY_PREMIUM_TABLE: Record<number, number> = {
  0: 0.0,
  1: 1.0,
  2: 2.0,
  3: 3.0,
  4: 4.0,
  5: 5.0,
  6: 6.2,
  7: 7.4,
  8: 8.6,
  9: 9.8,
  10: 11.0,
  11: 12.4,
  12: 13.8,
  13: 15.2,
  14: 16.6,
  15: 18.0,
  16: 19.6,
  17: 21.2,
  18: 22.8,
  19: 24.4,
  20: 26.0,
  21: 27.8,
  22: 29.6,
  23: 30.0,
};

/**
 * Obtener porcentaje de prima por antigüedad
 */
export function getSeniorityPercent(years: number): number {
  if (years <= 0) return 0;
  if (years >= 23) return 30.0;
  return SENIORITY_PREMIUM_TABLE[Math.floor(years)] ?? 30.0;
}

function num(m: Money): number {
  return Number.parseFloat(m.amount);
}

/**
 * Calcular Prima de Instrucción / Profesionalización
 */
export function calculateEducationPremium(baseSalary: Money, level: EducationLevel): Money {
  const percent = EDUCATION_PREMIUM_PERCENTS[level] ?? 0;
  const amount = (num(baseSalary) * percent) / 100;
  return money(amount.toFixed(2), baseSalary.currency);
}

/**
 * Calcular Prima de Antigüedad
 */
export function calculateSeniorityPremium(baseSalary: Money, yearsOfService: number): Money {
  const percent = getSeniorityPercent(yearsOfService);
  const amount = (num(baseSalary) * percent) / 100;
  return money(amount.toFixed(2), baseSalary.currency);
}

/**
 * Calcular Prima por Hijos
 */
export function calculateKidsPremium(kidsCount: number, childPremiumUnit: Money): Money {
  if (kidsCount <= 0) {
    return zero(childPremiumUnit.currency);
  }
  const total = kidsCount * num(childPremiumUnit);
  return money(total.toFixed(2), childPremiumUnit.currency);
}

/**
 * Calcular deducciones de ley venezolana:
 * - IVSS: 4% trabajador / 9-11% patronal (tope: 5 salarios mínimos)
 * - FAOV: 1% trabajador / 2% patronal (sin tope)
 * - SPF: 0.5% trabajador / 2% patronal (tope: 5 salarios mínimos)
 */
export function calculateStatutoryDeductions(
  salary: Money,
  minSalaryNational: Money,
  employerRiskRate = 10.0 // 9%, 10% o 11% riesgo IVSS (default 10% riesgo medio)
): StatutoryDeductions {
  const currency = salary.currency;
  const rawSalary = num(salary);

  // Tope legal de 5 salarios mínimos nacionales para IVSS y SPF
  const legalCapAmount = num(minSalaryNational) * 5;
  const salaryForCap = Math.min(rawSalary, legalCapAmount);

  // Trabajador
  const ivssWorker = (salaryForCap * 4) / 100;
  const faovWorker = (rawSalary * 1) / 100;
  const spfWorker = (salaryForCap * 0.5) / 100;

  // Empleador / Patrono
  const ivssEmployer = (salaryForCap * employerRiskRate) / 100;
  const faovEmployer = (rawSalary * 2) / 100;
  const spfEmployer = (salaryForCap * 2) / 100;

  const totalWorker = ivssWorker + faovWorker + spfWorker;
  const totalEmployer = ivssEmployer + faovEmployer + spfEmployer;

  return {
    ivssWorker: money(ivssWorker.toFixed(2), currency),
    ivssEmployer: money(ivssEmployer.toFixed(2), currency),
    faovWorker: money(faovWorker.toFixed(2), currency),
    faovEmployer: money(faovEmployer.toFixed(2), currency),
    spfWorker: money(spfWorker.toFixed(2), currency),
    spfEmployer: money(spfEmployer.toFixed(2), currency),
    totalWorkerDeductions: money(totalWorker.toFixed(2), currency),
    totalEmployerContributions: money(totalEmployer.toFixed(2), currency),
  };
}

/**
 * Motor integral de liquidación de recibo de pago con snapshot inmutable
 */
export function calculatePayrollReceipt(input: PayrollCalculationInput): PayrollCalculationResult {
  const currency: CurrencyCode = input.baseSalaryMonthly.currency;

  // Factor de período: quincenal = 0.5, mensual = 1.0
  const periodFactor =
    input.period.periodType === 'primera_quincena' || input.period.periodType === 'segunda_quincena'
      ? 0.5
      : 1.0;

  // 1. Salario Base del Período
  const baseSalaryPeriod = money((num(input.baseSalaryMonthly) * periodFactor).toFixed(2), currency);

  // 2. Antigüedad en años (usar primeros 4 caracteres de fecha ISO sin usar Date zonal)
  const hireYear = Number.parseInt(input.employee.hireDate.slice(0, 4), 10) || input.period.year;
  const seniorityYears = Math.max(0, input.period.year - hireYear);

  // 3. Primas del período
  const educationPremium = calculateEducationPremium(baseSalaryPeriod, input.employee.educationLevel);
  const seniorityPremium = calculateSeniorityPremium(baseSalaryPeriod, seniorityYears);
  const childUnit = input.childPremiumUnit ?? zero(currency);
  const kidsPremium = calculateKidsPremium(input.employee.kidsCount, childUnit);

  const overtime = input.overtimePay ?? zero(currency);
  const nightBonus = input.nightBonusPay ?? zero(currency);

  // Cestaticket (usualmente mensual o por quincena según política)
  const cestaMonthly = input.cestaTicketMonthly ?? zero(currency);
  const cestaPeriod = money((num(cestaMonthly) * periodFactor).toFixed(2), cestaMonthly.currency);

  const totalEarningsAmount =
    num(baseSalaryPeriod) +
    num(educationPremium) +
    num(seniorityPremium) +
    num(kidsPremium) +
    num(overtime) +
    num(nightBonus);

  const totalEarnings = money(totalEarningsAmount.toFixed(2), currency);

  // 4. Deducción por inasistencias injustificadas (Hito M3)
  const dailyRate = num(input.baseSalaryMonthly) / 30;
  const absenceDeductionAmount = (input.unjustifiedAbsenceDays ?? 0) * dailyRate;
  const absenceDeduction = money(absenceDeductionAmount.toFixed(2), currency);

  // 5. Retenciones de Ley sobre base sujeta a cotización
  const statutory = calculateStatutoryDeductions(baseSalaryPeriod, input.minSalaryNational);

  const otherDeductions = input.otherDeductions ?? zero(currency);

  const totalDeductionsAmount =
    num(statutory.totalWorkerDeductions) +
    num(absenceDeduction) +
    num(otherDeductions);

  const totalDeductions = money(totalDeductionsAmount.toFixed(2), currency);

  // 6. Neto a Pagar
  const netAmount = Math.max(0, num(totalEarnings) - num(totalDeductions));
  const netPay = money(netAmount.toFixed(2), currency);

  // Equivalente en USD según BCV
  const bcv = input.exchangeRateBcv > 0 ? input.exchangeRateBcv : 1;
  const netPayUsdEquivalent = Math.round((num(netPay) / bcv) * 100) / 100;

  // Snapshot inmutable (Patrón qrh)
  const snapshot = {
    employeeId: input.employee.id,
    cedula: input.employee.cedula,
    fullName: input.employee.fullName,
    positionName: input.employee.positionName,
    departmentName: input.employee.departmentName,
    hireDate: input.employee.hireDate,
    educationLevel: input.employee.educationLevel,
    seniorityYears,
    kidsCount: input.employee.kidsCount,
    exchangeRateBcv: input.exchangeRateBcv,
    calculatedAt: `${input.period.endDate}T12:00:00.000Z`,
  };

  return {
    snapshot,
    period: input.period,
    earnings: {
      baseSalary: baseSalaryPeriod,
      educationPremium,
      seniorityPremium,
      kidsPremium,
      overtimePay: overtime,
      nightBonusPay: nightBonus,
      cestaTicket: cestaPeriod,
      totalEarnings,
    },
    deductions: {
      ivss: statutory.ivssWorker,
      faov: statutory.faovWorker,
      spf: statutory.spfWorker,
      absenceDeduction,
      otherDeductions,
      totalDeductions,
    },
    statutory,
    netPay,
    netPayUsdEquivalent,
  };
}
