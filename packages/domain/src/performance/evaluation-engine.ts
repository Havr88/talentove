/**
 * Motor de Evaluación de Desempeño por Competencias y Metas
 */

export interface PerformanceGoal {
  readonly id: string;
  readonly title: string;
  readonly weightPercentage: number; // Porcentaje de peso (ej. 25%)
  readonly targetValue: number;
  readonly achievedValue: number;
}

export interface CompetencyScore {
  readonly competencyId: string;
  readonly competencyName: string;
  readonly score: number; // Escala 1 a 5
}

export interface PerformanceEvaluationInput {
  readonly workerId: string;
  readonly period: string;
  readonly goals: readonly PerformanceGoal[];
  readonly competencies: readonly CompetencyScore[];
  readonly goalsWeight?: number; // Default 0.60 (60%)
  readonly competenciesWeight?: number; // Default 0.40 (40%)
}

export type PerformanceMeritLevel = 'excepcional' | 'destacado' | 'competente' | 'necesita_mejora' | 'inaceptable';

export interface PerformanceEvaluationResult {
  readonly workerId: string;
  readonly period: string;
  readonly goalsScore: number; // Escala 1 a 5
  readonly competenciesScore: number; // Escala 1 a 5
  readonly finalScore: number; // Escala 1 a 5 con 2 decimales
  readonly meritLevel: PerformanceMeritLevel;
  readonly isEligibleForPromotion: boolean;
  readonly isEligibleForBonus: boolean;
}

/**
 * Calcula la calificación global de desempeño combinando el cumplimiento de metas y la valoración de competencias.
 */
export function calculatePerformanceEvaluation(input: PerformanceEvaluationInput): PerformanceEvaluationResult {
  const goalsWeight = input.goalsWeight !== undefined ? input.goalsWeight : 0.6;
  const competenciesWeight = input.competenciesWeight !== undefined ? input.competenciesWeight : 0.4;

  // 1. Cálculo de Metas
  let goalsWeightedScore = 0;
  let totalGoalWeight = 0;

  for (const g of input.goals) {
    totalGoalWeight += g.weightPercentage;
    const ratio = g.targetValue > 0 ? Math.min(1.25, g.achievedValue / g.targetValue) : 1;
    // Escala 1 a 5: ratio 0 => 1, ratio 1 => 4, ratio >= 1.25 => 5
    const score = Math.max(1, Math.min(5, 1 + ratio * 3.2));
    goalsWeightedScore += score * (g.weightPercentage / 100);
  }

  // Normalizar metas si los pesos no suman exactamente 100
  const normalizedGoalsScore = totalGoalWeight > 0 ? (goalsWeightedScore / (totalGoalWeight / 100)) : 3.0;

  // 2. Cálculo de Competencias
  let totalCompetencyScore = 0;
  for (const c of input.competencies) {
    const s = Math.max(1, Math.min(5, c.score));
    totalCompetencyScore += s;
  }
  const avgCompetencyScore = input.competencies.length > 0 ? totalCompetencyScore / input.competencies.length : 3.0;

  // 3. Calificación Final Ponderada
  const rawFinal = (normalizedGoalsScore * goalsWeight) + (avgCompetencyScore * competenciesWeight);
  const finalScore = Math.round(rawFinal * 100) / 100;

  // 4. Nivel de Mérito
  let meritLevel: PerformanceMeritLevel = 'competente';
  if (finalScore >= 4.5) {
    meritLevel = 'excepcional';
  } else if (finalScore >= 3.8) {
    meritLevel = 'destacado';
  } else if (finalScore >= 2.8) {
    meritLevel = 'competente';
  } else if (finalScore >= 2.0) {
    meritLevel = 'necesita_mejora';
  } else {
    meritLevel = 'inaceptable';
  }

  const isEligibleForPromotion = finalScore >= 4.2;
  const isEligibleForBonus = finalScore >= 3.5;

  return {
    workerId: input.workerId,
    period: input.period,
    goalsScore: Math.round(normalizedGoalsScore * 100) / 100,
    competenciesScore: Math.round(avgCompetencyScore * 100) / 100,
    finalScore,
    meritLevel,
    isEligibleForPromotion,
    isEligibleForBonus,
  };
}
