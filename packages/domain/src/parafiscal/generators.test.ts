import { describe, it, expect } from 'vitest';
import { money } from '../money/money.js';
import {
  generateTiunaIvssTxt,
  generateFaovBanavihTxt,
  generateIncesSummary,
} from './generators.js';
import type { ParafiscalCompanyHeader, ParafiscalWorkerEntry } from './types.js';

describe('Archivos de Cotización Parafiscal (IVSS / TIUNA, FAOV / BANAVIH, INCES)', () => {
  const sampleHeader: ParafiscalCompanyHeader = {
    companyName: 'Empresa Nacional de Telecomunicaciones',
    companyRif: 'G-20098765-4',
    ivssPatronalNumber: '012345678',
    banavihNumber: '99887766',
    periodYear: 2026,
    periodMonth: 9,
  };

  const sampleWorkers: ParafiscalWorkerEntry[] = [
    {
      employeeId: 'emp-1',
      cedulaTipo: 'V',
      cedulaNumero: '15444333',
      fullName: 'Ana Patricia Blanco',
      hireDate: '2023-03-15',
      baseSalary: money('3500.00', 'VES'),
      totalEarnings: money('3500.00', 'VES'),
      ivssWorkerDeduction: money('26.00', 'VES'), // 4% con tope de 5 SMN (130 * 5 = 650 -> 650 * 4% = 26)
      ivssEmployerContribution: money('65.00', 'VES'), // 10% de 650 = 65
      faovWorkerDeduction: money('35.00', 'VES'), // 1% de 3500 = 35
      faovEmployerContribution: money('70.00', 'VES'), // 2% de 3500 = 70
      spfWorkerDeduction: money('3.25', 'VES'),
      spfEmployerContribution: money('13.00', 'VES'),
    },
  ];

  it('generateTiunaIvssTxt genera formato oficial de cotizaciones del IVSS', () => {
    const file = generateTiunaIvssTxt(sampleHeader, sampleWorkers);
    expect(file.type).toBe('IVSS_TIUNA');
    expect(file.fileName).toBe('TIUNA_012345678_202609.txt');
    expect(file.content).toContain('TIUNA|G200987654|012345678|202609|1');
    expect(file.content).toContain('V015444333|Ana Patricia Blanco|2023-03-15|3500.00|26.00|65.00|91.00');
    expect(file.totalWorkerDeductionsVES).toBe('26.00');
    expect(file.totalEmployerContributionsVES).toBe('65.00');
    expect(file.totalContributionVES).toBe('91.00');
  });

  it('generateFaovBanavihTxt genera archivo oficial delimitado para BANAVIH', () => {
    const file = generateFaovBanavihTxt(sampleHeader, sampleWorkers);
    expect(file.type).toBe('FAOV_BANAVIH');
    expect(file.fileName).toBe('FAOV_G200987654_202609.txt');
    expect(file.content).toContain('H;G200987654;99887766;2026;09;1');
    expect(file.content).toContain('G200987654;V;15444333;Ana Patricia Blanco;3500.00;35.00;70.00;105.00');
    expect(file.totalContributionVES).toBe('105.00');
  });

  it('generateIncesSummary genera el resumen de aporte patronal del 2%', () => {
    const file = generateIncesSummary(sampleHeader, sampleWorkers);
    expect(file.type).toBe('INCES_RESUMEN');
    expect(file.totalEmployerContributionsVES).toBe('70.00'); // 2% de 3500 = 70
    expect(file.content).toContain('APORTE PATRONAL OBLIGATORIO (2%): 70.00 VES');
  });
});
