/**
 * Módulo de Dominio para ATS (Applicant Tracking System) y Reclutamiento
 */

export type JobPostingStatus = 'borrador' | 'publicada' | 'pausada' | 'cerrada';
export type JobPostingType = 'interna' | 'publica' | 'mixta';

export interface JobPosting {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly orgUnitId: string;
  readonly positionId: number;
  readonly type: JobPostingType;
  readonly status: JobPostingStatus;
  readonly vacanciesCount: number;
  readonly salaryMinBs?: string;
  readonly salaryMaxBs?: string;
  readonly description: string;
  readonly requirements: readonly string[];
  readonly closingDate?: string;
  readonly createdAt: string;
}

export type ApplicationStage = 'postulado' | 'revision' | 'entrevista' | 'oferta' | 'contratado' | 'descartado';

export interface CandidateProfile {
  readonly cedulaTipo: 'V' | 'E';
  readonly cedulaNumero: string;
  readonly nombres: string;
  readonly apellidos: string;
  readonly email: string;
  readonly telefono: string;
  readonly direccion?: string;
  readonly resumenCurricular?: string;
  readonly anosExperiencia: number;
  readonly nivelEducativo: 'bachiller' | 'tecnico' | 'universitario' | 'postgrado';
}

export interface JobApplication {
  readonly id: string;
  readonly jobPostingId: string;
  readonly candidate: CandidateProfile;
  readonly stage: ApplicationStage;
  readonly score?: number; // 1-100
  readonly notes?: string;
  readonly stageUpdatedAt: string;
  readonly createdAt: string;
}

export type InterviewStatus = 'programada' | 'confirmada' | 'realizada' | 'cancelada';

export interface JobInterview {
  readonly id: string;
  readonly applicationId: string;
  readonly interviewerId: string;
  readonly scheduledAt: string;
  readonly locationOrUrl: string;
  readonly status: InterviewStatus;
  readonly rating?: number; // 1 a 5
  readonly feedback?: string;
}

/**
 * Valida si una transición de etapa en el pipeline ATS es válida.
 */
export function isValidStageTransition(currentStage: ApplicationStage, nextStage: ApplicationStage): boolean {
  if (currentStage === nextStage) return true;
  if (currentStage === 'contratado') return false; // Estado terminal
  if (currentStage === 'descartado') {
    // Solo puede reactivarse a revisión
    return nextStage === 'revision';
  }

  const validNext: Record<ApplicationStage, readonly ApplicationStage[]> = {
    postulado: ['revision', 'descartado'],
    revision: ['entrevista', 'oferta', 'descartado'],
    entrevista: ['oferta', 'revision', 'descartado'],
    oferta: ['contratado', 'revision', 'descartado'],
    contratado: [],
    descartado: ['revision'],
  };

  return validNext[currentStage]?.includes(nextStage) ?? false;
}

/**
 * Prepara el payload para la creación directa del empleado en el expediente digital
 * evitando la doble captura de datos.
 */
export function mapApplicationToEmployeePayload(
  application: JobApplication,
  hiringDate: string,
  salaryBs: string
): {
  cedulaTipo: 'V' | 'E';
  cedulaNumero: string;
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string;
  direccionPrincipal: string;
  fechaIngreso: string;
  salarioBaseBs: string;
} {
  return {
    cedulaTipo: application.candidate.cedulaTipo,
    cedulaNumero: application.candidate.cedulaNumero,
    nombres: application.candidate.nombres,
    apellidos: application.candidate.apellidos,
    email: application.candidate.email,
    telefono: application.candidate.telefono,
    direccionPrincipal: application.candidate.direccion || 'Dirección no especificada',
    fechaIngreso: hiringDate,
    salarioBaseBs: salaryBs,
  };
}
