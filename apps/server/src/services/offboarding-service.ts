import {
  calculateLiquidation,
  money,
  type LiquidationInput,
  type LiquidationResult,
  type LiquidationReason,
} from '@talento-ve/domain';
import type { Repositories } from '../db/types.js';
import { generateSettlementPdf, generateForma14100Pdf } from './offboarding-pdf.js';

export class OffboardingService {
  constructor(private repos: Repositories) {}

  async computeLiquidation(params: {
    employeeId: string;
    terminationDate: string;
    reason: LiquidationReason;
    unpaidSalaryDays?: number;
    pendingVacationDays?: number;
    otherDeductions?: number;
  }): Promise<{
    result: LiquidationResult;
    employeeFullName: string;
    nationalId: string;
    positionTitle: string;
    hireDate: string;
    baseSalary: number;
    dailyIntegralSalary: number;
  }> {
    const employee = await this.repos.employees.findById(params.employeeId);
    if (!employee) {
      throw new Error(`Empleado ${params.employeeId} no encontrado`);
    }

    const contracts = await this.repos.contracts.findByEmployeeId(params.employeeId);
    const contract = contracts[0];
    const position = contract?.positionId ? await this.repos.positions.findById(contract.positionId) : null;
    const baseSalaryNum = contract ? Number.parseFloat(contract.salarioBase) : 130;
    const hireDate = contract?.fechaIngreso || employee.createdAt.slice(0, 10);

    // Salario integral diario: (base + 15 dias bono vacacional/360 + 30 dias utilidades/360) / 30
    const dailyBase = baseSalaryNum / 30;
    const vacAlicuota = (15 / 360) * dailyBase;
    const utilAlicuota = (30 / 360) * dailyBase;
    const dailyIntegral = dailyBase + vacAlicuota + utilAlicuota;

    const liquidationInput: LiquidationInput = {
      employeeId: employee.id,
      hireDate,
      terminationDate: params.terminationDate,
      reason: params.reason,
      baseSalaryMonthly: money(baseSalaryNum.toFixed(2), 'VES'),
      lastIntegralSalaryDaily: money(dailyIntegral.toFixed(2), 'VES'),
      pendingVacationDays: params.pendingVacationDays || 0,
      daysOfUtilitiesAnnual: 30,
    };

    const result = calculateLiquidation(liquidationInput, new Date().toISOString().slice(0, 10));

    return {
      result,
      employeeFullName: `${employee.nombres} ${employee.apellidos}`,
      nationalId: `${employee.cedulaTipo}-${employee.cedulaNumero}`,
      positionTitle: position?.name || 'Colaborador',
      hireDate,
      baseSalary: baseSalaryNum,
      dailyIntegralSalary: dailyIntegral,
    };
  }

  async generateSettlementDocument(params: {
    employeeId: string;
    terminationDate: string;
    reason: LiquidationReason;
    unpaidSalaryDays?: number;
    pendingVacationDays?: number;
    otherDeductions?: number;
  }): Promise<Buffer> {
    const { result, employeeFullName, nationalId, positionTitle, hireDate, baseSalary, dailyIntegralSalary } =
      await this.computeLiquidation(params);
    const settings = await this.repos.settings.getSettings();

    return generateSettlementPdf({
      companyName: settings?.companyName || 'EMPRESA DEMO C.A.',
      nativeId: settings?.nativeId || 'J309999990',
      employeeFullName,
      nationalId,
      positionTitle,
      hireDate,
      terminationDate: params.terminationDate,
      terminationReason: params.reason,
      baseSalary,
      dailyIntegralSalary,
      result,
    });
  }

  async generateForma14100Document(params: {
    employeeId: string;
    terminationDate: string;
    reason: LiquidationReason;
  }): Promise<Buffer> {
    const employee = await this.repos.employees.findById(params.employeeId);
    if (!employee) throw new Error(`Empleado ${params.employeeId} no encontrado`);
    const contracts = await this.repos.contracts.findByEmployeeId(params.employeeId);
    const contract = contracts[0];
    const settings = await this.repos.settings.getSettings();

    return generateForma14100Pdf({
      companyName: settings?.companyName || 'EMPRESA DEMO C.A.',
      nativeId: settings?.nativeId || 'J309999990',
      ivssEmployerNumber: '109999999',
      employeeFullName: `${employee.nombres} ${employee.apellidos}`,
      nationalId: `${employee.cedulaTipo}-${employee.cedulaNumero}`,
      hireDate: contract?.fechaIngreso || employee.createdAt.slice(0, 10),
      terminationDate: params.terminationDate,
      lastSalary: contract ? Number.parseFloat(contract.salarioBase) : 130,
      terminationReason: params.reason,
    });
  }
}
