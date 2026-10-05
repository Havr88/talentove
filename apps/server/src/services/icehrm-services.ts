import { randomUUID } from 'node:crypto';
import {
  calculateVacationEntitlement,
  breakDownLeavePeriod,
  calculateReturnDate,
  calculateVacationBalance,
  calculateOvertimePayroll,
  validateSeveranceAdvance,
  calculateAndApplyLoanDeduction,
  createAttendanceAuditEntry,
  validateCustomFields,
  calculateTravelSettlement,
  type LeaveType,
  type LeaveStatus,
  type LeaveRequest,
  type VacationEntitlement,
  type WorkerVacationBalance,
  type OvertimeCategory,
  type OvertimeRequest,
  type OvertimeCalculationResult,
  type WorkerLoan,
  type LoanDeductionResult,
  type CustomFieldDefinition,
  type TravelRecord,
  type TravelSettlementResult,
} from '@talento-ve/domain';

export class IceHrmServices {
  /**
   * Procesa y valida una solicitud de permiso o vacaciones según la LOTTT.
   */
  static createLeaveRequest(params: {
    workerId: string;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason?: string | undefined;
    holidays?: string[];
  }): LeaveRequest {
    const holidays = params.holidays ?? [];
    const days = breakDownLeavePeriod(params.startDate, params.endDate, holidays);
    const returnDate = calculateReturnDate(params.endDate, holidays);
    const totalBusinessDays = days.filter((d) => d.isBusinessDay).length;

    const request: LeaveRequest = {
      id: `leave-${randomUUID()}`,
      workerId: params.workerId,
      leaveType: params.leaveType,
      startDate: params.startDate,
      endDate: params.endDate,
      returnDate,
      reason: params.reason,
      status: 'PENDIENTE',
      totalCalendarDays: days.length,
      totalBusinessDays,
      days,
      createdAt: new Date().toISOString(),
    };

    return Object.freeze(request);
  }

  /**
   * Obtiene la titularidad y balance de vacaciones de un trabajador.
   */
  static getVacationBalance(
    workerId: string,
    yearsOfService: number,
    daysTaken: number = 0,
    daysPending: number = 0
  ): WorkerVacationBalance {
    return calculateVacationBalance(workerId, yearsOfService, daysTaken, daysPending);
  }

  /**
   * Genera el resumen y montos a pagar de horas extras para el cálculo de nómina.
   */
  static computeOvertimeForPayroll(
    requests: readonly OvertimeRequest[],
    baseHourlyRate: number
  ): OvertimeCalculationResult {
    return calculateOvertimePayroll(requests, baseHourlyRate);
  }

  /**
   * Registra un nuevo préstamo o anticipo validando el tope legal del 75% en prestaciones (Art. 144 LOTTT).
   */
  static registerLoan(params: {
    workerId: string;
    loanType: 'ANTICIPO_PRESTACIONES' | 'PRESTAMO_PERSONAL' | 'CAJA_AHORRO' | 'OTRO';
    totalAmount: number;
    installmentAmount: number;
    accumulatedSeveranceFund?: number;
    startDate: string;
    details?: string;
  }): WorkerLoan {
    if (params.loanType === 'ANTICIPO_PRESTACIONES') {
      const fund = params.accumulatedSeveranceFund ?? params.totalAmount;
      if (!validateSeveranceAdvance(params.totalAmount, fund)) {
        throw new Error('El anticipo de prestaciones excede el 75% máximo legal permitido por el Art. 144 de la LOTTT.');
      }
    }

    const loan: WorkerLoan = {
      id: `loan-${randomUUID()}`,
      workerId: params.workerId,
      loanType: params.loanType,
      totalAmount: params.totalAmount,
      installmentAmount: params.installmentAmount,
      remainingBalance: params.totalAmount,
      startDate: params.startDate,
      status: 'APROBADO',
      installmentsPaid: 0,
      reason: params.details,
    };

    return Object.freeze(loan);
  }

  /**
   * Deduce la cuota de amortización de un préstamo para una corrida de nómina.
   */
  static deductLoanInstallment(loan: WorkerLoan): LoanDeductionResult {
    return calculateAndApplyLoanDeduction(loan);
  }

  /**
   * Registra una rectificación en la hoja de asistencia garantizando la trazabilidad exigida por la LOTTT.
   */
  static auditAttendanceCorrection(params: {
    workerId: string;
    date: string;
    field: 'horaEntrada' | 'horaSalida' | 'observaciones' | 'estado';
    oldValue: string;
    newValue: string;
    changedByUserId: string;
    reason: string;
  }) {
    return createAttendanceAuditEntry(params);
  }

  /**
   * Valida campos personalizados dinámicos para el expediente de personal.
   */
  static validateCustomFields(
    definitions: readonly CustomFieldDefinition[],
    values: Record<string, unknown>
  ) {
    return validateCustomFields(definitions, values);
  }

  /**
   * Liquida y concilia los gastos y anticipos de una comisión de servicio/viático.
   */
  static settleTravel(record: TravelRecord): TravelSettlementResult {
    return calculateTravelSettlement(record);
  }
}
