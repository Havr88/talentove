export type LeaveType =
  | 'VACACIONES'
  | 'PERMISO_MEDICO'
  | 'PERMISO_PATERNIDAD'
  | 'PERMISO_MATERNIDAD'
  | 'DUELO'
  | 'MATRIMONIO'
  | 'ESTUDIO'
  | 'NO_REMUNERADO'
  | 'DILIGENCIA_PERSONAL';

export type LeaveStatus =
  | 'PENDIENTE'
  | 'APROBADO'
  | 'RECHAZADO'
  | 'CANCELACION_SOLICITADA'
  | 'CANCELADO';

export type LeaveDayFraction =
  | 'COMPLETO'
  | 'MEDIO_TURNO_MANANA'
  | 'MEDIO_TURNO_TARDE';

export interface LeaveDayDetail {
  readonly date: string; // YYYY-MM-DD
  readonly fraction: LeaveDayFraction;
  readonly isBusinessDay: boolean;
  readonly isHoliday: boolean;
  readonly dayCount: number; // 1.0 o 0.5
}

export interface LeaveLogEntry {
  readonly id: string;
  readonly leaveId: string;
  readonly fromStatus: LeaveStatus;
  readonly toStatus: LeaveStatus;
  readonly userId: string;
  readonly note?: string | undefined;
  readonly timestamp: string;
}

export interface LeaveRequest {
  readonly id: string;
  readonly workerId: string;
  readonly leaveType: LeaveType;
  readonly startDate: string; // YYYY-MM-DD
  readonly endDate: string;   // YYYY-MM-DD
  readonly returnDate: string; // YYYY-MM-DD
  readonly reason?: string | undefined;
  readonly status: LeaveStatus;
  readonly totalCalendarDays: number;
  readonly totalBusinessDays: number;
  readonly days: readonly LeaveDayDetail[];
  readonly approvedBy?: string | undefined;
  readonly createdAt: string;
}

export interface VacationEntitlement {
  readonly yearsOfService: number;
  readonly vacationDays: number;     // Art. 190 LOTTT: 15 + 1 por año hasta 30
  readonly bonusDays: number;        // Art. 192 LOTTT: 15 + 1 por año hasta 30
}

export interface WorkerVacationBalance {
  readonly workerId: string;
  readonly yearsOfService: number;
  readonly entitlementDays: number;
  readonly bonusDays: number;
  readonly daysTaken: number;
  readonly daysPending: number;
  readonly daysAvailable: number;
}
