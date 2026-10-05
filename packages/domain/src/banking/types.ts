import type { Money } from '../money/money.js';

export type VenezuelanBankCode =
  | '0102' // Banco de Venezuela
  | '0134' // Banesco
  | '0105' // Mercantil
  | '0108' // BBVA Provincial
  | '0114' // Bancaribe
  | '0115' // Banco Exterior
  | '0163' // Banco del Tesoro
  | '0172' // Bancamiga
  | '0175' // Banco Bicentenario
  | '0191'; // BNC

export interface BankPaymentBeneficiary {
  id: string;
  cedulaTipo: 'V' | 'E' | 'J' | 'G';
  cedulaNumero: string;
  fullName: string;
  bankCode: string; // 4 dígitos iniciales de la cuenta
  accountNumber: string; // 20 dígitos exactos
  amount: Money;
  referenceNotes?: string;
}

export interface BankPaymentBatchHeader {
  companyRif: string; // ej: G200000000 o J000000000
  companyName: string;
  debitAccountNumber: string; // 20 dígitos
  batchId: string;
  paymentDate: string; // ISO YYYY-MM-DD
  paymentConcept: string; // ej: NOMINA 1Q SEP 2026
}

export interface BankPaymentBatchInput {
  header: BankPaymentBatchHeader;
  beneficiaries: BankPaymentBeneficiary[];
}

export interface GeneratedBankFile {
  bankCode: VenezuelanBankCode;
  bankName: string;
  fileName: string;
  content: string;
  totalRecords: number;
  totalAmountVES: string;
  hash: string;
}
