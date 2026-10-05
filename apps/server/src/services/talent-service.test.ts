import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryRepositories } from '../db/memory-repositories.js';
import { TalentService } from './talent-service.js';
import type { Repositories } from '../db/types.js';

describe('TalentService (ATS, INCES, Desempeño)', () => {
  let repos: Repositories;
  let service: TalentService;

  beforeEach(async () => {
    repos = createMemoryRepositories();
    service = new TalentService(repos);
  });

  describe('INCES y Formación', () => {
    it('calcula métricas de cuota PNA e inscribe a un curso', async () => {
      // Crear trabajadores sintéticos para verificar cuota
      for (let i = 1; i <= 20; i++) {
        await repos.employees.create({
          cedulaTipo: 'V',
          cedulaNumero: `100000${i}`,
          nombres: `Trabajador ${i}`,
          apellidos: 'Prueba',
          fechaNacimiento: '1990-01-01',
          sexo: 'M',
          estadoCivil: 'soltero',
          gradoInstruccion: 'universitario',
          telefonoPrincipal: '0412-0000000',
          correoElectronico: `trabajador${i}@empresa.com`,
          direccionHabitacion: 'Caracas',
          estadoId: 1,
          municipioId: 1,
          parroquiaId: 1,
          estatus: 'activo',
        });
      }

      const pna = await service.getIncesPnaStatus();
      expect(pna.totalWorkers).toBe(20);
      expect(pna.apprenticeQuota).toBe(1);
      expect(pna.deficit).toBe(1);

      // Crear curso
      const course = await service.createTrainingCourse({
        code: 'SEG-01',
        title: 'Prevención de Riesgos Industriales',
        category: 'seguridad',
        durationHours: 16,
        minPassingScore: 12,
      });
      expect(course.id).toBeDefined();

      const courses = await service.listTrainingCatalog();
      expect(courses.length).toBe(1);
    });
  });

  describe('Evaluación de Desempeño', () => {
    it('registra una evaluación periódica y calcula calificación ponderada', async () => {
      const emp = await repos.employees.create({
        cedulaTipo: 'V',
        cedulaNumero: '20111222',
        nombres: 'María',
        apellidos: 'Fernández',
        fechaNacimiento: '1992-05-15',
        sexo: 'F',
        estadoCivil: 'soltero',
        gradoInstruccion: 'universitario',
        telefonoPrincipal: '0414-1112233',
        correoElectronico: 'maria@empresa.com',
        direccionHabitacion: 'Caracas',
        estadoId: 1,
        municipioId: 1,
        parroquiaId: 1,
        estatus: 'activo',
      });

      const res = await service.recordEvaluation({
        workerId: emp.id,
        period: '2026-S1',
        goals: [
          { id: 'g1', title: 'Atención a usuarios', weightPercentage: 100, targetValue: 100, achievedValue: 100 },
        ],
        competencies: [
          { competencyId: 'c1', competencyName: 'Trabajo en equipo', score: 4.5 },
          { competencyId: 'c2', competencyName: 'Puntualidad', score: 4.0 },
        ],
        comments: 'Excelente desempeño en el semestre',
      });

      expect(res.finalScore).toBeGreaterThanOrEqual(3.8);
      expect(res.isEligibleForBonus).toBe(true);

      const evals = await service.listWorkerEvaluations(emp.id);
      expect(evals.length).toBe(1);
      expect(evals[0].meritLevel).toBe(res.meritLevel);
    });
  });

  describe('ATS y Pipeline Kanban', () => {
    it('flujo completo: vacante -> postulación -> movimiento en Kanban -> contratación sin doble captura', async () => {
      const org = await repos.orgUnits.create({ name: 'Tecnología', typeId: 1 });
      const pos = await repos.positions.create({ name: 'Desarrollador Full Stack', level: 'profesional', minSalary: '2000' });

      // 1. Crear vacante
      const posting = await service.createJobPosting({
        code: 'VAC-2026-001',
        title: 'Desarrollador Backend Node.js',
        orgUnitId: org.id,
        positionId: pos.id,
        type: 'publica',
        vacanciesCount: 2,
        description: 'Buscamos desarrollador para sistemas institucionales',
        requirements: ['Node.js', 'PostgreSQL', 'TypeScript'],
      });

      expect(posting.status).toBe('publicada');

      // 2. Postulación
      const app = await service.applyToJobPosting({
        jobPostingId: posting.id,
        candidateName: 'Alejandro Morales Guzmán',
        candidateCedula: 'V-18777666',
        candidateEmail: 'alejandro.morales@correo.com',
        candidatePhone: '0416-5554433',
        candidateAddress: 'La Candelaria, Caracas',
        notes: 'Graduado en Computación UCV con 3 años de experiencia',
      });

      expect(app.stage).toBe('postulado');

      // 3. Mover por etapas Kanban
      const rev = await service.moveApplicationStage(app.id, 'revision', 'Perfil cumple con los requisitos');
      expect(rev?.stage).toBe('revision');

      const ent = await service.moveApplicationStage(app.id, 'entrevista', 'Entrevista técnica programada');
      expect(ent?.stage).toBe('entrevista');

      const ofe = await service.moveApplicationStage(app.id, 'oferta', 'Oferta formal enviada');
      expect(ofe?.stage).toBe('oferta');

      // 4. Contratar candidato
      const newEmp = await service.hireCandidate(app.id, '2026-10-01', '4500.00');
      expect(newEmp.cedulaNumero).toBe('18777666');
      expect(newEmp.nombres).toBe('Alejandro Morales');
      expect(newEmp.apellidos).toBe('Guzmán');

      // Verificar que el contrato se creó con el cargo y unidad de la vacante
      const contracts = await repos.contracts.findByEmployeeId(newEmp.id);
      expect(contracts.length).toBe(1);
      expect(contracts[0].positionId).toBe(pos.id);
      expect(contracts[0].salarioBaseBs).toBe('4500.00');

      // Verificar que la postulación cambió a contratado
      const updatedApp = await repos.jobApplications.findById(app.id);
      expect(updatedApp?.stage).toBe('contratado');
    });
  });
});
