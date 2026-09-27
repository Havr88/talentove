/**
 * Motor de Cálculo de Asistencia y Jornadas Laborales de Venezuela (LOTTT)
 * Art. 173 (Jornadas Diurna, Nocturna y Mixta)
 * Art. 118 (Horas extraordinarias diurnas con 50% de recargo)
 * Art. 117 (Bono nocturno con 30% de recargo)
 */

export interface DayWorkSummary {
  regularHours: number;
  overtimeDayHours: number;
  overtimeNightHours: number;
  nightShiftHours: number;
}

/**
 * Convierte un string de hora 'HH:MM' a minutos desde la medianoche.
 */
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map((x) => Number.parseInt(x, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Calcula las horas ordinarias, extras diurnas, nocturnas y bono nocturno
 * dado un horario de entrada y salida en formato 'HH:MM'.
 */
export function computeDailyHours(timeIn: string, timeOut: string, expectedDailyHours = 8): DayWorkSummary {
  const inMin = timeToMinutes(timeIn);
  let outMin = timeToMinutes(timeOut);

  // Si sale después de medianoche (ej. entra 20:00 y sale 04:00)
  if (outMin < inMin) {
    outMin += 24 * 60;
  }

  const totalMinutes = Math.max(0, outMin - inMin);
  const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

  // Fronteras de horario nocturno en Venezuela (19:00 a 05:00) = 1140 min a 300 min
  let nightMinutes = 0;
  for (let m = inMin; m < outMin; m++) {
    const modMin = m % (24 * 60);
    if (modMin >= 19 * 60 || modMin < 5 * 60) {
      nightMinutes++;
    }
  }

  const nightHours = Math.round((nightMinutes / 60) * 100) / 100;
  const dayHours = Math.max(0, Math.round((totalHours - nightHours) * 100) / 100);

  let regularHours = 0;
  let overtimeDayHours = 0;
  let overtimeNightHours = 0;

  if (totalHours <= expectedDailyHours) {
    regularHours = totalHours;
  } else {
    regularHours = expectedDailyHours;
    const excess = totalHours - expectedDailyHours;

    // Distribuir el exceso proporcionalmente o según nocturnidad
    if (nightHours > 0) {
      const nightRatio = nightHours / totalHours;
      overtimeNightHours = Math.round(excess * nightRatio * 100) / 100;
      overtimeDayHours = Math.round((excess - overtimeNightHours) * 100) / 100;
    } else {
      overtimeDayHours = Math.round(excess * 100) / 100;
    }
  }

  return {
    regularHours,
    overtimeDayHours,
    overtimeNightHours,
    nightShiftHours: nightHours,
  };
}

export interface EmployeeWeeklySummary {
  employeeId: string;
  daysAttended: number;
  daysUnjustified: number;
  daysJustified: number;
  totalRegularHours: number;
  totalOvertimeDay: number;
  totalOvertimeNight: number;
  totalNightShift: number;
  allSigned: boolean;
}

export function computeWeeklySummary(records: {
  employeeId: string;
  status: string;
  regularHours: number;
  overtimeDayHours: number;
  overtimeNightHours: number;
  nightShiftHours: number;
  workerSigned: boolean;
}[]): Map<string, EmployeeWeeklySummary> {
  const map = new Map<string, EmployeeWeeklySummary>();

  for (const r of records) {
    let summary = map.get(r.employeeId);
    if (!summary) {
      summary = {
        employeeId: r.employeeId,
        daysAttended: 0,
        daysUnjustified: 0,
        daysJustified: 0,
        totalRegularHours: 0,
        totalOvertimeDay: 0,
        totalOvertimeNight: 0,
        totalNightShift: 0,
        allSigned: true,
      };
      map.set(r.employeeId, summary);
    }

    if (r.status === 'asistio') {
      summary.daysAttended++;
      summary.totalRegularHours += r.regularHours;
      summary.totalOvertimeDay += r.overtimeDayHours;
      summary.totalOvertimeNight += r.overtimeNightHours;
      summary.totalNightShift += r.nightShiftHours;
    } else if (r.status === 'falta_injustificada') {
      summary.daysUnjustified++;
    } else if (r.status === 'falta_justificada' || r.status === 'reposo_ivss') {
      summary.daysJustified++;
    }

    if (!r.workerSigned && r.status === 'asistio') {
      summary.allSigned = false;
    }
  }

  // Redondear totales
  for (const s of map.values()) {
    s.totalRegularHours = Math.round(s.totalRegularHours * 100) / 100;
    s.totalOvertimeDay = Math.round(s.totalOvertimeDay * 100) / 100;
    s.totalOvertimeNight = Math.round(s.totalOvertimeNight * 100) / 100;
    s.totalNightShift = Math.round(s.totalNightShift * 100) / 100;
  }

  return map;
}
