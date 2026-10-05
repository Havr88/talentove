import {
  generateBankPaymentFile,
  money,
  type VenezuelanBankCode,
  type BankPaymentBatchInput,
  type BankPaymentBeneficiary,
  type GeneratedBankFile,
} from '@talento-ve/domain';
import type { Repositories, BankPaymentFileRecord } from '../db/types.js';

export class BankingService {
  constructor(private repos: Repositories) {}

  async generatePayrollBankFile(
    batchId: string,
    bankCode: VenezuelanBankCode,
    companyAccount?: string,
  ): Promise<{ fileRecord: BankPaymentFileRecord; result: GeneratedBankFile }> {
    const run = await this.repos.payroll.findBatchById(batchId);
    if (!run) {
      throw new Error(`Payroll batch ${batchId} not found`);
    }

    const receipts = await this.repos.payroll.listReceiptsByBatchId(batchId);
    const settings = await this.repos.settings.getSettings();

    const companyRif = settings?.nativeId || 'J309999990';
    const companyName = settings?.companyName || 'EMPRESA DEMO C.A.';
    const debitAccount = companyAccount || '01020000000000000000';

    const beneficiaries: BankPaymentBeneficiary[] = [];

    for (const receipt of receipts) {
      if (receipt.netPay <= 0) continue;

      const employee = await this.repos.employees.findById(receipt.employeeId);
      if (!employee) continue;

      const bankAccount = '01020000000000000000';

      beneficiaries.push({
        id: receipt.employeeId,
        fullName: `${employee.nombres} ${employee.apellidos}`.trim(),
        cedulaTipo: (employee.cedulaTipo === 'E' ? 'E' : 'V') as 'V' | 'E',
        cedulaNumero: employee.cedulaNumero.replace(/\D/g, ''),
        bankCode: bankCode,
        accountNumber: bankAccount,
        amount: money(receipt.netPay.toFixed(2), 'VES'),
        referenceNotes: `Nomina ${run.startDate} al ${run.endDate}`,
      });
    }

    const batchInput: BankPaymentBatchInput = {
      header: {
        companyRif,
        companyName,
        debitAccountNumber: debitAccount,
        batchId: run.id.slice(0, 8),
        paymentDate: run.endDate || new Date().toISOString().split('T')[0]!,
        paymentConcept: `Nomina ${run.startDate} al ${run.endDate}`,
      },
      beneficiaries,
    };

    const result = generateBankPaymentFile(bankCode, batchInput);

    const fileRecord: BankPaymentFileRecord = {
      id: `bf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      payrollBatchId: batchId,
      bankCode: result.bankCode,
      bankName: result.bankName,
      fileName: result.fileName,
      content: result.content,
      totalRecords: result.totalRecords,
      totalAmount: Number.parseFloat(result.totalAmountVES),
      hash: result.hash,
      createdAt: new Date().toISOString(),
      createdBy: 'admin',
    };

    await this.repos.bankPayments.save(fileRecord);

    return { fileRecord, result };
  }

  async getBankFilesForRun(batchId: string): Promise<BankPaymentFileRecord[]> {
    return this.repos.bankPayments.listByBatchId(batchId);
  }

  async getBankFileById(fileId: string): Promise<BankPaymentFileRecord | null> {
    return this.repos.bankPayments.findById(fileId);
  }
}
