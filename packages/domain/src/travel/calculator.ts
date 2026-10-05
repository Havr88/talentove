import { Decimal } from 'decimal.js';
import { roundHalfUp } from '../numeric.js';
import type { TravelRecord, TravelSettlementResult } from './types.js';

/**
 * Computa la rendición de cuentas de una comisión de servicio/viático institucional.
 */
export function calculateTravelSettlement(record: TravelRecord): TravelSettlementResult {
  let totalExpensesDec = Decimal(0);

  for (const exp of record.expenses) {
    if (exp.isVerified) {
      totalExpensesDec = totalExpensesDec.plus(exp.amount.toString());
    }
  }

  const advanceDec = Decimal(record.advanceFundAmount.toString());
  const balanceDec = totalExpensesDec.minus(advanceDec);

  return {
    totalExpensesClaimed: roundHalfUp(totalExpensesDec.toString(), 2).toNumber(),
    totalAdvanceFund: roundHalfUp(advanceDec.toString(), 2).toNumber(),
    balance: roundHalfUp(balanceDec.toString(), 2).toNumber(),
    isBalanced: balanceDec.isZero(),
  };
}
