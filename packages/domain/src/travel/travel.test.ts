import { describe, expect, it } from 'vitest';
import {
  calculateTravelSettlement,
  type TravelRecord,
} from './index.js';

describe('Travel & Per Diem Domain', () => {
  it('calcula la rendición de cuentas con saldo a favor de la institución (devolución)', () => {
    const record: TravelRecord = {
      id: 'tr-1',
      workerId: 'w-1',
      travelType: 'NACIONAL',
      purpose: 'Inspección de sede regional Valencia',
      origin: 'Caracas',
      destination: 'Valencia',
      departureDate: '2026-10-05',
      returnDate: '2026-10-07',
      advanceFundAmount: 500, // Se le anticiparon 500 Bs
      expenses: [
        { id: 'e-1', travelId: 'tr-1', concept: 'TRANSPORTE', amount: 120, isVerified: true },
        { id: 'e-2', travelId: 'tr-1', concept: 'HOSPEDAJE', amount: 200, isVerified: true },
        { id: 'e-3', travelId: 'tr-1', concept: 'ALIMENTACION', amount: 80, isVerified: true },
        { id: 'e-4', travelId: 'tr-1', concept: 'IMPREVISTOS', amount: 50, isVerified: false }, // No verificado
      ],
      status: 'RENDICION_PENDIENTE',
    };

    const settlement = calculateTravelSettlement(record);
    // Gastos verificados: 120 + 200 + 80 = 400
    // Anticipo: 500
    // Balance: 400 - 500 = -100 (trabajador debe reintegrar 100 Bs)
    expect(settlement.totalExpensesClaimed).toBe(400);
    expect(settlement.totalAdvanceFund).toBe(500);
    expect(settlement.balance).toBe(-100);
    expect(settlement.isBalanced).toBe(false);
  });
});
