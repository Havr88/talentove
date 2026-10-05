import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createMemoryRepositories } from './db/memory-repositories.js';
import { createApp } from './app.js';
import { hashPassword } from './security/crypto.js';
import type { Env } from './config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Datos sintéticos calibrados con el legacy del piloto IDANZ (2026-09-27):
// cargos del nomenclador institucional, tabuladores en Bs (Tabla 3/3.1 APN),
// condiciones laborales del legacy y fechas de antigüedad multi-base.
async function startDemoServer() {
  const repos = createMemoryRepositories();

  const env: Env = {
    NODE_ENV: 'development',
    PORT: 3000,
    BASE_URL: 'http://localhost:3000',
    TZ: 'America/Caracas',
    INSTANCE_NAME: 'TalentoVe • IDANZ',
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

  // 1. Configuración institucional (instalación piloto IDANZ)
  await repos.settings.saveSettings({
    companyName: 'Instituto Autónomo de Deportes del Estado Anzoátegui (IDANZ)',
    nativeId: 'G-20012345-6',
    instanceName: 'TalentoVe • IDANZ',
    primaryColor: '#0d47a1',
    accentColor: '#d32f2f',
    isConfigured: true,
  });

  // 2. Usuario administrador / analista de RRHH
  const adminPassword = 'Password123*';
  const hashedPassword = await hashPassword(adminPassword);
  await repos.users.create({
    email: 'admin@idanz.gob.ve',
    fullName: 'Lcda. Yuraima Salazar (Analista RRHH)',
    passwordHash: hashedPassword,
    role: 'superadmin',
    status: 'active',
  });

  // 3+4. Datasets reales del proyecto (data/): organigrama del piloto y nomenclador de cargos
  const dataRoot = join(__dirname, '..', '..', '..', 'data');
  const organigrama = JSON.parse(readFileSync(join(dataRoot, 'piloto-idanz', 'organigrama.json'), 'utf-8')) as {
    unidades: Array<{ nombre: string; tipo: string; padre: string | null; nota?: string }>;
  };
  const cargosData = JSON.parse(readFileSync(join(dataRoot, 've', 'cargos.json'), 'utf-8')) as {
    cargos: Array<{ nombre: string; categoria: string; grupo_isco: number; aplica_sector: string; nivel_tabulador_apn: string | null }>;
  };

  const tipoATypeId: Record<string, number> = {
    presidencia: 1, vicepresidencia: 1, direccion: 2, departamento: 3, unidad: 4, seccion: 4, almacen: 4,
  };
  const unitByName = new Map<string, { id: string; name: string }>();
  for (const u of organigrama.unidades) {
    const parent = u.padre ? unitByName.get(u.padre) : undefined;
    const created = await repos.orgUnits.create({
      name: u.nombre,
      typeId: tipoATypeId[u.tipo] ?? 4,
      ...(parent ? { parentId: parent.id } : {}),
    });
    unitByName.set(u.nombre, created);
  }

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const posByName = new Map<string, { id: number; name: string }>();
  for (const c of cargosData.cargos) {
    const created = await repos.positions.create({
      name: c.nombre,
      categoria: capitalize(c.categoria),
      grupoIsco: `${c.grupo_isco}000`,
      aplicaSector: c.aplica_sector as 'ambos' | 'publico' | 'privado',
      ...(c.nivel_tabulador_apn ? { nivelTabuladorApn: c.nivel_tabulador_apn } : {}),
      activo: true,
    });
    posByName.set(c.nombre, created);
  }

  const needUnit = (name: string) => {
    const u = unitByName.get(name);
    if (!u) throw new Error(`Unidad faltante en organigrama.json: ${name}`);
    return u;
  };
  const needPos = (name: string) => {
    const p = posByName.get(name);
    if (!p) throw new Error(`Cargo faltante en cargos.json: ${name}`);
    return p;
  };

  const uPresidencia = needUnit('Presidencia');
  const uTesoreria = needUnit('Departamento de Tesorería');
  const uPlanificacion = needUnit('Dirección de Planificación y Presupuesto');
  const uDeportePopular = needUnit('Dirección de Deporte Popular');
  const uCienciasMedicas = needUnit('Dirección de Ciencias Médicas Aplicadas al Deporte');
  const uEstadioCaraquena = needUnit('Estadio La Caraqueña');
  const uEstadioVenezuela = needUnit('Estadio Venezuela');

  const posPresidente = needPos('Presidente del IDANZ');
  const posAnalistaAdminIV = needPos('Analista Administrativo IV');
  const posAnalistaPresupuestoIV = needPos('Analista de Presupuesto IV');
  const posEntrenador = needPos('Entrenador Deportivo');
  const posFisioterapeuta = needPos('Fisioterapeuta I');
  const posObrero = needPos('Obrero(a)');

  const cuenta = async (
    emp: { id: string },
    bancoCodigo: string,
    bancoNombre: string,
    tipo: 'corriente' | 'ahorro' | 'pago_movil',
    numero: string,
  ) => {
    if (repos.bankAccounts) {
      await repos.bankAccounts.create({
        employeeId: emp.id, bancoCodigo, bancoNombre, tipo, numero, esPrincipal: true,
      });
    }
  };

  // 5. Trabajadores por condición laboral (constancias del legacy)
  //    Salarios en Bs según tabuladores del piloto (Tabla 3/3.1 APN y tabla AN).

  // — ALTO NIVEL: Presidencia, sueldo rango MÁXIMA AUTORIDAD/PRESIDENTE (tabla B: 409,00 Bs)
  const empPresidente = await repos.employees.create({
    cedulaTipo: 'V', cedulaNumero: '22133445', nativeId: 'V22133445', rif: 'V-22133445-2',
    nombres: 'Luis Alberto', apellidos: 'Marcano Fuentes',
    gradoInstruccion: 'DOCT',
    fechaNacimiento: '1971-03-12', sexo: 'M', estadoCivil: 'casado',
    correo: 'luis.marcano@idanz.gob.ve', telefono: '0414-8012345',
    direccion: 'Lechería, Av. El Parque, Edif. Marina, Piso 4, Mpio. Lechería',
    status: 'activo',
  });
  await repos.contracts.create({
    employeeId: empPresidente.id, orgUnitId: uPresidencia.id, positionId: posPresidente.id,
    tipo: 'indeterminado', sector: 'publico', fechaIngreso: '2019-01-15',
    fechaIngresoApn: '2003-02-15', condicionLaboral: 'ALTO NIVEL',
    salarioBase: '409.00', currency: 'VES', jornadaHoras: 8, activo: true,
  });
  await cuenta(empPresidente, '0102', 'Banco de Venezuela, S.A. Banco Universal', 'corriente', '01020123456789012345');

  // — ADMINISTRATIVO FIJO: Analista Administrativo IV (tabulador BI-IV = 135,00 Bs)
  const empAnalista = await repos.employees.create({
    cedulaTipo: 'V', cedulaNumero: '16887766', nativeId: 'V16887766', rif: 'V-16887766-0',
    nombres: 'Yuraima Del Valle', apellidos: 'Salazar Rojas',
    gradoInstruccion: 'PROF',
    fechaNacimiento: '1985-09-22', sexo: 'F', estadoCivil: 'casado',
    correo: 'yuraima.salazar@idanz.gob.ve', telefono: '0424-8165522',
    direccion: 'Barcelona, Av. 5 de Julio, Resid. Los Mangos, Apt 3-C, Mpio. Simón Bolívar',
    status: 'activo',
  });
  await repos.contracts.create({
    employeeId: empAnalista.id, orgUnitId: uTesoreria.id, positionId: posAnalistaAdminIV.id,
    tipo: 'indeterminado', sector: 'publico', fechaIngreso: '2019-09-01',
    fechaIngresoApn: '2010-06-01', condicionLaboral: 'ADMINISTRATIVO FIJO',
    salarioBase: '135.00', currency: 'VES', jornadaHoras: 8, activo: true,
  });
  await cuenta(empAnalista, '0134', 'Banesco, Banco Universal S.A.C.A.', 'ahorro', '01340123456789012302');

  // — ADMINISTRATIVO CONTRATADO: Analista de Presupuesto IV (tabulador PI-IV = 252,00 Bs)
  const empContratada = await repos.employees.create({
    cedulaTipo: 'V', cedulaNumero: '24332112', nativeId: 'V24332112', rif: 'V-24332112-6',
    nombres: 'Keila Fernanda', apellidos: 'Rodríguez Pérez',
    gradoInstruccion: 'TSU',
    fechaNacimiento: '1996-07-30', sexo: 'F', estadoCivil: 'soltero',
    correo: 'keila.rodriguez@idanz.gob.ve', telefono: '0412-9823344',
    direccion: 'Barcelona, Urb. El Campestre, Mzna C, Casa 19, Mpio. Simón Bolívar',
    status: 'vacaciones',
  });
  await repos.contracts.create({
    employeeId: empContratada.id, orgUnitId: uPlanificacion.id, positionId: posAnalistaPresupuestoIV.id,
    tipo: 'determinado', sector: 'publico', fechaIngreso: '2025-03-01', fechaFin: '2026-12-31',
    fechaIngresoApn: '2025-03-01', condicionLaboral: 'ADMINISTRATIVO CONTRATADO',
    salarioBase: '252.00', currency: 'VES', jornadaHoras: 8, activo: true,
  });
  await cuenta(empContratada, '0163', 'Banco del Tesoro, Banco Universal', 'corriente', '01630123456789012304');

  // — ENTRENADOR CONTRATADO: Entrenador Deportivo, disciplina Bolas Criollas (BI-I = 130,00 Bs)
  const empEntrenador = await repos.employees.create({
    cedulaTipo: 'V', cedulaNumero: '20887799', nativeId: 'V20887799', rif: 'V-20887799-8',
    nombres: 'Wilmer Antonio', apellidos: 'Rangel Cova',
    gradoInstruccion: 'TSU',
    fechaNacimiento: '1988-11-05', sexo: 'M', estadoCivil: 'casado',
    correo: 'wilmer.rangel@idanz.gob.ve', telefono: '0416-6447712',
    direccion: 'Cantaura, Calle Arismendi, Casa 8, Mpio. Pedro María Freites',
    status: 'activo',
  });
  await repos.contracts.create({
    employeeId: empEntrenador.id, orgUnitId: uDeportePopular.id, positionId: posEntrenador.id,
    tipo: 'determinado', sector: 'publico', fechaIngreso: '2025-06-01', fechaFin: '2026-12-31',
    fechaIngresoApn: '2025-06-01', condicionLaboral: 'ENTRENADOR CONTRATADO',
    salarioBase: '130.00', currency: 'VES', jornadaHoras: 8, activo: true,
  });
  await cuenta(empEntrenador, '0128', 'Banco Caroní C.A. Banco Universal', 'ahorro', '01280123456789012305');

  // — SALUD FIJA: Fisioterapeuta I (tabulador PI-I = 246,00 Bs)
  const empFisio = await repos.employees.create({
    cedulaTipo: 'V', cedulaNumero: '17766332', nativeId: 'V17766332', rif: 'V-17766332-4',
    nombres: 'Gabriela', apellidos: 'Ruiz Michelangeli',
    gradoInstruccion: 'ESPEC',
    fechaNacimiento: '1987-01-25', sexo: 'F', estadoCivil: 'casado',
    correo: 'gabriela.ruiz@idanz.gob.ve', telefono: '0414-3790081',
    direccion: 'Barcelona, Av. Country Club, Resid. Bahía, Apt 2-A, Mpio. Simón Bolívar',
    status: 'activo',
  });
  await repos.contracts.create({
    employeeId: empFisio.id, orgUnitId: uCienciasMedicas.id, positionId: posFisioterapeuta.id,
    tipo: 'indeterminado', sector: 'publico', fechaIngreso: '2020-08-01',
    fechaIngresoApn: '2015-04-01', condicionLaboral: 'SALUD FIJO',
    salarioBase: '246.00', currency: 'VES', jornadaHoras: 8, activo: true,
  });
  await cuenta(empFisio, '0115', 'Banco Exterior C.A. Banco Universal', 'corriente', '01150123456789012306');

  // — OBRERO FIJO: Obrero (tabulador GRD-03, rango 149,00–152,00 Bs), sede Estadio La Caraqueña
  const empObreroFijo = await repos.employees.create({
    cedulaTipo: 'V', cedulaNumero: '19555888', nativeId: 'V19555888', rif: 'V-19555888-7',
    nombres: 'José Gregorio', apellidos: 'Herrera Bastidas',
    gradoInstruccion: 'BACH',
    fechaNacimiento: '1990-02-18', sexo: 'M', estadoCivil: 'soltero',
    correo: 'jose.herrera@idanz.gob.ve', telefono: '0426-5531190',
    direccion: 'Puerto La Cruz, Calle Bolívar, Casa 45, Mpio. Juan Antonio Sotillo',
    status: 'activo',
  });
  await repos.contracts.create({
    employeeId: empObreroFijo.id, orgUnitId: uEstadioCaraquena.id, positionId: posObrero.id,
    tipo: 'indeterminado', sector: 'publico', fechaIngreso: '2021-03-01',
    fechaIngresoApn: '2021-03-01', condicionLaboral: 'OBRERO FIJO',
    salarioBase: '149.00', currency: 'VES', jornadaHoras: 8, activo: true,
  });
  await cuenta(empObreroFijo, '0104', 'Venezolano de Crédito, S.A. Banco Universal', 'ahorro', '01040123456789012301');

  // — OBRERO CONTRATADO: Obrero (tabulador GRD-06, rango 178,00–181,00 Bs), sede Estadio Venezuela
  const empObreroContratado = await repos.employees.create({
    cedulaTipo: 'V', cedulaNumero: '22998877', nativeId: 'V22998877', rif: 'V-22998877-1',
    nombres: 'Darwin Enmanuel', apellidos: 'Bravo Loyo',
    gradoInstruccion: 'BACH',
    fechaNacimiento: '1994-06-10', sexo: 'M', estadoCivil: 'soltero',
    correo: 'darwin.bravo@idanz.gob.ve', telefono: '0424-7712654',
    direccion: 'Barcelona, Sector Mesones, Calle Sucre, Casa 23, Mpio. Simón Bolívar',
    status: 'activo',
  });
  await repos.contracts.create({
    employeeId: empObreroContratado.id, orgUnitId: uEstadioVenezuela.id, positionId: posObrero.id,
    tipo: 'determinado', sector: 'publico', fechaIngreso: '2025-06-01', fechaFin: '2026-12-31',
    fechaIngresoApn: '2025-06-01', condicionLaboral: 'OBRERO CONTRATADO',
    salarioBase: '178.00', currency: 'VES', jornadaHoras: 8, activo: true,
  });
  await cuenta(empObreroContratado, '0156', '100% Banco, Banco Universal', 'corriente', '01560123456789012303');

  // 6. Cargas familiares (prima por hijos + hijo excepcional del legacy)
  await repos.dependents.create({
    employeeId: empAnalista.id,
    nombres: 'Valentina', apellidos: 'Salazar Quijada',
    parentesco: 'hijo', fechaNacimiento: '2014-04-10', sexo: 'F',
    gradoInstruccion: 'Primaria', discapacidad: true,
  });
  await repos.dependents.create({
    employeeId: empAnalista.id,
    nombres: 'Diego Alejandro', apellidos: 'Salazar Quijada',
    parentesco: 'hijo', fechaNacimiento: '2018-09-24', sexo: 'M',
    gradoInstruccion: 'Preescolar', discapacidad: false,
  });
  await repos.dependents.create({
    employeeId: empEntrenador.id,
    nombres: 'Andrés Wilmer', apellidos: 'Rangel Suárez',
    parentesco: 'hijo', fechaNacimiento: '2016-02-02', sexo: 'M',
    gradoInstruccion: 'Primaria', discapacidad: false,
  });

  // 7. Solicitudes de muestra (motor de solicitudes + constancias con condición laboral)
  await repos.requests.create({
    employeeId: empAnalista.id,
    tipo: 'constancia_trabajo',
    motivo: 'Trámite bancario — actualización de cuenta de nómina (Banco de Venezuela)',
    estatus: 'aprobada',
    observacionesRrhh: 'Constancia emitida con condición laboral ADMINISTRATIVO FIJO y sello QR',
    codigoVerificacion: 'IDANZ-CT-2026-DEMO1',
  });
  await repos.requests.create({
    employeeId: empContratada.id,
    tipo: 'vacaciones',
    motivo: 'Disfrute de vacaciones 2025-2026 según programa del departamento',
    estatus: 'pendiente',
    fechaDesde: '2026-10-19', fechaHasta: '2026-11-02', diasSolicitados: 15,
  });

  // 8. Planilla semanal de asistencia (M2b) — Tesorería + Presidente de muestra
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
    orgUnitId: uTesoreria.id,
    weekNumber: 40,
    year: 2026,
    startDate: startStr,
    endDate: endStr,
    coordinatorName: 'Lcda. Yuraima Del Valle Salazar Rojas',
    status: 'en_revision',
    observations: 'Planilla regular del Departamento de Tesorería; sin guardias programadas.',
  });

  const days = [];
  const curr = new Date(monday);
  while (curr <= sunday) {
    days.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }

  const attendanceWorkers = [empAnalista, empPresidente];
  const recordsToSave = [];
  for (const emp of attendanceWorkers) {
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
   - Correo:       admin@idanz.gob.ve
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
