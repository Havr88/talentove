import { DomainError } from '../errors.js';
import type { CustomFieldDefinition, CustomFieldRecord } from './types.js';

export interface FieldValidationIssue {
  readonly code: string;
  readonly message: string;
}

/**
 * Valida un conjunto de valores personalizados contra sus definiciones.
 */
export function validateCustomFields(
  definitions: readonly CustomFieldDefinition[],
  values: CustomFieldRecord
): readonly FieldValidationIssue[] {
  const issues: FieldValidationIssue[] = [];

  for (const def of definitions) {
    const val = values[def.code];

    if (val === undefined || val === null || val === '') {
      if (def.isRequired) {
        issues.push({
          code: def.code,
          message: `El campo "${def.label}" es obligatorio.`,
        });
      }
      continue;
    }

    switch (def.dataType) {
      case 'TEXT':
        if (typeof val !== 'string') {
          issues.push({ code: def.code, message: `"${def.label}" debe ser texto.` });
        }
        break;
      case 'NUMBER':
        if (typeof val !== 'number' && isNaN(Number(val))) {
          issues.push({ code: def.code, message: `"${def.label}" debe ser un valor numérico válido.` });
        }
        break;
      case 'DATE':
        if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val) || isNaN(Date.parse(val))) {
          issues.push({ code: def.code, message: `"${def.label}" debe ser una fecha en formato YYYY-MM-DD.` });
        }
        break;
      case 'SELECT':
        if (typeof val !== 'string' || !def.options?.includes(val)) {
          issues.push({
            code: def.code,
            message: `"${def.label}" contiene un valor no permitido. Opciones: ${def.options?.join(', ')}.`,
          });
        }
        break;
      case 'BOOLEAN':
        if (typeof val !== 'boolean') {
          issues.push({ code: def.code, message: `"${def.label}" debe ser verdadero o falso.` });
        }
        break;
    }
  }

  return Object.freeze(issues);
}
