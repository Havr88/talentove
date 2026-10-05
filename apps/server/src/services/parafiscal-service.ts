import {
  generateTiunaIvssTxt,
  generateFaovBanavihTxt,
  generateIncesSummary,
  money,
  type ParafiscalCompanyHeader,
  type ParafiscalWorkerEntry,
  type GeneratedParafiscalFile,
} from '@talento-ve/domain';
import type { Repositories } from '../db/types.js';

export class ParafiscalService {
  constructor(private repos: Repositories) {}

  private async collectParafiscalData(batchId: string): Promise<{
    header: ParafiscalCompanyHeader;
    workers: ParafiscalWorkerEntry[];
  }> {
    const run = await this.repos.payroll.findBatchById(batchId);
    if (!run) {
      throw new Error(`Payroll batch ${batchId} not found`);
    }

    const receipts = await this.repos.payroll.listReceiptsByBatchId(batchId);
    const settings = await this.repos.settings.getSettings();

    const companyRif = settings?.nativeId || 'J309999990';
    const companyName = settings?.companyName || 'EMPRESA DEMO C.A.';
    const ivssPatronalNumber = '109999999';
    const banavihNumber = '0000099999';

    const header: ParafiscalCompanyHeader = {
      companyName,
      companyRif,
      ivssPatronalNumber,
      banavihNumber,
      periodYear: run.year,
      periodMonth: run.month,
    };

    const workers: ParafiscalWorkerEntry[] = [];

    for (const receipt of receipts) {
      const employee = await this.repos.employees.findById(receipt.employeeId);
      if (!employee) continue;

      const contracts = await this.repos.contracts.findByEmployeeId(receipt.employeeId);
      const contract = contracts[0];

      workers.push({
        employeeId: employee.id,
        cedulaTipo: (employee.cedulaTipo === 'E' ? 'E' : 'V') as 'V' | 'E',
        cedulaNumero: employee.cedulaNumero.replace(/\D/g, ''),
        fullName: `${employee.nombres} ${employee.apellidos}`.trim(),
        hireDate: contract?.fechaIngreso || employee.createdAt.slice(0, 10),
        baseSalary: money(receipt.baseSalary.toFixed(2), 'VES'),
        totalEarnings: money(receipt.totalEarnings.toFixed(2), 'VES'),
        ivssWorkerDeduction: money(receipt.ivssDeduction.toFixed(2), 'VES'),
        ivssEmployerContribution: money((receipt.ivssDeduction * 2.25).toFixed(2), 'VES'), // 9% patronal aprox
        faovWorkerDeduction: money(receipt.faovDeduction.toFixed(2), 'VES'),
        faovEmployerContribution: money((receipt.faovDeduction * 2).toFixed(2), 'VES'), // 2% patronal vs 1% trabajador
        spfWorkerDeduction: money(receipt.spfDeduction.toFixed(2), 'VES'),
        spfEmployerContribution: money((receipt.spfDeduction * 4).toFixed(2), 'VES'), // 2% patronal vs 0.5% trabajador
      });
    }

    return { header, workers };
  }

  async generateIvssFile(batchId: string): Promise<GeneratedParafiscalFile> {
    const data = await this.collectParafiscalData(batchId);
    return generateTiunaIvssTxt(data.header, data.workers);
  }

  async generateFaovFile(batchId: string): Promise<GeneratedParafiscalFile> {
    const data = await this.collectParafiscalData(batchId);
    return generateFaovBanavihTxt(data.header, data.workers);
  }

  async generateIncesReport(batchId: string): Promise<GeneratedParafiscalFile> {
    const data = await this.collectParafiscalData(batchId);
    return generateIncesSummary(data.header, data.workers);
  }
}
