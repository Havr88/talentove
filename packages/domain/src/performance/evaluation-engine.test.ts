import { describe, it, expect } from 'vitest';
import { calculatePerformanceEvaluation } from './evaluation-engine.js';

describe('Performance Evaluation Engine', () => {
  it('calcula calificación ponderada de metas y competencias con mérito destacado', () => {
    const res = calculatePerformanceEvaluation({
      workerId: 'emp-001',
      period: '2026-Q1',
      goals: [
        { id: 'g1', title: 'Resolución de tickets', weightPercentage: 50, targetValue: 100, achievedValue: 100 },
        { id: 'g2', title: 'Disponibilidad de sistemas', weightPercentage: 50, targetValue: 99, achievedValue: 99 },
      ],
      competencies: [
        { competencyId: 'c1', competencyName: 'Trabajo en Equipo', score: 4.5 },
        { competencyId: 'c2', competencyName: 'Liderazgo e Innovación', score: 4.0 },
      ],
    });

    expect(res.finalScore).toBeGreaterThanOrEqual(3.8);
    expect(res.meritLevel).toBe('destacado');
    expect(res.isEligibleForBonus).toBe(true);
  });

  it('determina nivel excepcional cuando sobrepasa metas y competencias', () => {
    const res = calculatePerformanceEvaluation({
      workerId: 'emp-002',
      period: '2026-Q1',
      goals: [
        { id: 'g1', title: 'Capacitaciones dictadas', weightPercentage: 100, targetValue: 10, achievedValue: 13 },
      ],
      competencies: [
        { competencyId: 'c1', competencyName: 'Compromiso Institucional', score: 5.0 },
        { competencyId: 'c2', competencyName: 'Excelencia Técnica', score: 5.0 },
      ],
    });

    expect(res.finalScore).toBeGreaterThanOrEqual(4.5);
    expect(res.meritLevel).toBe('excepcional');
    expect(res.isEligibleForPromotion).toBe(true);
    expect(res.isEligibleForBonus).toBe(true);
  });

  it('detecta bajo rendimiento y necesidad de mejora', () => {
    const res = calculatePerformanceEvaluation({
      workerId: 'emp-003',
      period: '2026-Q1',
      goals: [
        { id: 'g1', title: 'Proyectos entregados', weightPercentage: 100, targetValue: 10, achievedValue: 3 },
      ],
      competencies: [
        { competencyId: 'c1', competencyName: 'Puntualidad', score: 2.0 },
      ],
    });

    expect(res.finalScore).toBeLessThan(2.8);
    expect(res.isEligibleForBonus).toBe(false);
    expect(res.isEligibleForPromotion).toBe(false);
  });
});
