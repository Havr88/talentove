import { describe, it, expect } from 'vitest';
import { money } from '../money/money.js';
import {
  generateBankPaymentFile,
  generateBdvTxt,
  generateBanescoTxt,
  generateMercantilTxt,
  generateProvincialTxt,
  cleanAccountNumber,
} from './generators.js';
import type { BankPaymentBatchInput } from './types.js';

describe('Integraciones Bancarias de Pago de Nómina (Venezuela)', () => {
  const sampleInput: BankPaymentBatchInput = {
    header: {
      companyRif: 'G-20012345-6',
      companyName: 'Corporación Socialista de Tecnologías',
      debitAccountNumber: '01020123456789012345',
      batchId: 'batch-test-001',
      paymentDate: '2026-09-30',
      paymentConcept: 'NOMINA 2Q SEP 2026',
    },
    beneficiaries: [
      {
        id: 'b-1',
        cedulaTipo: 'V',
        cedulaNumero: '18234567',
        fullName: 'Carlos Eduardo Pérez',
        bankCode: '0102',
        accountNumber: '01020987654321098765',
        amount: money('2500.50', 'VES'),
      },
      {
        id: 'b-2',
        cedulaTipo: 'V',
        cedulaNumero: '20987654',
        fullName: 'María Alejandra Morales',
        bankCode: '0102',
        accountNumber: '01029876543210987654',
        amount: money('3400.00', 'VES'),
      },
    ],
  };

  it('cleanAccountNumber valida exactamente 20 dígitos y descarta caracteres no numéricos', () => {
    expect(cleanAccountNumber('0102-0123-45-6789012345')).toBe('01020123456789012345');
    expect(() => cleanAccountNumber('0102-123')).toThrow('exactamente 20 dígitos');
  });

  it('generateBdvTxt genera estructura oficial del Banco de Venezuela (0102)', () => {
    const txt = generateBdvTxt(sampleInput);
    const lines = txt.split('\r\n');

    expect(lines.length).toBe(3); // 1 header + 2 detail lines
    // Cabecera BDV
    expect(lines[0]).toContain('H|G200123456|01020123456789012345|20260930|000002');
    expect(lines[0]).toContain('000000000590050'); // 5900.50 Bs en centavos (padding 15)

    // Detalle 1
    expect(lines[1]).toContain('D|000001|V018234567|01020987654321098765|0000000250050|Carlos Eduardo Perez');
    // Detalle 2
    expect(lines[2]).toContain('D|000002|V020987654|01029876543210987654|0000000340000|Maria Alejandra Morales');
  });

  it('generateBanescoTxt genera archivo para Banesco (0134)', () => {
    const txt = generateBanescoTxt(sampleInput);
    expect(txt).toContain('010102012345678901234520260930');
    expect(txt).toContain('0201020987654321098765V018234567');
  });

  it('generateMercantilTxt genera archivo para Mercantil (0105)', () => {
    const txt = generateMercantilTxt(sampleInput);
    expect(txt).toContain('000105');
    expect(txt).toContain('01020987654321098765');
  });

  it('generateProvincialTxt genera archivo para BBVA Provincial (0108)', () => {
    const txt = generateProvincialTxt(sampleInput);
    expect(txt).toContain('01020123456789012345|01020987654321098765|V018234567');
  });

  it('generateBankPaymentFile genera el paquete con hash sha256 y totales', () => {
    const res = generateBankPaymentFile('0102', sampleInput);
    expect(res.bankCode).toBe('0102');
    expect(res.bankName).toBe('Banco de Venezuela');
    expect(res.fileName).toContain('nomina_0102_20260930_');
    expect(res.totalRecords).toBe(2);
    expect(res.totalAmountVES).toBe('5900.50');
    expect(res.hash).toHaveLength(64); // SHA-256
  });
});
