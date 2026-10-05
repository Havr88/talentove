import { describe, expect, it } from 'vitest';
import {
  validateSeveranceAdvance,
  calculateAndApplyLoanDeduction,
  type WorkerLoan,
} from './index.js';

describe('Worker Loans & Advances Domain (LOTTT Art. 144)', () => {
  it('valida el límite máximo de anticipo de prestaciones sociales al 75%', () => {
    const fund = 10000;
    // 75% de 10000 = 7500
    expect(validateSeveranceAdvance(5000, fund)).toBe(true);
    expect(validateSeveranceAdvance(7500, fund)).toBe(true);
    expect(validateSeveranceAdvance(7500.01, fund)).toBe(false);
    expect(validateSeveranceAdvance(8000, fund)).toBe(false);
  });

  it('calcula la deducción periódica y actualiza el saldo inmutablemente hasta liquidar', () => {
    const initialLoan: WorkerLoan = {
      id: 'loan-1',
      workerId: 'w-1',
      loanType: 'ANTICIPO_PRESTACIONES',
      totalAmount: 1000,
      installmentAmount: 400,
      remainingBalance: 1000,
      startDate: '2026-10-01',
      status: 'APROBADO',
      installmentsPaid: 0,
    };

    // Primera cuota: deduce 400, queda 600
    const step1 = calculateAndApplyLoanDeduction(initialLoan);
    expect(step1.deductionAmount).toBe(400);
    expect(step1.updatedLoan.remainingBalance).toBe(600);
    expect(step1.updatedLoan.status).toBe('EN_DESCUENTO');
    expect(step1.updatedLoan.installmentsPaid).toBe(1);
    expect(step1.isFullyPaid).toBe(false);

    // Segunda cuota: deduce 400, queda 200
    const step2 = calculateAndApplyLoanDeduction(step1.updatedLoan);
    expect(step2.deductionAmount).toBe(400);
    expect(step2.updatedLoan.remainingBalance).toBe(200);
    expect(step2.updatedLoan.status).toBe('EN_DESCUENTO');
    expect(step2.updatedLoan.installmentsPaid).toBe(2);

    // Tercera cuota: cuota fija era 400 pero solo resta 200 -> deduce 200 exactos, queda 0 y estado LIQUIDADO
    const step3 = calculateAndApplyLoanDeduction(step2.updatedLoan);
    expect(step3.deductionAmount).toBe(200);
    expect(step3.updatedLoan.remainingBalance).toBe(0);
    expect(step3.updatedLoan.status).toBe('LIQUIDADO');
    expect(step3.isFullyPaid).toBe(true);
  });
});
