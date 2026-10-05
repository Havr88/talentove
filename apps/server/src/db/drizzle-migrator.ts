import type { Client } from '@libsql/client';

/**
 * Inicializa el esquema DDL y la configuración WAL en SQLite usando LibSQL.
 */
export async function initSqliteSchema(client: Client): Promise<void> {
  await client.execute('PRAGMA journal_mode = WAL;');
  await client.execute('PRAGMA foreign_keys = ON;');

  const tables = [
    `CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      company_name TEXT NOT NULL,
      native_id TEXT NOT NULL,
      instance_name TEXT NOT NULL DEFAULT 'TalentoVe',
      primary_color TEXT NOT NULL DEFAULT '#0d47a1',
      accent_color TEXT NOT NULL DEFAULT '#d32f2f',
      is_configured INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL UNIQUE,
      last_active_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS territories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      capital TEXT NOT NULL DEFAULT ''
    );`,
    `CREATE TABLE IF NOT EXISTS org_units (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type_id INTEGER NOT NULL,
      parent_id TEXT REFERENCES org_units(id),
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      categoria TEXT NOT NULL,
      grupo_isco TEXT NOT NULL,
      aplica_sector TEXT NOT NULL DEFAULT 'mixto',
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      cedula_tipo TEXT NOT NULL,
      cedula_numero TEXT NOT NULL,
      native_id TEXT NOT NULL UNIQUE,
      rif TEXT,
      nombres TEXT NOT NULL,
      apellidos TEXT NOT NULL,
      fecha_nacimiento TEXT NOT NULL,
      sexo TEXT NOT NULL,
      estado_civil TEXT NOT NULL,
      correo TEXT,
      telefono TEXT,
      direccion TEXT NOT NULL,
      territory_id INTEGER REFERENCES territories(id),
      status TEXT NOT NULL DEFAULT 'activo',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      location_id TEXT,
      org_unit_id TEXT REFERENCES org_units(id),
      position_id INTEGER REFERENCES positions(id),
      personnel_type_id INTEGER,
      tipo TEXT NOT NULL,
      sector TEXT NOT NULL DEFAULT 'privado',
      fecha_ingreso TEXT NOT NULL,
      fecha_fin TEXT,
      salario_base TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'VES',
      jornada_horas INTEGER NOT NULL DEFAULT 8,
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS bank_accounts (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      banco_codigo TEXT NOT NULL,
      banco_nombre TEXT NOT NULL,
      tipo TEXT NOT NULL,
      numero TEXT NOT NULL,
      es_principal INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS family_dependents (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      nombres TEXT NOT NULL,
      apellidos TEXT NOT NULL,
      parentesco TEXT NOT NULL,
      cedula TEXT,
      fecha_nacimiento TEXT NOT NULL,
      sexo TEXT NOT NULL,
      grado_instruccion TEXT NOT NULL,
      discapacidad INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS contract_movements (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL REFERENCES contracts(id),
      employee_id TEXT NOT NULL REFERENCES employees(id),
      tipo_movimiento TEXT NOT NULL,
      fecha_efectiva TEXT NOT NULL,
      cargo_anterior TEXT,
      cargo_nuevo TEXT NOT NULL,
      unidad_anterior TEXT,
      unidad_nueva TEXT NOT NULL,
      salario_anterior TEXT,
      salario_nuevo TEXT NOT NULL,
      motivo TEXT,
      aprobado_por TEXT,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS employee_requests (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      tipo TEXT NOT NULL,
      motivo TEXT NOT NULL,
      estatus TEXT NOT NULL DEFAULT 'pendiente',
      fecha_desde TEXT,
      fecha_hasta TEXT,
      dias_solicitados INTEGER,
      monto_solicitado TEXT,
      observaciones_rrhh TEXT,
      codigo_verificacion TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS attendance_sheets (
      id TEXT PRIMARY KEY,
      org_unit_id TEXT NOT NULL,
      week_number INTEGER NOT NULL,
      year INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      coordinator_id TEXT,
      coordinator_name TEXT NOT NULL,
      verified_by TEXT,
      status TEXT NOT NULL DEFAULT 'borrador',
      observations TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(org_unit_id, week_number, year)
    );`,
    `CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      sheet_id TEXT NOT NULL REFERENCES attendance_sheets(id),
      employee_id TEXT NOT NULL REFERENCES employees(id),
      date TEXT NOT NULL,
      day_of_week INTEGER NOT NULL,
      time_in TEXT,
      time_out TEXT,
      status TEXT NOT NULL DEFAULT 'asistio',
      regular_hours REAL NOT NULL DEFAULT 0,
      overtime_day_hours REAL NOT NULL DEFAULT 0,
      overtime_night_hours REAL NOT NULL DEFAULT 0,
      night_shift_hours REAL NOT NULL DEFAULT 0,
      worker_signed INTEGER NOT NULL DEFAULT 0,
      observations TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(sheet_id, employee_id, date)
    );`,
    `CREATE TABLE IF NOT EXISTS leaves (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      leave_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      return_date TEXT NOT NULL,
      total_calendar_days INTEGER NOT NULL DEFAULT 1,
      total_business_days INTEGER NOT NULL DEFAULT 1,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'PENDIENTE',
      approved_by TEXT,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS overtime_requests (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      category TEXT NOT NULL,
      hours REAL NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'PENDIENTE',
      approved_by TEXT,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS employee_loans (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      loan_type TEXT NOT NULL,
      total_amount REAL NOT NULL,
      installment_amount REAL NOT NULL,
      remaining_balance REAL NOT NULL,
      start_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'APROBADO',
      installments_paid INTEGER NOT NULL DEFAULT 0,
      details TEXT,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS attendance_audit_logs (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      attendance_date TEXT NOT NULL,
      field_changed TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS custom_fields (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      data_type TEXT NOT NULL,
      options TEXT,
      is_required INTEGER NOT NULL DEFAULT 0,
      section TEXT NOT NULL DEFAULT 'DATOS_PERSONALES',
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS travel_records (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      travel_type TEXT NOT NULL,
      purpose TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      departure_date TEXT NOT NULL,
      return_date TEXT NOT NULL,
      advance_fund_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PENDIENTE',
      approved_by TEXT,
      created_at TEXT NOT NULL
    );`,
  ];

  for (const statement of tables) {
    await client.execute(statement);
  }
}
