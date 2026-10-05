import type { AuditLogEntry, AttendanceAuditItem } from './types.js';

/**
 * Genera una entrada inmutable de auditoría para ajustes manuales en hojas de asistencia.
 * Basado en AttendanceLogUtil de IceHrm.
 */
export function createAttendanceAuditEntry(
  item: AttendanceAuditItem,
  entryGeneratorId: () => string = () => `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
): AuditLogEntry {
  return Object.freeze({
    id: entryGeneratorId(),
    entityType: 'ASISTENCIA',
    entityId: `${item.workerId}:${item.date}`,
    action: 'AJUSTE_ASISTENCIA',
    userId: item.changedByUserId,
    fieldChanged: item.field,
    oldValue: item.oldValue,
    newValue: item.newValue,
    reason: item.reason,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Compara dos estados de una entidad y genera la lista de campos alterados.
 */
export function diffEntityFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): readonly { field: string; oldValue: string; newValue: string }[] {
  const diffs: { field: string; oldValue: string; newValue: string }[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    const valBefore = before[key] !== undefined ? String(before[key]) : '';
    const valAfter = after[key] !== undefined ? String(after[key]) : '';

    if (valBefore !== valAfter) {
      diffs.push({
        field: key,
        oldValue: valBefore,
        newValue: valAfter,
      });
    }
  }

  return Object.freeze(diffs);
}
