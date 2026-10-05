import { describe, expect, it } from 'vitest';
import {
  createAttendanceAuditEntry,
  diffEntityFields,
} from './index.js';

describe('Audit & Traceability Domain', () => {
  it('genera entradas de auditoría inmutables para rectificaciones de asistencia', () => {
    const entry = createAttendanceAuditEntry({
      workerId: 'w-42',
      date: '2026-10-01',
      field: 'horaSalida',
      oldValue: '17:00',
      newValue: '19:00',
      changedByUserId: 'usr-analista',
      reason: 'Acreditación de 2 horas extras con autorización de coordinación',
    });

    expect(entry.entityType).toBe('ASISTENCIA');
    expect(entry.entityId).toBe('w-42:2026-10-01');
    expect(entry.fieldChanged).toBe('horaSalida');
    expect(entry.oldValue).toBe('17:00');
    expect(entry.newValue).toBe('19:00');
    expect(entry.userId).toBe('usr-analista');
    expect(entry.reason).toContain('Acreditación de 2 horas');
  });

  it('detecta diferencias de campos entre dos estados de entidad', () => {
    const before = { cargo: 'Analista I', salario: 500, departamento: 'Sistemas' };
    const after = { cargo: 'Analista II', salario: 650, departamento: 'Sistemas' };

    const diffs = diffEntityFields(before, after);
    expect(diffs.length).toBe(2);
    expect(diffs).toEqual([
      { field: 'cargo', oldValue: 'Analista I', newValue: 'Analista II' },
      { field: 'salario', oldValue: '500', newValue: '650' },
    ]);
  });
});
