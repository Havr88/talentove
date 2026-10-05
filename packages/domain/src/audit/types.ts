export type AuditAction =
  | 'CREAR'
  | 'ACTUALIZAR'
  | 'ELIMINAR'
  | 'APROBAR'
  | 'RECHAZAR'
  | 'AJUSTE_ASISTENCIA';

export interface AuditLogEntry {
  readonly id: string;
  readonly entityType: 'TRABAJADOR' | 'ASISTENCIA' | 'NOMINA' | 'PERMISO' | 'PRESTAMO' | 'EXPEDIENTE';
  readonly entityId: string;
  readonly action: AuditAction;
  readonly userId: string;
  readonly ipAddress?: string | undefined;
  readonly fieldChanged?: string | undefined;
  readonly oldValue?: string | null | undefined;
  readonly newValue?: string | null | undefined;
  readonly reason?: string | undefined;
  readonly timestamp: string;
}

export interface AttendanceAuditItem {
  readonly workerId: string;
  readonly date: string;
  readonly field: 'horaEntrada' | 'horaSalida' | 'observaciones' | 'estado';
  readonly oldValue: string;
  readonly newValue: string;
  readonly changedByUserId: string;
  readonly reason: string;
}
