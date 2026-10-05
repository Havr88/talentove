import { describe, it, expect } from 'vitest';
import {
  isValidStageTransition,
  mapApplicationToEmployeePayload,
  type JobApplication,
} from './ats-manager.js';

describe('ATS Manager & Pipeline', () => {
  it('valida transiciones permitidas en el embudo Kanban', () => {
    expect(isValidStageTransition('postulado', 'revision')).toBe(true);
    expect(isValidStageTransition('revision', 'entrevista')).toBe(true);
    expect(isValidStageTransition('entrevista', 'oferta')).toBe(true);
    expect(isValidStageTransition('oferta', 'contratado')).toBe(true);
    expect(isValidStageTransition('postulado', 'descartado')).toBe(true);

    // Transición ilegal
    expect(isValidStageTransition('contratado', 'revision')).toBe(false);
    expect(isValidStageTransition('postulado', 'contratado')).toBe(false);
  });

  it('prepara payload completo para expediente digital sin doble captura', () => {
    const app: JobApplication = {
      id: 'app-99',
      jobPostingId: 'job-10',
      candidate: {
        cedulaTipo: 'V',
        cedulaNumero: '19888777',
        nombres: 'Ana Gabriela',
        apellidos: 'Blanco Castillo',
        email: 'ana.blanco@correo.com',
        telefono: '0414-9998877',
        direccion: 'Av. Urdaneta, Residencias Anauco, Caracas',
        anosExperiencia: 4,
        nivelEducativo: 'universitario',
      },
      stage: 'oferta',
      stageUpdatedAt: '2026-10-01',
      createdAt: '2026-09-20',
    };

    const payload = mapApplicationToEmployeePayload(app, '2026-10-15', '3500.00');

    expect(payload.cedulaTipo).toBe('V');
    expect(payload.cedulaNumero).toBe('19888777');
    expect(payload.nombres).toBe('Ana Gabriela');
    expect(payload.apellidos).toBe('Blanco Castillo');
    expect(payload.fechaIngreso).toBe('2026-10-15');
    expect(payload.salarioBaseBs).toBe('3500.00');
  });
});
