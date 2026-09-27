import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseIdCatalog } from '@talento-ve/domain';
import { BulkLoader } from './bulk-loader.js';
import { createMemoryRepositories } from '../db/memory-repositories.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('BulkLoader - Carga Masiva (Módulo J / M1a)', () => {
  const catalogPath = join(__dirname, '../../../../data/ve/identificadores.json');
  const idCatalog = parseIdCatalog(JSON.parse(readFileSync(catalogPath, 'utf8')));

  const validCsv = `cedula,rif,nombres,apellidos,fechaNacimiento,sexo,estadoCivil,direccion,correo,cargo,unidad,tipoContrato,sector,fechaIngreso,salario,moneda
V-12345678,V-12345678-0,Pedro,Perez,1990-05-15,M,soltero,Caracas,pedro@empresa.ve,Analista Contable,Finanzas,indeterminado,privado,2026-01-15,1500.00,USD
V-20123456,,Maria,Gomez,1995-10-20,F,casado,Valencia,maria@empresa.ve,Especialista TI,Tecnología,indeterminado,publico,2026-02-01,50000.00,VES
`;

  it('parseCsv descompone cabeceras y filas correctamente', () => {
    const loader = new BulkLoader(createMemoryRepositories(), idCatalog);
    const rows = loader.parseCsv(validCsv);
    expect(rows.length).toBe(2);
    expect(rows[0]?.cedula).toBe('V-12345678');
    expect(rows[0]?.nombres).toBe('Pedro');
    expect(rows[1]?.cargo).toBe('Especialista TI');
  });

  it('parseExcel procesa un archivo Excel (.xlsx) generado', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Empleados');
    sheet.addRow([
      'cedula', 'rif', 'nombres', 'apellidos', 'fechaNacimiento', 'sexo',
      'estadoCivil', 'direccion', 'correo', 'cargo', 'unidad', 'tipoContrato',
      'sector', 'fechaIngreso', 'salario', 'moneda'
    ]);
    sheet.addRow([
      'V-15678901', '', 'Carlos', 'Lopez', '1988-03-12', 'M',
      'soltero', 'Maracay', 'carlos@empresa.ve', 'Ingeniero de Planta', 'Operaciones',
      'indeterminado', 'privado', '2026-03-01', '2500.00', 'USD'
    ]);

    const buffer = await workbook.xlsx.writeBuffer();
    const loader = new BulkLoader(createMemoryRepositories(), idCatalog);
    const rows = await loader.parseExcel(buffer as unknown as Buffer);

    expect(rows.length).toBe(1);
    expect(rows[0]?.cedula).toBe('V-15678901');
    expect(rows[0]?.nombres).toBe('Carlos');
    expect(rows[0]?.cargo).toBe('Ingeniero de Planta');
  });

  it('process reporta errores fila por fila con cédulas o fechas inválidas', async () => {
    const badCsv = `cedula,rif,nombres,apellidos,fechaNacimiento,sexo,estadoCivil,direccion,correo,cargo,unidad,tipoContrato,sector,fechaIngreso,salario,moneda
X-00000000,,Juan,Valido,1990-01-01,M,soltero,Caracas,j@e.ve,Cargo,Unidad,indeterminado,privado,2026-01-01,100.00,USD
V-12345678,,Ana,SinFecha,fecha-mala,F,soltero,Caracas,a@e.ve,Cargo,Unidad,indeterminado,privado,2026-01-01,100.00,USD
`;
    const loader = new BulkLoader(createMemoryRepositories(), idCatalog);
    const rows = loader.parseCsv(badCsv);
    const res = await loader.process(rows, true);

    expect(res.success).toBe(false);
    expect(res.errors.length).toBe(2);
    expect(res.errors[0]?.message).toContain('Cédula inválida');
    expect(res.errors[1]?.message).toContain('fechaNacimiento');
  });

  it('process en modo dryRun valida sin insertar en la base de datos', async () => {
    const repos = createMemoryRepositories();
    const loader = new BulkLoader(repos, idCatalog);
    const rows = loader.parseCsv(validCsv);

    const res = await loader.process(rows, true);
    expect(res.success).toBe(true);
    expect(res.validCount).toBe(2);
    expect(res.imported.length).toBe(0);

    const count = await repos.employees.count();
    expect(count).toBe(0);
  });

  it('process en modo inserción persiste trabajadores, contratos, cargos y unidades', async () => {
    const repos = createMemoryRepositories();
    const loader = new BulkLoader(repos, idCatalog);
    const rows = loader.parseCsv(validCsv);

    const res = await loader.process(rows, false);
    expect(res.success).toBe(true);
    expect(res.imported.length).toBe(2);

    const count = await repos.employees.count();
    expect(count).toBe(2);

    const emp1 = await repos.employees.findByNativeId('V12345678');
    expect(emp1).toBeDefined();
    expect(emp1?.nombres).toBe('Pedro');

    const contract1 = await repos.contracts.findActiveByEmployeeId(emp1!.id);
    expect(contract1).toBeDefined();
    expect(contract1?.salarioBase).toBe('1500.00');
    expect(contract1?.currency).toBe('USD');
    expect(contract1?.sector).toBe('privado');

    const emp2 = await repos.employees.findByNativeId('V20123456');
    expect(emp2).toBeDefined();
    const contract2 = await repos.contracts.findActiveByEmployeeId(emp2!.id);
    expect(contract2?.sector).toBe('publico');
  });
});
