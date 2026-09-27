import ExcelJS from 'exceljs';
import { z } from 'zod';
import { type IdCatalog, validateNativeId } from '@talento-ve/domain';
import type { Repositories } from '../db/types.js';

export interface RowError {
  readonly rowNumber: number;
  readonly message: string;
}

export interface ImportResult {
  readonly success: boolean;
  readonly totalRows: number;
  readonly validCount: number;
  readonly errorCount: number;
  readonly errors: readonly RowError[];
  readonly imported: readonly { nativeId: string; fullName: string }[];
}

export const employeeRowSchema = z.object({
  cedula: z.string().min(1, 'Cédula requerida'),
  rif: z.string().optional(),
  nombres: z.string().min(1, 'Nombres requeridos'),
  apellidos: z.string().min(1, 'Apellidos requeridos'),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de nacimiento debe ser YYYY-MM-DD'),
  sexo: z.enum(['M', 'F']),
  estadoCivil: z.enum(['soltero', 'casado', 'divorciado', 'viudo', 'union_estable']).default('soltero'),
  direccion: z.string().default('No especificada'),
  correo: z.string().email('Correo inválido').optional().or(z.literal('')),
  telefono: z.string().optional(),
  cargo: z.string().min(1, 'Cargo requerido'),
  unidad: z.string().min(1, 'Unidad organizativa requerida'),
  tipoContrato: z.enum(['indeterminado', 'determinado', 'obra_labor']).default('indeterminado'),
  sector: z.enum(['publico', 'privado']).default('privado'),
  fechaIngreso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de ingreso debe ser YYYY-MM-DD'),
  salario: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Salario numérico inválido'),
  moneda: z.enum(['VES', 'USD']).default('VES'),
});

export type EmployeeRow = z.infer<typeof employeeRowSchema>;

export class BulkLoader {
  constructor(
    private repos: Repositories,
    private idCatalog: IdCatalog,
  ) {}

  /**
   * Parsea un buffer CSV (separado por comas o punto y coma).
   */
  parseCsv(content: string): Record<string, string>[] {
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) return [];

    const delimiter = lines[0]!.includes(';') ? ';' : ',';
    const headers = lines[0]!.split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ''));

    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i]!.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = parts[idx] ?? '';
      });
      rows.push(row);
    }
    return rows;
  }

  /**
   * Parsea un buffer Excel (.xlsx).
   */
  async parseExcel(buffer: Buffer): Promise<Record<string, string>[]> {
    const workbook = new ExcelJS.Workbook();
    // @ts-expect-error exceljs Buffer compatibility
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];

    const rows: Record<string, string>[] = [];
    const headers: string[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell) => {
          headers.push(String(cell.value ?? '').trim());
        });
      } else {
        const rowData: Record<string, string> = {};
        headers.forEach((h, idx) => {
          const val = row.getCell(idx + 1).value;
          rowData[h] = val !== null && val !== undefined ? String(val).trim() : '';
        });
        rows.push(rowData);
      }
    });

    return rows;
  }

  /**
   * Procesa la importación en modo validación (dryRun=true) o inserción (dryRun=false).
   */
  async process(rawRows: Record<string, string>[], dryRun = false): Promise<ImportResult> {
    const errors: RowError[] = [];
    const validRows: { row: EmployeeRow; nativeId: string; cedulaTipo: 'V' | 'E'; cedulaNumero: string }[] = [];
    const imported: { nativeId: string; fullName: string }[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const rowNum = i + 2; // Fila 1 es cabecera
      const raw = rawRows[i]!;

      const parsed = employeeRowSchema.safeParse(raw);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join(', ');
        errors.push({ rowNumber: rowNum, message: msg });
        continue;
      }

      const row = parsed.data;
      const idResult = validateNativeId(row.cedula, this.idCatalog);
      if (!idResult.ok) {
        errors.push({ rowNumber: rowNum, message: `Cédula inválida (${row.cedula}): ${idResult.message}` });
        continue;
      }

      // Validar que no esté ya registrado en la BD
      const existing = await this.repos.employees.findByNativeId(idResult.value);
      if (existing) {
        errors.push({ rowNumber: rowNum, message: `El empleado con cédula ${idResult.value} ya está registrado` });
        continue;
      }

      const cedulaTipo = idResult.value[0] === 'E' ? 'E' : 'V';
      const cedulaNumero = idResult.value.slice(1);

      validRows.push({
        row,
        nativeId: idResult.value,
        cedulaTipo,
        cedulaNumero,
      });
    }

    if (!dryRun && errors.length === 0) {
      for (const { row, nativeId, cedulaTipo, cedulaNumero } of validRows) {
        // 1. Obtener o crear Unidad Organizativa
        let orgUnit = (await this.repos.orgUnits.list()).find(
          (u) => u.name.toLowerCase() === row.unidad.toLowerCase().trim(),
        );
        if (!orgUnit) {
          orgUnit = await this.repos.orgUnits.create({
            name: row.unidad.trim(),
            typeId: 4, // Departamento
          });
        }

        // 2. Obtener o crear Cargo
        let position = await this.repos.positions.findByName(row.cargo);
        if (!position) {
          position = await this.repos.positions.create({
            name: row.cargo.trim(),
            categoria: 'General',
            grupoIsco: 'Otras',
            aplicaSector: row.sector,
            activo: true,
          });
        }

        // 3. Crear Empleado
        const emp = await this.repos.employees.create({
          cedulaTipo,
          cedulaNumero,
          nativeId,
          rif: row.rif && row.rif.trim() !== '' ? row.rif.trim() : undefined,
          nombres: row.nombres.trim(),
          apellidos: row.apellidos.trim(),
          fechaNacimiento: row.fechaNacimiento,
          sexo: row.sexo,
          estadoCivil: row.estadoCivil,
          direccion: row.direccion,
          correo: row.correo && row.correo.trim() !== '' ? row.correo.trim() : undefined,
          telefono: row.telefono && row.telefono.trim() !== '' ? row.telefono.trim() : undefined,
          status: 'activo',
        });

        // 4. Crear Contrato
        await this.repos.contracts.create({
          employeeId: emp.id,
          orgUnitId: orgUnit.id,
          positionId: position.id,
          tipo: row.tipoContrato,
          sector: row.sector,
          fechaIngreso: row.fechaIngreso,
          salarioBase: row.salario,
          currency: row.moneda,
          jornadaHoras: 8.0,
          activo: true,
        });

        imported.push({
          nativeId: emp.nativeId,
          fullName: `${emp.nombres} ${emp.apellidos}`,
        });
      }
    }

    return {
      success: errors.length === 0,
      totalRows: rawRows.length,
      validCount: validRows.length,
      errorCount: errors.length,
      errors,
      imported,
    };
  }
}
