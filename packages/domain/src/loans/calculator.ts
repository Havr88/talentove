import { Decimal } from 'decimal.js';
import { DomainError } from '../errors.js';
import { roundHalfUp } from '../numeric.js';
import type { WorkerLoan, LoanDeductionResult } from './types.js';

/**
 * Valida si un anticipo de prestaciones cumple con el límite legal del 75% (Art. 144 LOTTT).
 */
export function validateSeveranceAdvance(
  requestedAmount: number | string,
  accumulatedSeveranceFund: number | string
): boolean {
  const reqDec = Decimal(requestedAmount.toString());
  const fundDec = Decimal(accumulatedSeveranceFund.toString());

  if (reqDec.lessThanOrEqualTo(0)) {
    throw new DomainError('importe_invalido', 'El monto solicitado debe ser mayor a cero.');
  }

  const maxAllowed = roundHalfUp(fundDec.times('0.75').toString(), 2);
  return reqDec.lessThanOrEqualTo(maxAllowed);
}

/**
 * Calcula la deducción aplicable en la corrida actual de nómina para un préstamo activo.
 * Retorna el monto a retener y la nueva versión inmutable del préstamo.
 */
export function calculateAndApplyLoanDeduction(loan: WorkerLoan): LoanDeductionResult {
  if (loan.status !== 'APROBADO' && loan.status !== 'EN_DESCUENTO') {
    return {
      deductionAmount: 0,
      updatedLoan: loan,
      isFullyPaid: loan.status === 'LIQUIDADO',
    };
  }

  const installmentDec = Decimal(loan.installmentAmount.toString());
  const balanceDec = Decimal(loan.remainingBalance.toString());

  // Deducción no puede superar el saldo pendiente
  const deductionDec = installmentDec.lessThan(balanceDec) ? installmentDec : balanceDec;
  const deductionAmount = deductionDec.toNumber();

  const newBalanceDec = balanceDec.minus(deductionDec);
  const isFullyPaid = newBalanceDec.lessThanOrEqualTo(0);

  const updatedLoan: WorkerLoan = {
    ...loan,
    remainingBalance: Math.max(0, newBalanceDec.toNumber()),
    installmentsPaid: loan.installmentsPaid + 1,
    status: isFullyPaid ? 'LIQUIDADO' : 'EN_DESCUENTO',
  };

  return {
    deductionAmount,
    updatedLoan: Object.freeze(updatedLoan),
    isFullyPaid,
  };
}
