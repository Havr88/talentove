export type TravelType = 'LOCAL' | 'NACIONAL' | 'INTERNACIONAL';

export type TravelStatus =
  | 'PENDIENTE'
  | 'APROBADO'
  | 'EN_CURSO'
  | 'RENDICION_PENDIENTE'
  | 'LIQUIDADO'
  | 'RECHAZADO';

export interface TravelExpense {
  readonly id: string;
  readonly travelId: string;
  readonly concept: 'TRANSPORTE' | 'HOSPEDAJE' | 'ALIMENTACION' | 'TASAS_PEAJES' | 'IMPREVISTOS';
  readonly amount: number;
  readonly receiptNumber?: string | undefined;
  readonly isVerified: boolean;
}

export interface TravelRecord {
  readonly id: string;
  readonly workerId: string;
  readonly travelType: TravelType;
  readonly purpose: string;
  readonly origin: string;
  readonly destination: string;
  readonly departureDate: string; // YYYY-MM-DD
  readonly returnDate: string;    // YYYY-MM-DD
  readonly advanceFundAmount: number; // Anticipo otorgado de viático
  readonly expenses: readonly TravelExpense[];
  readonly status: TravelStatus;
  readonly approvedBy?: string | undefined;
}

export interface TravelSettlementResult {
  readonly totalExpensesClaimed: number;
  readonly totalAdvanceFund: number;
  readonly balance: number; // Positivo: empresa debe reembolsar; Negativo: trabajador debe devolver
  readonly isBalanced: boolean;
}
