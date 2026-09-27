import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const settingsTable = sqliteTable('settings', {
  id: integer('id').primaryKey().default(1),
  companyName: text('company_name').notNull(),
  nativeId: text('native_id').notNull(),
  instanceName: text('instance_name').notNull().default('TalentoVe'),
  primaryColor: text('primary_color').notNull().default('#0d47a1'),
  accentColor: text('accent_color').notNull().default('#d32f2f'),
  isConfigured: integer('is_configured', { mode: 'boolean' }).notNull().default(false),
  updatedAt: text('updated_at').notNull(),
});

export const usersTable = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull().default('admin'),
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const sessionsTable = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => usersTable.id),
  tokenHash: text('token_hash').notNull().unique(),
  lastActiveAt: text('last_active_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
});

export const territoriesTable = sqliteTable('territories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  codigo: text('codigo').notNull().unique(),
  nombre: text('nombre').notNull(),
  capital: text('capital').notNull().default(''),
});

export const orgUnitsTable = sqliteTable('org_units', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  typeId: integer('type_id').notNull(),
  parentId: text('parent_id'),
  createdAt: text('created_at').notNull(),
});

export const positionsTable = sqliteTable('positions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  categoria: text('categoria').notNull(),
  grupoIsco: text('grupo_isco').notNull(),
  aplicaSector: text('aplica_sector').notNull().default('mixto'),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

export const employeesTable = sqliteTable('employees', {
  id: text('id').primaryKey(),
  cedulaTipo: text('cedula_tipo').notNull(),
  cedulaNumero: text('cedula_numero').notNull(),
  nativeId: text('native_id').notNull().unique(),
  rif: text('rif'),
  nombres: text('nombres').notNull(),
  apellidos: text('apellidos').notNull(),
  fechaNacimiento: text('fecha_nacimiento').notNull(),
  sexo: text('sexo').notNull(),
  estadoCivil: text('estado_civil').notNull(),
  correo: text('correo'),
  telefono: text('telefono'),
  direccion: text('direccion').notNull(),
  territoryId: integer('territory_id').references(() => territoriesTable.id),
  status: text('status').notNull().default('activo'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const contractsTable = sqliteTable('contracts', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employeesTable.id),
  locationId: text('location_id'),
  orgUnitId: text('org_unit_id').references(() => orgUnitsTable.id),
  positionId: integer('position_id').references(() => positionsTable.id),
  personnelTypeId: integer('personnel_type_id'),
  tipo: text('tipo').notNull(),
  sector: text('sector').notNull().default('privado'),
  fechaIngreso: text('fecha_ingreso').notNull(),
  fechaFin: text('fecha_fin'),
  salarioBase: text('salario_base').notNull(),
  currency: text('currency').notNull().default('VES'),
  jornadaHoras: integer('jornada_horas').notNull().default(8),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const bankAccountsTable = sqliteTable('bank_accounts', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employeesTable.id),
  bancoCodigo: text('banco_codigo').notNull(),
  bancoNombre: text('banco_nombre').notNull(),
  tipo: text('tipo').notNull(),
  numero: text('numero').notNull(),
  esPrincipal: integer('es_principal', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

export const familyDependentsTable = sqliteTable('family_dependents', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employeesTable.id),
  nombres: text('nombres').notNull(),
  apellidos: text('apellidos').notNull(),
  parentesco: text('parentesco').notNull(),
  cedula: text('cedula'),
  fechaNacimiento: text('fecha_nacimiento').notNull(),
  sexo: text('sexo').notNull(),
  gradoInstruccion: text('grado_instruccion').notNull(),
  discapacidad: integer('discapacidad', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

export const contractMovementsTable = sqliteTable('contract_movements', {
  id: text('id').primaryKey(),
  contractId: text('contract_id').notNull().references(() => contractsTable.id),
  employeeId: text('employee_id').notNull().references(() => employeesTable.id),
  tipoMovimiento: text('tipo_movimiento').notNull(),
  fechaEfectiva: text('fecha_efectiva').notNull(),
  cargoAnterior: text('cargo_anterior'),
  cargoNuevo: text('cargo_nuevo').notNull(),
  unidadAnterior: text('unidad_anterior'),
  unidadNueva: text('unidad_nueva').notNull(),
  salarioAnterior: text('salario_anterior'),
  salarioNuevo: text('salario_nuevo').notNull(),
  motivo: text('motivo'),
  aprobadoPor: text('aprobado_por'),
  createdAt: text('created_at').notNull(),
});

export const employeeRequestsTable = sqliteTable('employee_requests', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employeesTable.id),
  tipo: text('tipo').notNull(),
  motivo: text('motivo').notNull(),
  estatus: text('estatus').notNull().default('pendiente'),
  fechaDesde: text('fecha_desde'),
  fechaHasta: text('fecha_hasta'),
  diasSolicitados: integer('dias_solicitados'),
  montoSolicitado: text('monto_solicitado'),
  observacionesRrhh: text('observaciones_rrhh'),
  codigoVerificacion: text('codigo_verificacion'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const attendanceSheetsTable = sqliteTable(
  'attendance_sheets',
  {
    id: text('id').primaryKey(),
    orgUnitId: text('org_unit_id').notNull(),
    weekNumber: integer('week_number').notNull(),
    year: integer('year').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    coordinatorId: text('coordinator_id'),
    coordinatorName: text('coordinator_name').notNull(),
    verifiedBy: text('verified_by'),
    status: text('status').notNull().default('borrador'),
    observations: text('observations'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_attendance_sheets_unit_week_year').on(table.orgUnitId, table.weekNumber, table.year),
  ]
);

export const attendanceRecordsTable = sqliteTable(
  'attendance_records',
  {
    id: text('id').primaryKey(),
    sheetId: text('sheet_id').notNull().references(() => attendanceSheetsTable.id),
    employeeId: text('employee_id').notNull().references(() => employeesTable.id),
    date: text('date').notNull(),
    dayOfWeek: integer('day_of_week').notNull(),
    timeIn: text('time_in'),
    timeOut: text('time_out'),
    status: text('status').notNull().default('asistio'),
    regularHours: real('regular_hours').notNull().default(0),
    overtimeDayHours: real('overtime_day_hours').notNull().default(0),
    overtimeNightHours: real('overtime_night_hours').notNull().default(0),
    nightShiftHours: real('night_shift_hours').notNull().default(0),
    workerSigned: integer('worker_signed', { mode: 'boolean' }).notNull().default(false),
    observations: text('observations'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_attendance_records_sheet_emp_date').on(table.sheetId, table.employeeId, table.date),
  ]
);
