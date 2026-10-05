import type { Money } from '../money/money.js';

export interface ParafiscalWorkerEntry {
  employeeId: string;
  cedulaTipo: 'V' | 'E';
  cedulaNumero: string;
  fullName: string;
  hireDate: string; // YYYY-MM-DD
  baseSalary: Money;
  totalEarnings: Money;
  ivssWorkerDeduction: Money;
  ivssEmployerContribution: Money;
  faovWorkerDeduction: Money;
  faovEmployerContribution: Money;
  spfWorkerDeduction: Money;
  spfEmployerContribution: Money;
}

export interface ParafiscalCompanyHeader {
  companyName: string;
  companyRif: string; // ej: G200000000
  ivssPatronalNumber: string; // Número patronal de 9 dígitos del IVSS
  banavihNumber: string; // Código de aportante BANAVIH
  periodYear: number;
  periodMonth: number;
}

export interface GeneratedParafiscalFile {
  type: 'IVSS_TIUNA' | 'FAOV_BANAVIH' | 'INCES_RESUMEN';
  fileName: string;
  content: string;
  totalWorkers: number;
  totalWorkerDeductionsVES: string;
  totalEmployerContributionsVES: string;
  totalContributionVES: string;
}
