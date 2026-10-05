export type LoanType =
  | 'ANTICIPO_PRESTACIONES' // Art. 144 LOTTT (hasta 75% para vivienda, salud, educación)
  | 'PRESTAMO_PERSONAL'     // Préstamo institucional
  | 'CAJA_AHORRO'           // Préstamo otorgado por caja de ahorro de los trabajadores
  | 'OTRO';

export type LoanStatus =
  | 'APROBADO'
  | 'EN_DESCUENTO'
  | 'LIQUIDADO'
  | 'SUSPENDIDO';

export interface WorkerLoan {
  readonly id: string;
  readonly workerId: string;
  readonly loanType: LoanType;
  readonly totalAmount: number;
  readonly installmentAmount: number; // Monto por período
  readonly remainingBalance: number;  // Saldo pendiente por amortizar
  readonly startDate: string;         // YYYY-MM-DD
  readonly status: LoanStatus;
  readonly installmentsPaid: number;
  readonly reason?: string | undefined;
}

export interface LoanDeductionResult {
  readonly deductionAmount: number;
  readonly updatedLoan: WorkerLoan;
  readonly isFullyPaid: boolean;
}
