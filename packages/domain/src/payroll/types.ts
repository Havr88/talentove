import type { Money } from '../money/money.js';

export type EducationLevel =
  | 'bachiller'
  | 'tsu'
  | 'universitario'
  | 'especializacion'
  | 'maestria'
  | 'doctorado';

export type PayrollPeriodType = 'primera_quincena' | 'segunda_quincena' | 'mensual' | 'especial';

export interface EmployeePayrollProfile {
  id: string;
  cedula: string;
  fullName: string;
  positionName: string;
  departmentName: string;
  hireDate: string;
  educationLevel: EducationLevel;
  kidsCount: number;
}

export interface PayrollPeriod {
  year: number;
  month: number;
  periodType: PayrollPeriodType;
  startDate: string;
  endDate: string;
}

export interface StatutoryDeductions {
  ivssWorker: Money;
  ivssEmployer: Money;
  faovWorker: Money;
  faovEmployer: Money;
  spfWorker: Money;
  spfEmployer: Money;
  totalWorkerDeductions: Money;
  totalEmployerContributions: Money;
}

export interface PayrollEarnings {
  baseSalary: Money;
  educationPremium: Money;
  seniorityPremium: Money;
  kidsPremium: Money;
  overtimePay: Money;
  nightBonusPay: Money;
  cestaTicket: Money;
  totalEarnings: Money;
}

export interface PayrollDeductions {
  ivss: Money;
  faov: Money;
  spf: Money;
  absenceDeduction: Money;
  otherDeductions: Money;
  totalDeductions: Money;
}

export interface PayrollReceiptSnapshot {
  employeeId: string;
  cedula: string;
  fullName: string;
  positionName: string;
  departmentName: string;
  hireDate: string;
  educationLevel: EducationLevel;
  seniorityYears: number;
  kidsCount: number;
  exchangeRateBcv: number;
  calculatedAt: string;
}

export interface PayrollCalculationInput {
  employee: EmployeePayrollProfile;
  period: PayrollPeriod;
  baseSalaryMonthly: Money;
  minSalaryNational: Money;
  cestaTicketMonthly?: Money | undefined;
  childPremiumUnit?: Money | undefined;
  overtimePay?: Money | undefined;
  nightBonusPay?: Money | undefined;
  unjustifiedAbsenceDays?: number | undefined;
  otherDeductions?: Money | undefined;
  exchangeRateBcv: number;
}

export interface PayrollCalculationResult {
  snapshot: PayrollReceiptSnapshot;
  period: PayrollPeriod;
  earnings: PayrollEarnings;
  deductions: PayrollDeductions;
  statutory: StatutoryDeductions;
  netPay: Money;
  netPayUsdEquivalent: number;
}
