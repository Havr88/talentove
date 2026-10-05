/**
 * Calculador de Cumplimiento INCES y Programa Nacional de Aprendizaje (PNA)
 * Conforme a la Ley del INCES y su Reglamento.
 */

export interface IncesPnaRequirement {
  readonly totalWorkers: number;
  readonly apprenticeQuota: number;
  readonly activeApprentices: number;
  readonly deficit: number;
  readonly isCompliant: boolean;
  readonly compliancePercentage: number;
}

export interface TrainingCourse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly category: 'tecnica' | 'seguridad' | 'habilidades_blandas' | 'pna_inces';
  readonly durationHours: number;
  readonly minPassingScore: number;
}

export interface TrainingEnrollment {
  readonly id: string;
  readonly courseId: string;
  readonly workerId: string;
  readonly score?: number | undefined;
  readonly status: 'inscrito' | 'en_progreso' | 'aprobado' | 'reprobado';
  readonly completionDate?: string | undefined;
}

/**
 * Calcula la cuota legal obligatoria de aprendices INCES (PNA).
 * Obligación: Empresas con 15 o más trabajadores deben contratar entre el 3% y 5%
 * (regla práctica consolidada: 1 aprendiz por cada 20 trabajadores o fracción superior a 10).
 */
export function calculateIncesPnaQuota(totalWorkers: number, activeApprentices: number): IncesPnaRequirement {
  const workers = Math.max(0, Math.floor(totalWorkers));
  const apprentices = Math.max(0, Math.floor(activeApprentices));

  let apprenticeQuota = 0;
  if (workers >= 15) {
    const baseQuota = Math.floor(workers / 20);
    const remainder = workers % 20;
    apprenticeQuota = remainder > 10 ? baseQuota + 1 : Math.max(1, baseQuota);
  }

  const deficit = Math.max(0, apprenticeQuota - apprentices);
  const isCompliant = apprentices >= apprenticeQuota;
  const compliancePercentage = apprenticeQuota === 0 ? 100 : Math.min(100, Math.round((apprentices / apprenticeQuota) * 100));

  return {
    totalWorkers: workers,
    apprenticeQuota,
    activeApprentices: apprentices,
    deficit,
    isCompliant,
    compliancePercentage,
  };
}

/**
 * Resume las horas de formación acumuladas por un trabajador.
 */
export function summarizeWorkerTraining(
  workerId: string,
  courses: readonly TrainingCourse[],
  enrollments: readonly TrainingEnrollment[]
): {
  totalHoursCompleted: number;
  approvedCoursesCount: number;
  inProgressCoursesCount: number;
} {
  const courseMap = new Map(courses.map((c) => [c.id, c]));
  let totalHoursCompleted = 0;
  let approvedCoursesCount = 0;
  let inProgressCoursesCount = 0;

  for (const enr of enrollments) {
    if (enr.workerId !== workerId) continue;
    const course = courseMap.get(enr.courseId);
    if (!course) continue;

    if (enr.status === 'aprobado') {
      approvedCoursesCount += 1;
      totalHoursCompleted += course.durationHours;
    } else if (enr.status === 'en_progreso') {
      inProgressCoursesCount += 1;
    }
  }

  return {
    totalHoursCompleted,
    approvedCoursesCount,
    inProgressCoursesCount,
  };
}
