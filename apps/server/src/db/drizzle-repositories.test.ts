import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@libsql/client';
import { initSqliteSchema } from './drizzle-migrator.js';
import { createDrizzleRepositories } from './drizzle-repositories.js';

describe('Drizzle ORM + SQLite Repositories (LibSQL)', () => {
  let client: ReturnType<typeof createClient>;
  let repos: ReturnType<typeof createDrizzleRepositories>;

  beforeEach(async () => {
    client = createClient({ url: 'file::memory:' });
    await initSqliteSchema(client);
    repos = createDrizzleRepositories(client);
  });

  it('Settings: guarda y recupera la configuración de la empresa', async () => {
    const initial = await repos.settings.getSettings();
    expect(initial).toBeNull();

    await repos.settings.saveSettings({
      companyName: 'Petróleos de Venezuela, S.A.',
      nativeId: 'G-20000041-4',
      instanceName: 'TalentoVe PDVSA',
      primaryColor: '#b71c1c',
      accentColor: '#fbc02d',
      isConfigured: true,
    });

    const saved = await repos.settings.getSettings();
    expect(saved).not.toBeNull();
    expect(saved?.companyName).toBe('Petróleos de Venezuela, S.A.');
    expect(saved?.isConfigured).toBe(true);
  });

  it('Users y Sessions: autenticación, touch y expiración de sesiones', async () => {
    const user = await repos.users.create({
      email: 'analista@pdvsa.com',
      passwordHash: 'hash-seguro-argon2',
      fullName: 'Ing. María Coromoto',
      role: 'admin',
      status: 'active',
    });

    const foundUser = await repos.users.findByEmail('analista@pdvsa.com');
    expect(foundUser?.id).toBe(user.id);
    expect(foundUser?.fullName).toBe('Ing. María Coromoto');

    // Crear sesión
    const tokenHash = 'hash-token-1234';
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    await repos.sessions.create({
      userId: user.id,
      tokenHash,
      lastActiveAt: new Date().toISOString(),
      expiresAt,
    });

    const session = await repos.sessions.findByTokenHash(tokenHash);
    expect(session?.userId).toBe(user.id);

    // Touch
    const newActive = new Date().toISOString();
    await repos.sessions.touch(tokenHash, newActive);
    const touchedSession = await repos.sessions.findByTokenHash(tokenHash);
    expect(touchedSession?.lastActiveAt).toBe(newActive);

    // Borrado de sesión
    await repos.sessions.deleteByTokenHash(tokenHash);
    const deletedSession = await repos.sessions.findByTokenHash(tokenHash);
    expect(deletedSession).toBeNull();
  });

  it('Trabajador, Contrato y Carga Familiar en SQLite', async () => {
    const orgUnit = await repos.orgUnits.create({
      name: 'Refinería El Palito',
      typeId: 2,
    });

    const position = await repos.positions.create({
      name: 'Operador de Planta Térmica',
      categoria: 'Operativa',
      grupoIsco: '3131',
      aplicaSector: 'publico',
      activo: true,
    });

    const emp = await repos.employees.create({
      cedulaTipo: 'V',
      cedulaNumero: '19888777',
      nativeId: 'V19888777',
      nombres: 'José Gregorio',
      apellidos: 'Hernández Cisneros',
      fechaNacimiento: '1990-06-15',
      sexo: 'M',
      estadoCivil: 'casado',
      direccion: 'Puerto Cabello, Carabobo',
      status: 'activo',
    });

    expect(emp.id).toBeDefined();
    const count = await repos.employees.count();
    expect(count).toBe(1);

    // Contrato
    const contract = await repos.contracts.create({
      employeeId: emp.id,
      orgUnitId: orgUnit.id,
      positionId: position.id,
      tipo: 'indeterminado',
      sector: 'publico',
      fechaIngreso: '2022-01-01',
      salarioBase: '28000.00',
      currency: 'VES',
      jornadaHoras: 8,
      activo: true,
    });

    const activeContract = await repos.contracts.findActiveByEmployeeId(emp.id);
    expect(activeContract?.id).toBe(contract.id);
    expect(activeContract?.salarioBase).toBe('28000.00');

    // Carga familiar
    const dep = await repos.dependents.create({
      employeeId: emp.id,
      nombres: 'Camila',
      apellidos: 'Hernández',
      parentesco: 'hijo',
      fechaNacimiento: '2019-03-10',
      sexo: 'F',
      gradoInstruccion: 'Inicial',
      discapacidad: false,
    });

    const deps = await repos.dependents.listByEmployeeId(emp.id);
    expect(deps).toHaveLength(1);
    expect(deps[0]?.nombres).toBe('Camila');

    await repos.dependents.delete(dep.id);
    const depsAfter = await repos.dependents.listByEmployeeId(emp.id);
    expect(depsAfter).toHaveLength(0);
  });

  it('Attendance (Hito M2): gestión de planillas semanales y registros diarios con upsert en SQLite', async () => {
    const orgUnit = await repos.orgUnits.create({
      name: 'Complejo Petroquímico Ana María Campos',
      typeId: 2,
    });

    const sheet = await repos.attendance.createSheet({
      orgUnitId: orgUnit.id,
      weekNumber: 39,
      year: 2026,
      startDate: '2026-09-28',
      endDate: '2026-10-04',
      coordinatorName: 'Lcda. Elena Morales',
      status: 'borrador',
      observations: 'Semana de mantenimiento mayor',
    });

    expect(sheet.id).toBeDefined();
    expect(sheet.weekNumber).toBe(39);

    const emp = await repos.employees.create({
      cedulaTipo: 'V',
      cedulaNumero: '22111333',
      nativeId: 'V22111333',
      nombres: 'Daniel',
      apellidos: 'Sucre',
      fechaNacimiento: '1995-02-14',
      sexo: 'M',
      estadoCivil: 'soltero',
      direccion: 'Maracaibo, Zulia',
      status: 'activo',
    });

    // Guardar registros diarios
    await repos.attendance.saveRecords([
      {
        sheetId: sheet.id,
        employeeId: emp.id,
        date: '2026-09-28',
        dayOfWeek: 1,
        timeIn: '08:00',
        timeOut: '17:00',
        status: 'asistio',
        regularHours: 8,
        overtimeDayHours: 0,
        overtimeNightHours: 0,
        nightShiftHours: 0,
        workerSigned: true,
        observations: 'Jornada normal',
      },
    ]);

    const records = await repos.attendance.listRecordsBySheetId(sheet.id);
    expect(records).toHaveLength(1);
    expect(records[0]?.workerSigned).toBe(true);

    // Actualizar registro con horas extras usando el mismo sheetId, employeeId y date (upsert)
    await repos.attendance.saveRecords([
      {
        sheetId: sheet.id,
        employeeId: emp.id,
        date: '2026-09-28',
        dayOfWeek: 1,
        timeIn: '08:00',
        timeOut: '20:00',
        status: 'asistio',
        regularHours: 8,
        overtimeDayHours: 3,
        overtimeNightHours: 1,
        nightShiftHours: 1,
        workerSigned: true,
        observations: 'Horas extraordinarias aprobadas',
      },
    ]);

    const updatedRecords = await repos.attendance.listRecordsBySheetId(sheet.id);
    expect(updatedRecords).toHaveLength(1); // Sigue siendo 1 por el conflicto único
    expect(updatedRecords[0]?.timeOut).toBe('20:00');
    expect(updatedRecords[0]?.overtimeDayHours).toBe(3);

    // Certificar planilla
    await repos.attendance.updateSheet(sheet.id, {
      status: 'verificada',
      verifiedBy: 'Analista de Nómina RRHH',
    });

    const verifiedSheet = await repos.attendance.findSheetById(sheet.id);
    expect(verifiedSheet?.status).toBe('verificada');
    expect(verifiedSheet?.verifiedBy).toBe('Analista de Nómina RRHH');
  });
});
