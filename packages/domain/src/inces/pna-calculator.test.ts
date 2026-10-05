import { describe, it, expect } from 'vitest';
import { calculateIncesPnaQuota, summarizeWorkerTraining, type TrainingCourse, type TrainingEnrollment } from './pna-calculator.js';

describe('INCES / PNA Calculator', () => {
  it('no exige cuota para menos de 15 trabajadores', () => {
    const res = calculateIncesPnaQuota(14, 0);
    expect(res.apprenticeQuota).toBe(0);
    expect(res.deficit).toBe(0);
    expect(res.isCompliant).toBe(true);
    expect(res.compliancePercentage).toBe(100);
  });

  it('exige 1 aprendiz para entre 15 y 30 trabajadores', () => {
    const res15 = calculateIncesPnaQuota(15, 0);
    expect(res15.apprenticeQuota).toBe(1);
    expect(res15.deficit).toBe(1);
    expect(res15.isCompliant).toBe(false);

    const res25 = calculateIncesPnaQuota(25, 1);
    expect(res25.apprenticeQuota).toBe(1);
    expect(res25.deficit).toBe(0);
    expect(res25.isCompliant).toBe(true);
    expect(res25.compliancePercentage).toBe(100);
  });

  it('calcula fracción excedente de 10 para requerir aprendiz adicional', () => {
    // 31 trabajadores: 31 / 20 = 1, resto 11 > 10 => 2 aprendices
    const res31 = calculateIncesPnaQuota(31, 1);
    expect(res31.apprenticeQuota).toBe(2);
    expect(res31.deficit).toBe(1);
    expect(res31.compliancePercentage).toBe(50);

    // 50 trabajadores: 50 / 20 = 2, resto 10 <= 10 => 2 aprendices
    const res50 = calculateIncesPnaQuota(50, 2);
    expect(res50.apprenticeQuota).toBe(2);
    expect(res50.deficit).toBe(0);

    // 51 trabajadores: 51 / 20 = 2, resto 11 > 10 => 3 aprendices
    const res51 = calculateIncesPnaQuota(51, 1);
    expect(res51.apprenticeQuota).toBe(3);
    expect(res51.deficit).toBe(2);
  });

  it('calcula horas de formación y cursos aprobados por trabajador', () => {
    const courses: TrainingCourse[] = [
      { id: 'c1', code: 'SST-01', title: 'Seguridad y Salud Laboral LOPCYMAT', category: 'seguridad', durationHours: 16, minPassingScore: 12 },
      { id: 'c2', code: 'TEC-02', title: 'Operación Segura de Maquinaria', category: 'tecnica', durationHours: 40, minPassingScore: 14 },
      { id: 'c3', code: 'HAB-03', title: 'Comunicación Asertiva', category: 'habilidades_blandas', durationHours: 8, minPassingScore: 10 },
    ];

    const enrollments: TrainingEnrollment[] = [
      { id: 'e1', courseId: 'c1', workerId: 'w-101', status: 'aprobado', score: 18 },
      { id: 'e2', courseId: 'c2', workerId: 'w-101', status: 'en_progreso' },
      { id: 'e3', courseId: 'c3', workerId: 'w-101', status: 'reprobado', score: 8 },
      { id: 'e4', courseId: 'c1', workerId: 'w-102', status: 'aprobado', score: 15 },
    ];

    const summary = summarizeWorkerTraining('w-101', courses, enrollments);
    expect(summary.totalHoursCompleted).toBe(16);
    expect(summary.approvedCoursesCount).toBe(1);
    expect(summary.inProgressCoursesCount).toBe(1);
  });
});
