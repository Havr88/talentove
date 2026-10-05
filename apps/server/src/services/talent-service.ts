/**
 * Servicio de Gestión de Talento: ATS Kanban, Formación INCES/PNA y Desempeño
 */
import {
  calculateIncesPnaQuota,
  calculatePerformanceEvaluation,
  isValidStageTransition,
  type IncesPnaRequirement,
  type PerformanceEvaluationInput,
  type PerformanceEvaluationResult,
} from '@talento-ve/domain';
import type { Repositories } from '../db/types.js';

export class TalentService {
  constructor(private repos: Repositories) {}

  // =========================================================================
  // 1. INCES / Programa Nacional de Aprendizaje (PNA) y Formación
  // =========================================================================
  async getIncesPnaStatus(): Promise<IncesPnaRequirement> {
    const totalWorkers = await this.repos.employees.count();
    // Aprendices activos: aquellos contratos o cargos vinculados a PNA/aprendiz
    const employees = await this.repos.employees.list();
    const positions = await this.repos.positions.list();
    const posMap = new Map(positions.map((p) => [p.id, p.name.toLowerCase()]));

    let activeApprentices = 0;
    for (const emp of employees) {
      const contract = await this.repos.contracts.findActiveByEmployeeId(emp.id);
      if (contract) {
        const posName = posMap.get(contract.positionId) || '';
        if (posName.includes('aprendiz') || posName.includes('inces') || contract.contractType.toLowerCase().includes('aprendizaje')) {
          activeApprentices += 1;
        }
      }
    }

    return calculateIncesPnaQuota(totalWorkers, activeApprentices);
  }

  async listTrainingCatalog() {
    return this.repos.training.listCourses();
  }

  async createTrainingCourse(data: {
    code: string;
    title: string;
    category: 'tecnica' | 'seguridad' | 'habilidades_blandas' | 'pna_inces';
    durationHours: number;
    minPassingScore: number;
  }) {
    return this.repos.training.createCourse(data);
  }

  async listWorkerTraining(workerId: string) {
    return this.repos.training.listEnrollments(workerId);
  }

  async enrollWorkerInCourse(workerId: string, courseId: string) {
    return this.repos.training.enrollWorker({
      workerId,
      courseId,
      status: 'inscrito',
    });
  }

  // =========================================================================
  // 2. Evaluación de Desempeño
  // =========================================================================
  async recordEvaluation(input: PerformanceEvaluationInput & { evaluatorId?: string; comments?: string }): Promise<PerformanceEvaluationResult> {
    const result = calculatePerformanceEvaluation(input);

    await this.repos.performance.create({
      workerId: input.workerId,
      period: input.period,
      goalsScore: result.goalsScore,
      competenciesScore: result.competenciesScore,
      finalScore: result.finalScore,
      meritLevel: result.meritLevel,
      isEligibleForPromotion: result.isEligibleForPromotion,
      isEligibleForBonus: result.isEligibleForBonus,
      evaluatorId: input.evaluatorId,
      comments: input.comments,
    });

    return result;
  }

  async listWorkerEvaluations(workerId?: string) {
    return this.repos.performance.list(workerId);
  }

  // =========================================================================
  // 3. ATS y Pipeline de Reclutamiento Kanban
  // =========================================================================
  async listJobPostings() {
    return this.repos.jobPostings.list();
  }

  async getJobPostingWithApplications(postingId: string) {
    const posting = await this.repos.jobPostings.findById(postingId);
    if (!posting) return null;
    const applications = await this.repos.jobApplications.listByPostingId(postingId);
    return { posting, applications };
  }

  async createJobPosting(data: {
    code: string;
    title: string;
    orgUnitId: string;
    positionId: number;
    type: 'interna' | 'publica' | 'mixta';
    vacanciesCount: number;
    salaryMinBs?: string;
    salaryMaxBs?: string;
    description: string;
    requirements: string[];
    closingDate?: string;
  }) {
    return this.repos.jobPostings.create({
      ...data,
      status: 'publicada',
    });
  }

  async applyToJobPosting(data: {
    jobPostingId: string;
    candidateName: string;
    candidateCedula: string;
    candidateEmail: string;
    candidatePhone: string;
    candidateAddress?: string;
    notes?: string;
  }) {
    return this.repos.jobApplications.create({
      ...data,
      stage: 'postulado',
    });
  }

  async moveApplicationStage(applicationId: string, nextStage: 'postulado' | 'revision' | 'entrevista' | 'oferta' | 'contratado' | 'descartado', notes?: string) {
    const app = await this.repos.jobApplications.findById(applicationId);
    if (!app) throw new Error('Postulación no encontrada');

    if (!isValidStageTransition(app.stage, nextStage)) {
      throw new Error(`Transición inválida de ${app.stage} a ${nextStage}`);
    }

    return this.repos.jobApplications.updateStage(applicationId, nextStage, notes);
  }

  async hireCandidate(applicationId: string, hiringDate: string, salaryBs: string) {
    const app = await this.repos.jobApplications.findById(applicationId);
    if (!app) throw new Error('Postulación no encontrada');
    const posting = await this.repos.jobPostings.findById(app.jobPostingId);
    if (!posting) throw new Error('Vacante no encontrada');

    // Desglosar nombres y apellidos
    const nameParts = app.candidateName.trim().split(' ');
    const nombres = nameParts.slice(0, Math.ceil(nameParts.length / 2)).join(' ') || 'Nombre';
    const apellidos = nameParts.slice(Math.ceil(nameParts.length / 2)).join(' ') || 'Apellido';

    const cedulaParts = app.candidateCedula.replace(/[^vVeE0-9]/g, '').toUpperCase();
    const cedulaTipo: 'V' | 'E' = cedulaParts.startsWith('E') ? 'E' : 'V';
    const cedulaNumero = cedulaParts.replace(/^[VE]/, '') || '0000000';

    // 1. Crear el empleado en el expediente digital
    const newEmployee = await this.repos.employees.create({
      cedulaTipo,
      cedulaNumero,
      nombres,
      apellidos,
      fechaNacimiento: '1990-01-01',
      sexo: 'M',
      estadoCivil: 'soltero',
      gradoInstruccion: 'universitario',
      telefonoPrincipal: app.candidatePhone,
      correoElectronico: app.candidateEmail,
      direccionHabitacion: app.candidateAddress || 'Dirección registrada en postulación',
      estadoId: 1,
      municipioId: 1,
      parroquiaId: 1,
      estatus: 'activo',
    });

    // 2. Crear contrato asociado
    await this.repos.contracts.create({
      employeeId: newEmployee.id,
      positionId: posting.positionId,
      orgUnitId: posting.orgUnitId,
      contractType: 'tiempo_indeterminado',
      fechaIngreso: hiringDate,
      salarioBaseBs: salaryBs,
      salarioBaseUsd: '0.00',
      tipoPago: 'quincenal',
      bancoId: '0102',
      numeroCuenta: '01020000000000000000',
      tipoCuenta: 'corriente',
      pagoMovilTelefono: app.candidatePhone,
      estatus: 'activo',
    });

    // 3. Marcar la postulación como contratada
    await this.repos.jobApplications.updateStage(applicationId, 'contratado', `Contratado con fecha ${hiringDate}`);

    return newEmployee;
  }
}
