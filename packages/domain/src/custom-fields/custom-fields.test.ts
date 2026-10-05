import { describe, expect, it } from 'vitest';
import {
  validateCustomFields,
  type CustomFieldDefinition,
} from './index.js';

describe('Custom Fields Dynamic Domain', () => {
  const definitions: CustomFieldDefinition[] = [
    {
      id: 'cf-1',
      code: 'carnet_patria_serial',
      label: 'Serial Carnet de la Patria',
      dataType: 'TEXT',
      isRequired: true,
      section: 'BENEFICIOS_PATRIA',
    },
    {
      id: 'cf-2',
      code: 'talla_calzado_sst',
      label: 'Talla de Calzado de Seguridad',
      dataType: 'NUMBER',
      isRequired: false,
      section: 'DOTACION_SST',
    },
    {
      id: 'cf-3',
      code: 'talla_camisa',
      label: 'Talla de Camisa',
      dataType: 'SELECT',
      options: ['S', 'M', 'L', 'XL', 'XXL'],
      isRequired: true,
      section: 'DOTACION_SST',
    },
  ];

  it('valida exitosamente cuando todos los datos son conformes', () => {
    const values = {
      carnet_patria_serial: '0012948192',
      talla_calzado_sst: 42,
      talla_camisa: 'L',
    };

    const issues = validateCustomFields(definitions, values);
    expect(issues.length).toBe(0);
  });

  it('detecta campos obligatorios faltantes y valores fuera de lista permitida', () => {
    const invalidValues = {
      talla_calzado_sst: 'no-es-numero',
      talla_camisa: 'XXXXL', // fuera del enum
    };

    const issues = validateCustomFields(definitions, invalidValues);
    expect(issues.length).toBe(3); // falta carnet obligatorio, talla calzado no numérica, talla camisa no permitida
    expect(issues.some((i) => i.code === 'carnet_patria_serial')).toBe(true);
    expect(issues.some((i) => i.code === 'talla_calzado_sst')).toBe(true);
    expect(issues.some((i) => i.code === 'talla_camisa')).toBe(true);
  });
});
