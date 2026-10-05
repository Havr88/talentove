import type { Money } from '../money/money.js';

export type LiquidationReason =
  | 'renuncia_voluntaria'
  | 'despido_justificado'
  | 'despido_injustificado'
  | 'mutuo_acuerdo'
  | 'fin_contrato'
  | 'jubilacion'
  | 'fallecimiento';

export interface LiquidationInput {
  employeeId: string;
  hireDate: string; // YYYY-MM-DD
  terminationDate: string; // YYYY-MM-DD
  reason: LiquidationReason;
  baseSalaryMonthly: Money;
  lastIntegralSalaryDaily: Money; // Salario integral diario (base + alícuota bono vacacional + alícuota utilidades)
  pendingVacationDays?: number; // Días de vacaciones vencidas no disfrutadas
  daysOfUtilitiesAnnual?: number; // Días de utilidades de la empresa (mínimo 30, máximo 120, por defecto 30)
}

export interface LiquidationConcept {
  code: string;
  description: string;
  factorDays: number;
  dailyRate: Money;
  amount: Money;
  isLegalIndemnity?: boolean;
}

export interface LiquidationResult {
  employeeId: string;
  hireDate: string;
  terminationDate: string;
  reason: LiquidationReason;
  serviceDuration: {
    totalDays: number;
    years: number;
    months: number;
    days: number;
  };
  concepts: LiquidationConcept[];
  totals: {
    totalPrestacionesSociales: Money;
    totalIndemnizaciones: Money;
    totalVacacionesFraccionadas: Money;
    totalUtilidadesFraccionadas: Money;
    totalGrossLiquidation: Money;
    deductions: Money; // deducciones de ley o anticipos
    netToPay: Money;
  };
  calculatedAt: string;
}
