import {
  calculatePayrollReceipt,
  money,
  type EducationLevel,
  type PayrollCalculationResult,
  type PayrollPeriodType,
} from '@talento-ve/domain';
import type {
  Repositories,
  PayrollBatch,
  PayrollReceiptRecord,
} from '../db/types.js';

export interface ProcessPayrollInput {
  periodStart: string;
  periodEnd: string;
  periodType: 'primera_quincena' | 'segunda_quincena' | 'mensual';
  minimumWageVES?: string;
  processedBy?: string;
}

export class PayrollService {
  constructor(private readonly repos: Repositories) {}

  async processPayroll(input: ProcessPayrollInput): Promise<{ batch: PayrollBatch; receipts: PayrollReceiptRecord[] }> {
    const minWage = input.minimumWageVES || '130.00';
    const nowIso = new Date().toISOString();

    const employees = (await this.repos.employees.list()).filter((e) => e.status === 'activo');
    const attendanceSheets = await this.repos.attendance.listSheets();
    const positions = await this.repos.positions.list();
    const orgUnits = await this.repos.orgUnits.list();

    const posMap = new Map(positions.map((p) => [p.id, p]));
    const unitMap = new Map(orgUnits.map((u) => [u.id, u]));

    const startParts = input.periodStart.split('-');
    const year = parseInt(startParts[0] || '2026', 10);
    const month = parseInt(startParts[1] || '9', 10);

    let totalEarningsNum = 0;
    let totalDeductionsNum = 0;
    let totalNetNum = 0;

    const calculatedItems: {
      empId: string;
      calcResult: PayrollCalculationResult;
      eGross: number;
      eDed: number;
      eNet: number;
    }[] = [];

    for (const emp of employees) {
      const activeContract = await this.repos.contracts.findActiveByEmployeeId(emp.id);
      if (!activeContract) {
        continue;
      }

      // Cargas familiares
      const dependents = await this.repos.dependents.listByEmployeeId(emp.id);
      const minorChildrenCount = dependents.filter((d: any) => {
        const isChild = d.parentesco === 'hijo';
        if (!isChild) return false;
        if (d.discapacidad) return true;
        const birthYear = parseInt(String(d.fechaNacimiento).slice(0, 4), 10);
        return year - birthYear < 18;
      }).length;

      // Nivel de instrucción
      const educationLevel: EducationLevel = 'tsu';
      const position = activeContract.positionId ? posMap.get(activeContract.positionId) : null;
      const orgUnit = activeContract.orgUnitId ? unitMap.get(activeContract.orgUnitId) : null;

      // Inasistencias no justificadas (Hito M3)
      let unjustifiedAbsenceDays = 0;
      for (const sheet of attendanceSheets) {
        if (sheet.startDate <= input.periodEnd && sheet.endDate >= input.periodStart) {
          const records = await this.repos.attendance.listRecordsBySheetId(sheet.id);
          const empRecords = records.filter((r) => r.employeeId === emp.id);
          for (const rec of empRecords) {
            if (rec.status === 'falta_injustificada') {
              unjustifiedAbsenceDays += 1;
            }
          }
        }
      }

      const calcResult = calculatePayrollReceipt({
        employee: {
          id: emp.id,
          cedula: `${emp.cedulaTipo}-${emp.cedulaNumero}`,
          fullName: `${emp.nombres} ${emp.apellidos}`,
          positionName: position?.name || 'Empleado General',
          departmentName: orgUnit?.name || 'Dirección General',
          hireDate: activeContract.fechaIngreso,
          educationLevel,
          kidsCount: minorChildrenCount,
        },
        period: {
          year,
          month,
          periodType: input.periodType as PayrollPeriodType,
          startDate: input.periodStart,
          endDate: input.periodEnd,
        },
        baseSalaryMonthly: money(activeContract.salarioBase, 'VES'),
        minSalaryNational: money(minWage, 'VES'),
        cestaTicketMonthly: money('130.00', 'VES'),
        childPremiumUnit: money('12.50', 'VES'),
        unjustifiedAbsenceDays,
        exchangeRateBcv: 36.50,
      });

      const eGross = parseFloat(calcResult.earnings.totalEarnings.amount);
      const eDed = parseFloat(calcResult.deductions.totalDeductions.amount);
      const eNet = parseFloat(calcResult.netPay.amount);

      totalEarningsNum += eGross;
      totalDeductionsNum += eDed;
      totalNetNum += eNet;

      calculatedItems.push({
        empId: emp.id,
        calcResult,
        eGross,
        eDed,
        eNet,
      });
    }

    // Guardar el lote con los totales consolidados
    const createdBatch = await this.repos.payroll.createBatch({
      title: `Nómina ${input.periodStart} al ${input.periodEnd}`,
      periodType: input.periodType,
      year,
      month,
      startDate: input.periodStart,
      endDate: input.periodEnd,
      status: 'cerrada',
      totalEarnings: parseFloat(totalEarningsNum.toFixed(2)),
      totalDeductions: parseFloat(totalDeductionsNum.toFixed(2)),
      totalNet: parseFloat(totalNetNum.toFixed(2)),
      exchangeRateBcv: 36.50,
      processedBy: input.processedBy || 'Analista de Nómina',
    });

    const receiptInputs: Omit<PayrollReceiptRecord, 'id' | 'createdAt'>[] = calculatedItems.map((item) => ({
      payrollId: createdBatch.id,
      employeeId: item.empId,
      snapshot: JSON.stringify(item.calcResult),
      baseSalary: parseFloat(item.calcResult.earnings.baseSalary.amount),
      educationPremium: parseFloat(item.calcResult.earnings.educationPremium.amount),
      seniorityPremium: parseFloat(item.calcResult.earnings.seniorityPremium.amount),
      kidsPremium: parseFloat(item.calcResult.earnings.kidsPremium.amount),
      overtimePay: parseFloat(item.calcResult.earnings.overtimePay.amount),
      nightBonusPay: parseFloat(item.calcResult.earnings.nightBonusPay.amount),
      cestaTicket: parseFloat(item.calcResult.earnings.cestaTicket.amount),
      totalEarnings: item.eGross,
      ivssDeduction: parseFloat(item.calcResult.deductions.ivss.amount),
      faovDeduction: parseFloat(item.calcResult.deductions.faov.amount),
      spfDeduction: parseFloat(item.calcResult.deductions.spf.amount),
      absenceDeduction: parseFloat(item.calcResult.deductions.absenceDeduction.amount),
      totalDeductions: item.eDed,
      netPay: item.eNet,
      netPayUsd: item.calcResult.netPayUsdEquivalent,
      status: 'emitido',
    }));

    const savedReceipts = await this.repos.payroll.saveReceipts(receiptInputs);

    return { batch: createdBatch, receipts: savedReceipts };
  }

  async listBatches(): Promise<PayrollBatch[]> {
    return this.repos.payroll.listBatches();
  }

  async getBatchById(id: string): Promise<PayrollBatch | null> {
    return this.repos.payroll.findBatchById(id);
  }

  async getReceiptById(id: string): Promise<PayrollReceiptRecord | null> {
    return this.repos.payroll.findReceiptById(id);
  }

  async listReceiptsByBatch(batchId: string): Promise<PayrollReceiptRecord[]> {
    return this.repos.payroll.listReceiptsByBatchId(batchId);
  }

  async listReceiptsByWorker(employeeId: string): Promise<PayrollReceiptRecord[]> {
    return this.repos.payroll.listReceiptsByEmployeeId(employeeId);
  }
}
