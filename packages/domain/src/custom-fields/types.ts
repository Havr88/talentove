export type CustomFieldDataType = 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'BOOLEAN';

export interface CustomFieldDefinition {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly dataType: CustomFieldDataType;
  readonly options?: readonly string[] | undefined; // Para SELECT
  readonly isRequired: boolean;
  readonly section: 'DATOS_PERSONALES' | 'DOTACION_SST' | 'BENEFICIOS_PATRIA' | 'EXPEDIENTE';
  readonly defaultValue?: unknown;
}

export type CustomFieldRecord = Record<string, unknown>;
