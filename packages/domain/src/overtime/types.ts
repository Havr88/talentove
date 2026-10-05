export type OvertimeCategory =
  | 'DIURNA'                  // 50% recargo (Art. 118 LOTTT)
  | 'NOCTURNA'                // 30% nocturnidad + 50% horas extras = 95% recargo
  | 'FERIADO_DESCANSO'        // 50% recargo día feriado/descanso (Art. 119 y 120 LOTTT)
  | 'BONO_NOCTURNO_ORDINARIO'; // 30% prima de jornada nocturna ordinaria (Art. 117 LOTTT)

export type OvertimeStatus = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

export interface OvertimeRequest {
  readonly id: string;
  readonly workerId: string;
  readonly date: string;       // YYYY-MM-DD
  readonly startTime: string;  // ISO timestamp o HH:mm
  readonly endTime: string;    // ISO timestamp o HH:mm
  readonly category: OvertimeCategory;
  readonly hours: number;
  readonly reason?: string | undefined;
  readonly status: OvertimeStatus;
  readonly approvedBy?: string | undefined;
}

export interface OvertimeCalculationResult {
  readonly totalHours: number;
  readonly hoursByCategory: Record<OvertimeCategory, number>;
  readonly payByCategory: Record<OvertimeCategory, number>;
  readonly totalOvertimePay: number;
}
