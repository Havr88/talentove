import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createMemoryRepositories } from './db/memory-repositories.js';
import { createApp } from './app.js';
import { hashPassword } from './security/crypto.js';
import type { Env } from './config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function startDemoServer() {
  const repos = createMemoryRepositories();

  const env: Env = {
    NODE_ENV: 'development',
    PORT: 3000,
    BASE_URL: 'http://localhost:3000',
    TZ: 'America/Caracas',
    INSTANCE_NAME: 'TalentoVe • Gestión Humana Patria',
    DATABASE_URL: 'postgres://demo:demo@localhost:5432/demo',
    DATABASE_POOL_MAX: 10,
    DATABASE_POOL_IDLE_TIMEOUT_MS: 30000,
    SESSION_SECRET: 'talento-ve-demo-super-secret-key-32-chars-long!',
    SESSION_COOKIE_NAME: 'tv_sid',
    SESSION_TTL_HOURS: 12,
    SESSION_INACTIVE_WARNING_MINUTES: 8,
    SESSION_INACTIVE_LOGOUT_MINUTES: 10,
    STORAGE_DRIVER: 'local',
    STORAGE_LOCAL_PATH: './uploads',
  };

  // 1. Configuración institucional inicial
  await repos.settings.saveSettings({
    companyName: 'Corporación Socialista de Desarrollo e Innovación Tecnológica',
    nativeId: 'G-20012345-6',
    instanceName: 'TalentoVe • RRHH',
    primaryColor: '#0d47a1',
    accentColor: '#d32f2f',
    isConfigured: true,
  });

  // 3. Usuario administrador / analista
  const adminPassword = 'Password123*';
  const hashedPassword = await hashPassword(adminPassword);
  await repos.users.create({
    email: 'admin@patria.gob.ve',
    fullName: 'Lcdo. Juan Vicente Gómez (Analista RRHH)',
    passwordHash: hashedPassword,
    role: 'superadmin',
    status: 'active',
  });

  // 4. Departamentos
  const deptTech = await repos.orgUnits.create({
    name: 'Gerencia de Tecnología e Información',
    typeId: 4,
  });
  const deptRrhh = await repos.orgUnits.create({
    name: 'Coordinación de Talento Humano',
    typeId: 4,
  });
  const deptOps = await repos.orgUnits.create({
    name: 'Dirección de Operaciones y Servicios',
    typeId: 3,
  });

  // 5. Cargos
  const posIng = await repos.positions.create({
    name: 'Ingeniero de Software Senior',
    categoria: 'Profesional',
    grupoIsco: '2512',
    aplicaSector: 'publico',
    activo: true,
  });
  const posAnalista = await repos.positions.create({
    name: 'Analista de Gestión del Talento',
    categoria: 'Técnico',
    grupoIsco: '2423',
    aplicaSector: 'publico',
    activo: true,
  });
  const posCoord = await repos.positions.create({
    name: 'Coordinador de Infraestructura y Redes',
    categoria: 'Directivo',
    grupoIsco: '1330',
    aplicaSector: 'publico',
    activo: true,
  });

  // 6. Trabajadores y Contratos
  const emp1 = await repos.employees.create({
    cedulaTipo: 'V',
    cedulaNumero: '18555666',
    nativeId: 'V18555666',
    rif: 'V-18555666-3',
    nombres: 'Carlos Eduardo',
    apellidos: 'Mendoza Pérez',
    fechaNacimiento: '1989-05-14',
    sexo: 'M',
    estadoCivil: 'casado',
    correo: 'carlos.mendoza@patria.gob.ve',
    telefono: '0414-1234567',
    direccion: 'Av. Urdaneta, Edif. Centro, Piso 5, Caracas',
    status: 'activo',
  });
  await repos.contracts.create({
    employeeId: emp1.id,
    orgUnitId: deptTech.id,
    positionId: posIng.id,
    tipo: 'indeterminado',
    sector: 'publico',
    fechaIngreso: '2021-03-01',
    salarioBase: '18500.00',
    currency: 'VES',
    jornadaHoras: 8,
    activo: true,
  });

  const emp2 = await repos.employees.create({
    cedulaTipo: 'V',
    cedulaNumero: '21999888',
    nativeId: 'V21999888',
    rif: 'V-21999888-9',
    nombres: 'Mariana Coromoto',
    apellidos: 'Rivas Salazar',
    fechaNacimiento: '1993-11-20',
    sexo: 'F',
    estadoCivil: 'soltero',
    correo: 'mariana.rivas@patria.gob.ve',
    telefono: '0424-9876543',
    direccion: 'El Silencio, Bloque 1, Apt 4-B, Caracas',
    status: 'activo',
  });
  await repos.contracts.create({
    employeeId: emp2.id,
    orgUnitId: deptRrhh.id,
    positionId: posAnalista.id,
    tipo: 'indeterminado',
    sector: 'publico',
    fechaIngreso: '2022-07-15',
    salarioBase: '16200.00',
    currency: 'VES',
    jornadaHoras: 8,
    activo: true,
  });

  const emp3 = await repos.employees.create({
    cedulaTipo: 'V',
    cedulaNumero: '15444333',
    nativeId: 'V15444333',
    rif: 'V-15444333-1',
    nombres: 'Roberto José',
    apellidos: 'Parra Galindo',
    fechaNacimiento: '1982-08-03',
    sexo: 'M',
    estadoCivil: 'casado',
    correo: 'roberto.parra@patria.gob.ve',
    telefono: '0412-5558899',
    direccion: 'Los Teques, Urb. Simón Bolívar, Casa 12',
    status: 'activo',
  });
  await repos.contracts.create({
    employeeId: emp3.id,
    orgUnitId: deptTech.id,
    positionId: posCoord.id,
    tipo: 'indeterminado',
    sector: 'publico',
    fechaIngreso: '2019-10-01',
    salarioBase: '24000.00',
    currency: 'VES',
    jornadaHoras: 8,
    activo: true,
  });

  // 7. Cargas familiares de muestra
  await repos.dependents.create({
    employeeId: emp1.id,
    nombres: 'Santiago Andrés',
    apellidos: 'Mendoza Rangel',
    parentesco: 'hijo',
    fechaNacimiento: '2018-04-10',
    sexo: 'M',
    gradoInstruccion: 'Primaria',
    discapacidad: false,
  });

  // 8. Solicitud de muestra
  await repos.requests.create({
    employeeId: emp1.id,
    tipo: 'constancia_trabajo',
    motivo: 'Trámites bancarios y actualización de cuenta nómina',
    estatus: 'aprobada',
    observacionesRrhh: 'Constancia generada y certificada con sello digital QR',
    codigoVerificacion: 'BCV-CT-2026-DEMO',
  });

  // 9. Planilla semanal de asistencia (Hito M2)
  const today = new Date();
  const dayOfWeek = today.getDay();
  const distanceToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - distanceToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startStr = monday.toISOString().slice(0, 10);
  const endStr = sunday.toISOString().slice(0, 10);

  const sheet = await repos.attendance.createSheet({
    orgUnitId: deptTech.id,
    weekNumber: 39,
    year: 2026,
    startDate: startStr,
    endDate: endStr,
    coordinatorName: 'Ing. Roberto José Parra Galindo',
    status: 'en_revision',
    observations: 'Planilla regular del área de Tecnología con guardias de soporte programadas.',
  });

  // Registros diarios de la semana
  const days = [];
  const curr = new Date(monday);
  while (curr <= sunday) {
    days.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }

  const techEmps = [emp1, emp3];
  const recordsToSave = [];
  for (const emp of techEmps) {
    for (const d of days) {
      const dStr = d.toISOString().slice(0, 10);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const recordStatus: 'dia_libre' | 'asistio' = isWeekend ? 'dia_libre' : 'asistio';
      recordsToSave.push({
        sheetId: sheet.id,
        employeeId: emp.id,
        date: dStr,
        dayOfWeek: d.getDay(),
        timeIn: isWeekend ? undefined : '08:00',
        timeOut: isWeekend ? undefined : '17:00',
        status: recordStatus,
        regularHours: isWeekend ? 0 : 8,
        overtimeDayHours: 0,
        overtimeNightHours: 0,
        nightShiftHours: 0,
        workerSigned: !isWeekend,
        observations: isWeekend ? 'Fin de semana' : 'Jornada ordinaria',
      });
    }
  }
  await repos.attendance.saveRecords(recordsToSave);

  // Crear app Express
  const app = createApp(repos, env);

  app.listen(env.PORT, () => {
    process.stdout.write(`
===============================================================
🇻🇪  TALENTO-VE • PLATAFORMA DE GESTIÓN HUMANA Y RRHH
===============================================================
📍 Servidor activo en:  http://localhost:${env.PORT}
🔑 Credenciales de acceso pre-configuradas:
   - Correo:       admin@patria.gob.ve
   - Contraseña:   Password123*

Módulos listos para explorar:
   - Panel Principal:         http://localhost:${env.PORT}/
   - Trabajadores y Cargas:   http://localhost:${env.PORT}/trabajadores
   - Solicitudes y QR:        http://localhost:${env.PORT}/solicitudes
   - Asistencia Semanal (M2): http://localhost:${env.PORT}/asistencia
   - Planilla Semanal actual: http://localhost:${env.PORT}/asistencia/${sheet.id}
   - Descarga Oficial en PDF: http://localhost:${env.PORT}/asistencia/${sheet.id}/pdf
===============================================================
\n`);
  });
}

startDemoServer().catch((err) => {
  process.stderr.write(`Error en demo: ${err.message}\n`);
  process.exit(1);
});
