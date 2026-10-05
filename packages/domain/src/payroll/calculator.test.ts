import { describe, it, expect } from 'vitest';
import {
  calculateEducationPremium,
  calculateSeniorityPremium,
  calculateKidsPremium,
  calculateStatutoryDeductions,
  calculatePayrollReceipt,
  EDUCATION_PREMIUM_PERCENTS,
  SENIORITY_PREMIUM_TABLE,
} from './calculator.js';
import { money } from '../money/money.js';

describe('Motor de Nómina LOTTT & APN (M2b)', () => {
  describe('Primas de Instrucción / Profesionalización (APN)', () => {
    it('asigna los porcentajes normativos correctos', () => {
      expect(EDUCATION_PREMIUM_PERCENTS.bachiller).toBe(0);
      expect(EDUCATION_PREMIUM_PERCENTS.tsu).toBe(20);
      expect(EDUCATION_PREMIUM_PERCENTS.universitario).toBe(25);
      expect(EDUCATION_PREMIUM_PERCENTS.especializacion).toBe(30);
      expect(EDUCATION_PREMIUM_PERCENTS.maestria).toBe(35);
      expect(EDUCATION_PREMIUM_PERCENTS.doctorado).toBe(40);
    });

    it('calcula la prima de educación sobre el salario base', () => {
      const base = money('1000', 'VES');
      const primaTSU = calculateEducationPremium(base, 'tsu');
      expect(primaTSU.amount).toBe('200.00');

      const primaUni = calculateEducationPremium(base, 'universitario');
      expect(primaUni.amount).toBe('250.00');

      const primaDoc = calculateEducationPremium(base, 'doctorado');
      expect(primaDoc.amount).toBe('400.00');

      const primaBachiller = calculateEducationPremium(base, 'bachiller');
      expect(primaBachiller.amount).toBe('0.00');
    });
  });

  describe('Escalafón de Antigüedad APN (salary_seniority)', () => {
    it('aplica los porcentajes exactos según años de servicio', () => {
      const base = money('1000', 'VES');
      // Año 1 -> 1.0% (10 Bs)
      expect(calculateSeniorityPremium(base, 1).amount).toBe('10.00');
      // Año 5 -> 5.0% (50 Bs)
      expect(calculateSeniorityPremium(base, 5).amount).toBe('50.00');
      // Año 6 -> 6.2% (62 Bs)
      expect(calculateSeniorityPremium(base, 6).amount).toBe('62.00');
      // Año 10 -> 11.0% (110 Bs)
      expect(calculateSeniorityPremium(base, 10).amount).toBe('110.00');
      // Año 20 -> 26.0% (260 Bs)
      expect(calculateSeniorityPremium(base, 20).amount).toBe('260.00');
      // Año 23 o más -> tope 30.0% (300 Bs)
      expect(calculateSeniorityPremium(base, 25).amount).toBe('300.00');
      // 0 años -> 0
      expect(calculateSeniorityPremium(base, 0).amount).toBe('0.00');
    });
  });

  describe('Prima por Hijos / Cargas Familiares', () => {
    it('calcula el total de prima por hijos basado en monto unitario', () => {
      const unit = money('12.50', 'VES');
      const zero = calculateKidsPremium(0, unit);
      expect(zero.amount).toBe('0.00');

      const threeKids = calculateKidsPremium(3, unit);
      expect(threeKids.amount).toBe('37.50');
    });
  });

  describe('Retenciones Estatutarias de Ley (IVSS, FAOV, SPF)', () => {
    it('calcula retenciones ordinarias sin exceder el tope de 5 salarios mínimos', () => {
      const baseSalary = money('500', 'VES');
      const minSalary = money('130', 'VES'); // Tope 5 salarios = 650 Bs

      const deductions = calculateStatutoryDeductions(baseSalary, minSalary);

      // IVSS: 4% de 500 = 20.00
      expect(deductions.ivssWorker.amount).toBe('20.00');
      // FAOV: 1% de 500 = 5.00
      expect(deductions.faovWorker.amount).toBe('5.00');
      // SPF: 0.5% de 500 = 2.50
      expect(deductions.spfWorker.amount).toBe('2.50');
      // Total deducciones trabajador = 27.50
      expect(deductions.totalWorkerDeductions.amount).toBe('27.50');

      // Aportes patronales
      // IVSS Patronal (Riesgo medio 10%): 50.00
      expect(deductions.ivssEmployer.amount).toBe('50.00');
      // FAOV Patronal (2%): 10.00
      expect(deductions.faovEmployer.amount).toBe('10.00');
      // SPF Patronal (2%): 10.00
      expect(deductions.spfEmployer.amount).toBe('10.00');
    });

    it('aplica tope legal de 5 salarios mínimos para IVSS y SPF', () => {
      const highSalary = money('2000', 'VES');
      const minSalary = money('130', 'VES'); // Tope = 650 Bs

      const deductions = calculateStatutoryDeductions(highSalary, minSalary);

      // IVSS tope: 4% de 650 = 26.00
      expect(deductions.ivssWorker.amount).toBe('26.00');
      // SPF tope: 0.5% de 650 = 3.25
      expect(deductions.spfWorker.amount).toBe('3.25');
      // FAOV no tiene tope de 5 salarios mínimos: 1% de 2000 = 20.00
      expect(deductions.faovWorker.amount).toBe('20.00');
    });
  });

  describe('Cálculo Integral del Recibo de Pago con Snapshot Inmutable', () => {
    it('genera el recibo con todas las asignaciones, deducciones y neto a cobrar', () => {
      const receipt = calculatePayrollReceipt({
        employee: {
          id: 'emp-1',
          cedula: 'V-15890456',
          fullName: 'Carlos Mendoza',
          positionName: 'Desarrollador Full Stack',
          departmentName: 'Tecnología',
          hireDate: '2021-01-15', // 5 años a 2026
          educationLevel: 'universitario',
          kidsCount: 2,
        },
        period: {
          year: 2026,
          month: 9,
          periodType: 'segunda_quincena',
          startDate: '2026-09-16',
          endDate: '2026-09-30',
        },
        baseSalaryMonthly: money('1000', 'VES'),
        minSalaryNational: money('130', 'VES'),
        cestaTicketMonthly: money('45', 'USD'),
        childPremiumUnit: money('12.50', 'VES'),
        overtimePay: money('50', 'VES'),
        nightBonusPay: money('25', 'VES'),
        unjustifiedAbsenceDays: 0,
        exchangeRateBcv: 36.5,
      });

      expect(receipt.snapshot.employeeId).toBe('emp-1');
      expect(receipt.snapshot.positionName).toBe('Desarrollador Full Stack');
      expect(receipt.snapshot.educationLevel).toBe('universitario');
      expect(receipt.earnings.baseSalary.amount).toBe('500.00'); // 1 quincena = 50%
      expect(receipt.earnings.educationPremium.amount).toBe('125.00'); // 25% de 500
      expect(receipt.earnings.seniorityPremium.amount).toBe('25.00'); // 5% de 500 (5 años)
      expect(receipt.earnings.kidsPremium.amount).toBe('25.00'); // 2 * 12.5
      expect(receipt.earnings.overtimePay.amount).toBe('50.00');
      expect(receipt.earnings.nightBonusPay.amount).toBe('25.00');
      expect(receipt.earnings.totalEarnings.amount).toBe('750.00');

      // Deducciones sobre quincena
      expect(Number.parseFloat(receipt.deductions.totalDeductions.amount)).toBeGreaterThan(0);
      expect(Number.parseFloat(receipt.netPay.amount)).toBe(
        Number.parseFloat(receipt.earnings.totalEarnings.amount) -
          Number.parseFloat(receipt.deductions.totalDeductions.amount)
      );
      expect(receipt.netPayUsdEquivalent).toBeDefined();
    });
  });
});
