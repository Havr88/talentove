import type { Pool } from 'pg';
import type {
  AttendanceRecord,
  AttendanceRecordStatus,
  AttendanceSheet,
  AttendanceSheetStatus,
  CompanySettings,
  Contract,
  ContractMovement,
  Employee,
  EmployeeRequest,
  FamilyDependent,
  IAttendanceRepository,
  IContractMovementRepository,
  IContractRepository,
  IEmployeeRepository,
  IEmployeeRequestRepository,
  IFamilyDependentRepository,
  IOrgUnitRepository,
  IPositionRepository,
  ISessionRepository,
  ISettingsRepository,
  ITerritoryRepository,
  IUserRepository,
  OrgUnit,
  Position,
  Repositories,
  RequestStatus,
  Session,
  Territory,
  User,
} from './types.js';
import {
  MemoryPayrollRepository,
  MemoryDigitalCredentialRepository,
  MemoryHolidayRepository,
  MemoryBankPaymentRepository,
  MemoryAssignedAssetRepository,
  MemorySstRepository, MemoryJobPostingRepository, MemoryJobApplicationRepository, MemoryTrainingRepository, MemoryPerformanceRepository } from './memory-repositories.js';

export class PgSettingsRepository implements ISettingsRepository {
  constructor(private pool: Pool) {}

  async getSettings(): Promise<CompanySettings | null> {
    const { rows } = await this.pool.query<{
      id: number;
      company_name: string;
      native_id: string;
      instance_name: string;
      primary_color: string;
      accent_color: string;
      is_configured: boolean;
      updated_at: Date;
    }>('SELECT * FROM settings WHERE id = 1 LIMIT 1');

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      companyName: row.company_name,
      nativeId: row.native_id,
      instanceName: row.instance_name,
      primaryColor: row.primary_color,
      accentColor: row.accent_color,
      isConfigured: row.is_configured,
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async saveSettings(data: Omit<CompanySettings, 'id' | 'updatedAt'>): Promise<CompanySettings> {
    const { rows } = await this.pool.query<{
      id: number;
      company_name: string;
      native_id: string;
      instance_name: string;
      primary_color: string;
      accent_color: string;
      is_configured: boolean;
      updated_at: Date;
    }>(
      `INSERT INTO settings (id, company_name, native_id, instance_name, primary_color, accent_color, is_configured, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (id) DO UPDATE SET
         company_name = EXCLUDED.company_name,
         native_id = EXCLUDED.native_id,
         instance_name = EXCLUDED.instance_name,
         primary_color = EXCLUDED.primary_color,
         accent_color = EXCLUDED.accent_color,
         is_configured = EXCLUDED.is_configured,
         updated_at = NOW()
       RETURNING *`,
      [
        data.companyName,
        data.nativeId,
        data.instanceName,
        data.primaryColor,
        data.accentColor,
        data.isConfigured,
      ],
    );

    const row = rows[0]!;
    return {
      id: row.id,
      companyName: row.company_name,
      nativeId: row.native_id,
      instanceName: row.instance_name,
      primaryColor: row.primary_color,
      accentColor: row.accent_color,
      isConfigured: row.is_configured,
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

export class PgUserRepository implements IUserRepository {
  constructor(private pool: Pool) {}

  async findById(id: string): Promise<User | null> {
    const { rows } = await this.pool.query<{
      id: string;
      email: string;
      password_hash: string;
      full_name: string;
      role: User['role'];
      status: User['status'];
      totp_secret_enc: string | null;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM users WHERE id = $1', [id]);

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      fullName: row.full_name,
      role: row.role,
      status: row.status,
      totpSecretEnc: row.totp_secret_enc ?? undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await this.pool.query<{
      id: string;
      email: string;
      password_hash: string;
      full_name: string;
      role: User['role'];
      status: User['status'];
      totp_secret_enc: string | null;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      fullName: row.full_name,
      role: row.role,
      status: row.status,
      totpSecretEnc: row.totp_secret_enc ?? undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const { rows } = await this.pool.query<{
      id: string;
      email: string;
      password_hash: string;
      full_name: string;
      role: User['role'];
      status: User['status'];
      totp_secret_enc: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO users (email, password_hash, full_name, role, status, totp_secret_enc, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [
        user.email.toLowerCase().trim(),
        user.passwordHash,
        user.fullName,
        user.role,
        user.status,
        user.totpSecretEnc ?? null,
      ],
    );

    const row = rows[0]!;
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      fullName: row.full_name,
      role: row.role,
      status: row.status,
      totpSecretEnc: row.totp_secret_enc ?? undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async count(): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>('SELECT COUNT(*) as count FROM users');
    return Number.parseInt(rows[0]?.count ?? '0', 10);
  }
}

export class PgSessionRepository implements ISessionRepository {
  constructor(private pool: Pool) {}

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const { rows } = await this.pool.query<{
      id: string;
      user_id: string;
      token_hash: string;
      created_at: Date;
      expires_at: Date;
      last_active_at: Date;
      ip_address: string | null;
      user_agent: string | null;
    }>('SELECT * FROM sessions WHERE token_hash = $1', [tokenHash]);

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      createdAt: row.created_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      lastActiveAt: row.last_active_at.toISOString(),
      ipAddress: row.ip_address ?? undefined,
      userAgent: row.user_agent ?? undefined,
    };
  }

  async create(session: Omit<Session, 'id' | 'createdAt'>): Promise<Session> {
    const { rows } = await this.pool.query<{
      id: string;
      user_id: string;
      token_hash: string;
      created_at: Date;
      expires_at: Date;
      last_active_at: Date;
      ip_address: string | null;
      user_agent: string | null;
    }>(
      `INSERT INTO sessions (user_id, token_hash, expires_at, last_active_at, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [
        session.userId,
        session.tokenHash,
        session.expiresAt,
        session.lastActiveAt,
        session.ipAddress ?? null,
        session.userAgent ?? null,
      ],
    );

    const row = rows[0]!;
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      createdAt: row.created_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      lastActiveAt: row.last_active_at.toISOString(),
      ipAddress: row.ip_address ?? undefined,
      userAgent: row.user_agent ?? undefined,
    };
  }

  async touch(id: string, lastActiveAt: string): Promise<void> {
    await this.pool.query('UPDATE sessions SET last_active_at = $1 WHERE id = $2', [
      lastActiveAt,
      id,
    ]);
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  }

  async deleteExpired(nowIso: string): Promise<number> {
    const { rowCount } = await this.pool.query('DELETE FROM sessions WHERE expires_at <= $1', [
      nowIso,
    ]);
    return rowCount ?? 0;
  }
}

export class PgTerritoryRepository implements ITerritoryRepository {
  constructor(private pool: Pool) {}

  async list(): Promise<Territory[]> {
    const { rows } = await this.pool.query<Territory>('SELECT * FROM territories ORDER BY id ASC');
    return rows;
  }

  async findById(id: number): Promise<Territory | null> {
    const { rows } = await this.pool.query<Territory>('SELECT * FROM territories WHERE id = $1', [id]);
    return rows[0] ?? null;
  }

  async findByCodigo(codigo: string): Promise<Territory | null> {
    const { rows } = await this.pool.query<Territory>('SELECT * FROM territories WHERE UPPER(codigo) = UPPER($1)', [codigo]);
    return rows[0] ?? null;
  }
}

export class PgOrgUnitRepository implements IOrgUnitRepository {
  constructor(private pool: Pool) {}

  async list(): Promise<OrgUnit[]> {
    const { rows } = await this.pool.query<{
      id: string;
      parent_id: string | null;
      type_id: number;
      name: string;
      location_id: string | null;
      created_at: Date;
    }>('SELECT * FROM org_units ORDER BY name ASC');

    return rows.map((r) => ({
      id: r.id,
      parentId: r.parent_id ?? undefined,
      typeId: r.type_id,
      name: r.name,
      locationId: r.location_id ?? undefined,
      createdAt: r.created_at.toISOString(),
    }));
  }

  async create(data: Omit<OrgUnit, 'id' | 'createdAt'>): Promise<OrgUnit> {
    const { rows } = await this.pool.query<{
      id: string;
      parent_id: string | null;
      type_id: number;
      name: string;
      location_id: string | null;
      created_at: Date;
    }>(
      `INSERT INTO org_units (parent_id, type_id, name, location_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [data.parentId ?? null, data.typeId, data.name, data.locationId ?? null],
    );

    const r = rows[0]!;
    return {
      id: r.id,
      parentId: r.parent_id ?? undefined,
      typeId: r.type_id,
      name: r.name,
      locationId: r.location_id ?? undefined,
      createdAt: r.created_at.toISOString(),
    };
  }

  async findById(id: string): Promise<OrgUnit | null> {
    const { rows } = await this.pool.query<{
      id: string;
      parent_id: string | null;
      type_id: number;
      name: string;
      location_id: string | null;
      created_at: Date;
    }>('SELECT * FROM org_units WHERE id = $1', [id]);

    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      parentId: r.parent_id ?? undefined,
      typeId: r.type_id,
      name: r.name,
      locationId: r.location_id ?? undefined,
      createdAt: r.created_at.toISOString(),
    };
  }
}

export class PgPositionRepository implements IPositionRepository {
  constructor(private pool: Pool) {}

  async list(): Promise<Position[]> {
    const { rows } = await this.pool.query<{
      id: number;
      codigo: string | null;
      name: string;
      categoria: string;
      grupo_isco: string;
      aplica_sector: Position['aplicaSector'];
      nivel_tabulador_apn: string | null;
      activo: boolean;
    }>('SELECT * FROM positions ORDER BY name ASC');

    return rows.map((r) => ({
      id: r.id,
      codigo: r.codigo ?? undefined,
      name: r.name,
      categoria: r.categoria,
      grupoIsco: r.grupo_isco,
      aplicaSector: r.aplica_sector,
      nivelTabuladorApn: r.nivel_tabulador_apn ?? undefined,
      activo: r.activo,
    }));
  }

  async create(data: Omit<Position, 'id'>): Promise<Position> {
    const { rows } = await this.pool.query<{
      id: number;
      codigo: string | null;
      name: string;
      categoria: string;
      grupo_isco: string;
      aplica_sector: Position['aplicaSector'];
      nivel_tabulador_apn: string | null;
      activo: boolean;
    }>(
      `INSERT INTO positions (codigo, name, categoria, grupo_isco, aplica_sector, nivel_tabulador_apn, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.codigo ?? null,
        data.name,
        data.categoria,
        data.grupoIsco,
        data.aplicaSector,
        data.nivelTabuladorApn ?? null,
        data.activo,
      ],
    );

    const r = rows[0]!;
    return {
      id: r.id,
      codigo: r.codigo ?? undefined,
      name: r.name,
      categoria: r.categoria,
      grupoIsco: r.grupo_isco,
      aplicaSector: r.aplica_sector,
      nivelTabuladorApn: r.nivel_tabulador_apn ?? undefined,
      activo: r.activo,
    };
  }

  async findById(id: number): Promise<Position | null> {
    const { rows } = await this.pool.query<{
      id: number;
      codigo: string | null;
      name: string;
      categoria: string;
      grupo_isco: string;
      aplica_sector: Position['aplicaSector'];
      nivel_tabulador_apn: string | null;
      activo: boolean;
    }>('SELECT * FROM positions WHERE id = $1', [id]);

    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      codigo: r.codigo ?? undefined,
      name: r.name,
      categoria: r.categoria,
      grupoIsco: r.grupo_isco,
      aplicaSector: r.aplica_sector,
      nivelTabuladorApn: r.nivel_tabulador_apn ?? undefined,
      activo: r.activo,
    };
  }

  async findByName(name: string): Promise<Position | null> {
    const { rows } = await this.pool.query<{
      id: number;
      codigo: string | null;
      name: string;
      categoria: string;
      grupo_isco: string;
      aplica_sector: Position['aplicaSector'];
      nivel_tabulador_apn: string | null;
      activo: boolean;
    }>('SELECT * FROM positions WHERE LOWER(name) = LOWER($1)', [name.trim()]);

    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      codigo: r.codigo ?? undefined,
      name: r.name,
      categoria: r.categoria,
      grupoIsco: r.grupo_isco,
      aplicaSector: r.aplica_sector,
      nivelTabuladorApn: r.nivel_tabulador_apn ?? undefined,
      activo: r.activo,
    };
  }
}

export class PgEmployeeRepository implements IEmployeeRepository {
  constructor(private pool: Pool) {}

  async list(): Promise<Employee[]> {
    const { rows } = await this.pool.query<{
      id: string;
      cedula_tipo: 'V' | 'E';
      cedula_numero: string;
      native_id: string;
      rif: string | null;
      nombres: string;
      apellidos: string;
      fecha_nacimiento: Date;
      sexo: 'M' | 'F';
      estado_civil: Employee['estadoCivil'];
      correo: string | null;
      telefono: string | null;
      direccion: string;
      territory_id: number | null;
      status: Employee['status'];
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM employees ORDER BY apellidos ASC, nombres ASC');

    return rows.map((r) => ({
      id: r.id,
      cedulaTipo: r.cedula_tipo,
      cedulaNumero: r.cedula_numero,
      nativeId: r.native_id,
      rif: r.rif ?? undefined,
      nombres: r.nombres,
      apellidos: r.apellidos,
      fechaNacimiento: r.fecha_nacimiento.toISOString().split('T')[0]!,
      sexo: r.sexo,
      estadoCivil: r.estado_civil,
      correo: r.correo ?? undefined,
      telefono: r.telefono ?? undefined,
      direccion: r.direccion,
      territoryId: r.territory_id ?? undefined,
      status: r.status,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));
  }

  async findById(id: string): Promise<Employee | null> {
    const { rows } = await this.pool.query<{
      id: string;
      cedula_tipo: 'V' | 'E';
      cedula_numero: string;
      native_id: string;
      rif: string | null;
      nombres: string;
      apellidos: string;
      fecha_nacimiento: Date;
      sexo: 'M' | 'F';
      estado_civil: Employee['estadoCivil'];
      correo: string | null;
      telefono: string | null;
      direccion: string;
      territory_id: number | null;
      status: Employee['status'];
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM employees WHERE id = $1', [id]);

    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      cedulaTipo: r.cedula_tipo,
      cedulaNumero: r.cedula_numero,
      nativeId: r.native_id,
      rif: r.rif ?? undefined,
      nombres: r.nombres,
      apellidos: r.apellidos,
      fechaNacimiento: r.fecha_nacimiento.toISOString().split('T')[0]!,
      sexo: r.sexo,
      estadoCivil: r.estado_civil,
      correo: r.correo ?? undefined,
      telefono: r.telefono ?? undefined,
      direccion: r.direccion,
      territoryId: r.territory_id ?? undefined,
      status: r.status,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    };
  }

  async findByNativeId(nativeId: string): Promise<Employee | null> {
    const { rows } = await this.pool.query<{
      id: string;
      cedula_tipo: 'V' | 'E';
      cedula_numero: string;
      native_id: string;
      rif: string | null;
      nombres: string;
      apellidos: string;
      fecha_nacimiento: Date;
      sexo: 'M' | 'F';
      estado_civil: Employee['estadoCivil'];
      correo: string | null;
      telefono: string | null;
      direccion: string;
      territory_id: number | null;
      status: Employee['status'];
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM employees WHERE native_id = UPPER($1)', [nativeId.trim()]);

    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      cedulaTipo: r.cedula_tipo,
      cedulaNumero: r.cedula_numero,
      nativeId: r.native_id,
      rif: r.rif ?? undefined,
      nombres: r.nombres,
      apellidos: r.apellidos,
      fechaNacimiento: r.fecha_nacimiento.toISOString().split('T')[0]!,
      sexo: r.sexo,
      estadoCivil: r.estado_civil,
      correo: r.correo ?? undefined,
      telefono: r.telefono ?? undefined,
      direccion: r.direccion,
      territoryId: r.territory_id ?? undefined,
      status: r.status,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    };
  }

  async create(data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<Employee> {
    const { rows } = await this.pool.query<{
      id: string;
      cedula_tipo: 'V' | 'E';
      cedula_numero: string;
      native_id: string;
      rif: string | null;
      nombres: string;
      apellidos: string;
      fecha_nacimiento: Date;
      sexo: 'M' | 'F';
      estado_civil: Employee['estadoCivil'];
      correo: string | null;
      telefono: string | null;
      direccion: string;
      territory_id: number | null;
      status: Employee['status'];
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO employees (
        cedula_tipo, cedula_numero, native_id, rif, nombres, apellidos,
        fecha_nacimiento, sexo, estado_civil, correo, telefono, direccion,
        territory_id, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING *`,
      [
        data.cedulaTipo,
        data.cedulaNumero,
        data.nativeId,
        data.rif ?? null,
        data.nombres,
        data.apellidos,
        data.fechaNacimiento,
        data.sexo,
        data.estadoCivil,
        data.correo ?? null,
        data.telefono ?? null,
        data.direccion,
        data.territoryId ?? null,
        data.status,
      ],
    );

    const r = rows[0]!;
    return {
      id: r.id,
      cedulaTipo: r.cedula_tipo,
      cedulaNumero: r.cedula_numero,
      nativeId: r.native_id,
      rif: r.rif ?? undefined,
      nombres: r.nombres,
      apellidos: r.apellidos,
      fechaNacimiento: r.fecha_nacimiento.toISOString().split('T')[0]!,
      sexo: r.sexo,
      estadoCivil: r.estado_civil,
      correo: r.correo ?? undefined,
      telefono: r.telefono ?? undefined,
      direccion: r.direccion,
      territoryId: r.territory_id ?? undefined,
      status: r.status,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    };
  }

  async update(id: string, data: Partial<Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Employee | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    const { rows } = await this.pool.query<{
      id: string;
      cedula_tipo: Employee['cedulaTipo'];
      cedula_numero: string;
      native_id: string;
      rif: string | null;
      nombres: string;
      apellidos: string;
      fecha_nacimiento: Date;
      sexo: Employee['sexo'];
      estado_civil: Employee['estadoCivil'];
      correo: string | null;
      telefono: string | null;
      direccion: string;
      territory_id: number | null;
      status: Employee['status'];
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE employees SET
        nombres = $1, apellidos = $2, fecha_nacimiento = $3, sexo = $4,
        estado_civil = $5, correo = $6, telefono = $7, direccion = $8,
        territory_id = $9, status = $10, updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [
        merged.nombres,
        merged.apellidos,
        merged.fechaNacimiento,
        merged.sexo,
        merged.estadoCivil,
        merged.correo ?? null,
        merged.telefono ?? null,
        merged.direccion,
        merged.territoryId ?? null,
        merged.status,
        id,
      ],
    );
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      cedulaTipo: r.cedula_tipo,
      cedulaNumero: r.cedula_numero,
      nativeId: r.native_id,
      rif: r.rif ?? undefined,
      nombres: r.nombres,
      apellidos: r.apellidos,
      fechaNacimiento: r.fecha_nacimiento.toISOString().split('T')[0]!,
      sexo: r.sexo,
      estadoCivil: r.estado_civil,
      correo: r.correo ?? undefined,
      telefono: r.telefono ?? undefined,
      direccion: r.direccion,
      territoryId: r.territory_id ?? undefined,
      status: r.status,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    };
  }

  async count(): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>('SELECT COUNT(*) as count FROM employees');
    return Number.parseInt(rows[0]?.count ?? '0', 10);
  }
}

export class PgContractRepository implements IContractRepository {
  constructor(private pool: Pool) {}

  async findActiveByEmployeeId(employeeId: string): Promise<Contract | null> {
    const { rows } = await this.pool.query<{
      id: string;
      employee_id: string;
      location_id: string | null;
      org_unit_id: string | null;
      position_id: number | null;
      personnel_type_id: number | null;
      tipo: Contract['tipo'];
      sector: Contract['sector'];
      fecha_ingreso: Date;
      fecha_fin: Date | null;
      salario_base: string;
      currency: Contract['currency'];
      jornada_horas: string;
      activo: boolean;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM contracts WHERE employee_id = $1 AND activo = true LIMIT 1', [employeeId]);

    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      employeeId: r.employee_id,
      locationId: r.location_id ?? undefined,
      orgUnitId: r.org_unit_id ?? undefined,
      positionId: r.position_id ?? undefined,
      personnelTypeId: r.personnel_type_id ?? undefined,
      tipo: r.tipo,
      sector: r.sector,
      fechaIngreso: r.fecha_ingreso.toISOString().split('T')[0]!,
      fechaFin: r.fecha_fin ? r.fecha_fin.toISOString().split('T')[0]! : undefined,
      salarioBase: r.salario_base,
      currency: r.currency,
      jornadaHoras: Number.parseFloat(r.jornada_horas),
      activo: r.activo,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    };
  }

  async create(data: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contract> {
    const { rows } = await this.pool.query<{
      id: string;
      employee_id: string;
      location_id: string | null;
      org_unit_id: string | null;
      position_id: number | null;
      personnel_type_id: number | null;
      tipo: Contract['tipo'];
      sector: Contract['sector'];
      fecha_ingreso: Date;
      fecha_fin: Date | null;
      salario_base: string;
      currency: Contract['currency'];
      jornada_horas: string;
      activo: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO contracts (
        employee_id, location_id, org_unit_id, position_id, personnel_type_id,
        tipo, sector, fecha_ingreso, fecha_fin, salario_base, currency, jornada_horas, activo,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
      RETURNING *`,
      [
        data.employeeId,
        data.locationId ?? null,
        data.orgUnitId ?? null,
        data.positionId ?? null,
        data.personnelTypeId ?? null,
        data.tipo,
        data.sector,
        data.fechaIngreso,
        data.fechaFin ?? null,
        data.salarioBase,
        data.currency,
        data.jornadaHoras,
        data.activo,
      ],
    );

    const r = rows[0]!;
    return {
      id: r.id,
      employeeId: r.employee_id,
      locationId: r.location_id ?? undefined,
      orgUnitId: r.org_unit_id ?? undefined,
      positionId: r.position_id ?? undefined,
      personnelTypeId: r.personnel_type_id ?? undefined,
      tipo: r.tipo,
      sector: r.sector,
      fechaIngreso: r.fecha_ingreso.toISOString().split('T')[0]!,
      fechaFin: r.fecha_fin ? r.fecha_fin.toISOString().split('T')[0]! : undefined,
      salarioBase: r.salario_base,
      currency: r.currency,
      jornadaHoras: Number.parseFloat(r.jornada_horas),
      activo: r.activo,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    };
  }

  async findByEmployeeId(employeeId: string): Promise<Contract[]> {
    const { rows } = await this.pool.query<{
      id: string;
      employee_id: string;
      location_id: string | null;
      org_unit_id: string | null;
      position_id: number | null;
      personnel_type_id: number | null;
      tipo: Contract['tipo'];
      sector: Contract['sector'];
      fecha_ingreso: Date;
      fecha_fin: Date | null;
      salario_base: string;
      currency: Contract['currency'];
      jornada_horas: string;
      activo: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT * FROM contracts WHERE employee_id = $1 ORDER BY fecha_ingreso DESC`,
      [employeeId],
    );
    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      locationId: r.location_id ?? undefined,
      orgUnitId: r.org_unit_id ?? undefined,
      positionId: r.position_id ?? undefined,
      personnelTypeId: r.personnel_type_id ?? undefined,
      tipo: r.tipo,
      sector: r.sector,
      fechaIngreso: r.fecha_ingreso.toISOString().split('T')[0]!,
      fechaFin: r.fecha_fin ? r.fecha_fin.toISOString().split('T')[0]! : undefined,
      salarioBase: r.salario_base,
      currency: r.currency,
      jornadaHoras: Number.parseFloat(r.jornada_horas),
      activo: r.activo,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));
  }

  async update(id: string, data: Partial<Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Contract | null> {
    const { rows } = await this.pool.query<{
      id: string;
      employee_id: string;
      location_id: string | null;
      org_unit_id: string | null;
      position_id: number | null;
      personnel_type_id: number | null;
      tipo: Contract['tipo'];
      sector: Contract['sector'];
      fecha_ingreso: Date;
      fecha_fin: Date | null;
      salario_base: string;
      currency: Contract['currency'];
      jornada_horas: string;
      activo: boolean;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM contracts WHERE id = $1 LIMIT 1', [id]);
    if (rows.length === 0) return null;
    const existing = rows[0]!;

    const updatedRows = await this.pool.query<{
      id: string;
      employee_id: string;
      location_id: string | null;
      org_unit_id: string | null;
      position_id: number | null;
      personnel_type_id: number | null;
      tipo: Contract['tipo'];
      sector: Contract['sector'];
      fecha_ingreso: Date;
      fecha_fin: Date | null;
      salario_base: string;
      currency: Contract['currency'];
      jornada_horas: string;
      activo: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE contracts SET
        position_id = $1, org_unit_id = $2, salario_base = $3,
        tipo = $4, sector = $5, activo = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        data.positionId ?? existing.position_id,
        data.orgUnitId ?? existing.org_unit_id,
        data.salarioBase ?? existing.salario_base,
        data.tipo ?? existing.tipo,
        data.sector ?? existing.sector,
        data.activo !== undefined ? data.activo : existing.activo,
        id,
      ],
    );
    const r = updatedRows.rows[0]!;
    return {
      id: r.id,
      employeeId: r.employee_id,
      locationId: r.location_id ?? undefined,
      orgUnitId: r.org_unit_id ?? undefined,
      positionId: r.position_id ?? undefined,
      personnelTypeId: r.personnel_type_id ?? undefined,
      tipo: r.tipo,
      sector: r.sector,
      fechaIngreso: r.fecha_ingreso.toISOString().split('T')[0]!,
      fechaFin: r.fecha_fin ? r.fecha_fin.toISOString().split('T')[0]! : undefined,
      salarioBase: r.salario_base,
      currency: r.currency,
      jornadaHoras: Number.parseFloat(r.jornada_horas),
      activo: r.activo,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    };
  }
}

export class PgFamilyDependentRepository implements IFamilyDependentRepository {
  constructor(private pool: Pool) {}

  async listByEmployeeId(employeeId: string): Promise<FamilyDependent[]> {
    const { rows } = await this.pool.query<{
      id: string;
      employee_id: string;
      nombres: string;
      apellidos: string;
      parentesco: FamilyDependent['parentesco'];
      cedula: string | null;
      fecha_nacimiento: Date;
      sexo: FamilyDependent['sexo'];
      grado_instruccion: string;
      discapacidad: boolean;
      created_at: Date;
    }>(
      'SELECT * FROM family_dependents WHERE employee_id = $1 ORDER BY created_at ASC',
      [employeeId],
    );
    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      nombres: r.nombres,
      apellidos: r.apellidos,
      parentesco: r.parentesco,
      cedula: r.cedula ?? undefined,
      fechaNacimiento: r.fecha_nacimiento.toISOString().split('T')[0]!,
      sexo: r.sexo,
      gradoInstruccion: r.grado_instruccion,
      discapacidad: r.discapacidad,
      createdAt: r.created_at.toISOString(),
    }));
  }

  async create(data: Omit<FamilyDependent, 'id' | 'createdAt'>): Promise<FamilyDependent> {
    const { rows } = await this.pool.query<{
      id: string;
      employee_id: string;
      nombres: string;
      apellidos: string;
      parentesco: FamilyDependent['parentesco'];
      cedula: string | null;
      fecha_nacimiento: Date;
      sexo: FamilyDependent['sexo'];
      grado_instruccion: string;
      discapacidad: boolean;
      created_at: Date;
    }>(
      `INSERT INTO family_dependents (
        employee_id, nombres, apellidos, parentesco, cedula, fecha_nacimiento,
        sexo, grado_instruccion, discapacidad, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *`,
      [
        data.employeeId,
        data.nombres,
        data.apellidos,
        data.parentesco,
        data.cedula ?? null,
        data.fechaNacimiento,
        data.sexo,
        data.gradoInstruccion,
        data.discapacidad,
      ],
    );
    const r = rows[0]!;
    return {
      id: r.id,
      employeeId: r.employee_id,
      nombres: r.nombres,
      apellidos: r.apellidos,
      parentesco: r.parentesco,
      cedula: r.cedula ?? undefined,
      fechaNacimiento: r.fecha_nacimiento.toISOString().split('T')[0]!,
      sexo: r.sexo,
      gradoInstruccion: r.grado_instruccion,
      discapacidad: r.discapacidad,
      createdAt: r.created_at.toISOString(),
    };
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM family_dependents WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }
}

export class PgContractMovementRepository implements IContractMovementRepository {
  constructor(private pool: Pool) {}

  async listByEmployeeId(employeeId: string): Promise<ContractMovement[]> {
    const { rows } = await this.pool.query<{
      id: string;
      contract_id: string;
      employee_id: string;
      tipo_movimiento: ContractMovement['tipoMovimiento'];
      fecha_efectiva: Date;
      cargo_anterior: string | null;
      cargo_nuevo: string;
      unidad_anterior: string | null;
      unidad_nueva: string;
      salario_anterior: string | null;
      salario_nuevo: string;
      motivo: string | null;
      aprobado_por: string | null;
      created_at: Date;
    }>(
      'SELECT * FROM contract_movements WHERE employee_id = $1 ORDER BY created_at DESC',
      [employeeId],
    );
    return rows.map((r) => ({
      id: r.id,
      contractId: r.contract_id,
      employeeId: r.employee_id,
      tipoMovimiento: r.tipo_movimiento,
      fechaEfectiva: r.fecha_efectiva.toISOString().split('T')[0]!,
      cargoAnterior: r.cargo_anterior ?? undefined,
      cargoNuevo: r.cargo_nuevo,
      unidadAnterior: r.unidad_anterior ?? undefined,
      unidadNueva: r.unidad_nueva,
      salarioAnterior: r.salario_anterior ?? undefined,
      salarioNuevo: r.salario_nuevo,
      motivo: r.motivo ?? undefined,
      aprobadoPor: r.aprobado_por ?? undefined,
      createdAt: r.created_at.toISOString(),
    }));
  }

  async create(data: Omit<ContractMovement, 'id' | 'createdAt'>): Promise<ContractMovement> {
    const { rows } = await this.pool.query<{
      id: string;
      contract_id: string;
      employee_id: string;
      tipo_movimiento: ContractMovement['tipoMovimiento'];
      fecha_efectiva: Date;
      cargo_anterior: string | null;
      cargo_nuevo: string;
      unidad_anterior: string | null;
      unidad_nueva: string;
      salario_anterior: string | null;
      salario_nuevo: string;
      motivo: string | null;
      aprobado_por: string | null;
      created_at: Date;
    }>(
      `INSERT INTO contract_movements (
        contract_id, employee_id, tipo_movimiento, fecha_efectiva,
        cargo_anterior, cargo_nuevo, unidad_anterior, unidad_nueva,
        salario_anterior, salario_nuevo, motivo, aprobado_por, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING *`,
      [
        data.contractId,
        data.employeeId,
        data.tipoMovimiento,
        data.fechaEfectiva,
        data.cargoAnterior ?? null,
        data.cargoNuevo,
        data.unidadAnterior ?? null,
        data.unidadNueva,
        data.salarioAnterior ?? null,
        data.salarioNuevo,
        data.motivo ?? null,
        data.aprobadoPor ?? null,
      ],
    );
    const r = rows[0]!;
    return {
      id: r.id,
      contractId: r.contract_id,
      employeeId: r.employee_id,
      tipoMovimiento: r.tipo_movimiento,
      fechaEfectiva: r.fecha_efectiva.toISOString().split('T')[0]!,
      cargoAnterior: r.cargo_anterior ?? undefined,
      cargoNuevo: r.cargo_nuevo,
      unidadAnterior: r.unidad_anterior ?? undefined,
      unidadNueva: r.unidad_nueva,
      salarioAnterior: r.salario_anterior ?? undefined,
      salarioNuevo: r.salario_nuevo,
      motivo: r.motivo ?? undefined,
      aprobadoPor: r.aprobado_por ?? undefined,
      createdAt: r.created_at.toISOString(),
    };
  }
}

export class PgEmployeeRequestRepository implements IEmployeeRequestRepository {
  constructor(private pool: Pool) {}

  async list(): Promise<EmployeeRequest[]> {
    const { rows } = await this.pool.query<{
      id: string;
      employee_id: string;
      user_id: string | null;
      tipo: EmployeeRequest['tipo'];
      estatus: EmployeeRequest['estatus'];
      motivo: string;
      fecha_desde: Date | null;
      fecha_hasta: Date | null;
      dias_solicitados: number | null;
      monto_solicitado: string | null;
      observaciones_rrhh: string | null;
      codigo_verificacion: string | null;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM employee_requests ORDER BY created_at DESC');
    return rows.map((r) => this.mapRow(r));
  }

  async listByEmployeeId(employeeId: string): Promise<EmployeeRequest[]> {
    const { rows } = await this.pool.query<{
      id: string;
      employee_id: string;
      user_id: string | null;
      tipo: EmployeeRequest['tipo'];
      estatus: EmployeeRequest['estatus'];
      motivo: string;
      fecha_desde: Date | null;
      fecha_hasta: Date | null;
      dias_solicitados: number | null;
      monto_solicitado: string | null;
      observaciones_rrhh: string | null;
      codigo_verificacion: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      'SELECT * FROM employee_requests WHERE employee_id = $1 ORDER BY created_at DESC',
      [employeeId],
    );
    return rows.map((r) => this.mapRow(r));
  }

  async findById(id: string): Promise<EmployeeRequest | null> {
    const { rows } = await this.pool.query<{
      id: string;
      employee_id: string;
      user_id: string | null;
      tipo: EmployeeRequest['tipo'];
      estatus: EmployeeRequest['estatus'];
      motivo: string;
      fecha_desde: Date | null;
      fecha_hasta: Date | null;
      dias_solicitados: number | null;
      monto_solicitado: string | null;
      observaciones_rrhh: string | null;
      codigo_verificacion: string | null;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM employee_requests WHERE id = $1 LIMIT 1', [id]);
    if (rows.length === 0) return null;
    return this.mapRow(rows[0]!);
  }

  async findByCodigoVerificacion(codigo: string): Promise<EmployeeRequest | null> {
    const { rows } = await this.pool.query<{
      id: string;
      employee_id: string;
      user_id: string | null;
      tipo: EmployeeRequest['tipo'];
      estatus: EmployeeRequest['estatus'];
      motivo: string;
      fecha_desde: Date | null;
      fecha_hasta: Date | null;
      dias_solicitados: number | null;
      monto_solicitado: string | null;
      observaciones_rrhh: string | null;
      codigo_verificacion: string | null;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM employee_requests WHERE codigo_verificacion = $1 LIMIT 1', [codigo.trim()]);
    if (rows.length === 0) return null;
    return this.mapRow(rows[0]!);
  }

  async create(data: Omit<EmployeeRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmployeeRequest> {
    const { rows } = await this.pool.query<{
      id: string;
      employee_id: string;
      user_id: string | null;
      tipo: EmployeeRequest['tipo'];
      estatus: EmployeeRequest['estatus'];
      motivo: string;
      fecha_desde: Date | null;
      fecha_hasta: Date | null;
      dias_solicitados: number | null;
      monto_solicitado: string | null;
      observaciones_rrhh: string | null;
      codigo_verificacion: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO employee_requests (
        employee_id, user_id, tipo, estatus, motivo,
        fecha_desde, fecha_hasta, dias_solicitados, monto_solicitado,
        observaciones_rrhh, codigo_verificacion, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *`,
      [
        data.employeeId,
        data.userId ?? null,
        data.tipo,
        data.estatus,
        data.motivo,
        data.fechaDesde ?? null,
        data.fechaHasta ?? null,
        data.diasSolicitados ?? null,
        data.montoSolicitado ?? null,
        data.observacionesRrhh ?? null,
        data.codigoVerificacion ?? null,
      ],
    );
    return this.mapRow(rows[0]!);
  }

  async updateStatus(id: string, estatus: RequestStatus, observacionesRrhh?: string): Promise<EmployeeRequest | null> {
    const { rows } = await this.pool.query<{
      id: string;
      employee_id: string;
      user_id: string | null;
      tipo: EmployeeRequest['tipo'];
      estatus: EmployeeRequest['estatus'];
      motivo: string;
      fecha_desde: Date | null;
      fecha_hasta: Date | null;
      dias_solicitados: number | null;
      monto_solicitado: string | null;
      observaciones_rrhh: string | null;
      codigo_verificacion: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE employee_requests SET
        estatus = $1, observaciones_rrhh = COALESCE($2, observaciones_rrhh), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [estatus, observacionesRrhh ?? null, id],
    );
    if (rows.length === 0) return null;
    return this.mapRow(rows[0]!);
  }

  private mapRow(r: {
    id: string;
    employee_id: string;
    user_id: string | null;
    tipo: EmployeeRequest['tipo'];
    estatus: EmployeeRequest['estatus'];
    motivo: string;
    fecha_desde: Date | null;
    fecha_hasta: Date | null;
    dias_solicitados: number | null;
    monto_solicitado: string | null;
    observaciones_rrhh: string | null;
    codigo_verificacion: string | null;
    created_at: Date;
    updated_at: Date;
  }): EmployeeRequest {
    return {
      id: r.id,
      employeeId: r.employee_id,
      userId: r.user_id ?? undefined,
      tipo: r.tipo,
      estatus: r.estatus,
      motivo: r.motivo,
      fechaDesde: r.fecha_desde ? r.fecha_desde.toISOString().split('T')[0]! : undefined,
      fechaHasta: r.fecha_hasta ? r.fecha_hasta.toISOString().split('T')[0]! : undefined,
      diasSolicitados: r.dias_solicitados ?? undefined,
      montoSolicitado: r.monto_solicitado ?? undefined,
      observacionesRrhh: r.observaciones_rrhh ?? undefined,
      codigoVerificacion: r.codigo_verificacion ?? undefined,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    };
  }
}

export class PgAttendanceRepository implements IAttendanceRepository {
  constructor(private pool: Pool) {}

  async listSheets(filters?: { orgUnitId?: string | undefined; year?: number | undefined; status?: AttendanceSheetStatus | undefined }): Promise<AttendanceSheet[]> {
    let query = 'SELECT * FROM attendance_sheets WHERE 1=1';
    const params: any[] = [];
    if (filters?.orgUnitId) {
      params.push(filters.orgUnitId);
      query += ` AND org_unit_id = $${params.length}`;
    }
    if (filters?.year) {
      params.push(filters.year);
      query += ` AND year = $${params.length}`;
    }
    if (filters?.status) {
      params.push(filters.status);
      query += ` AND status = $${params.length}`;
    }
    query += ' ORDER BY start_date DESC';

    const { rows } = await this.pool.query<{
      id: string;
      org_unit_id: string;
      week_number: number;
      year: number;
      start_date: Date;
      end_date: Date;
      coordinator_id: string | null;
      coordinator_name: string;
      verified_by: string | null;
      status: AttendanceSheetStatus;
      observations: string | null;
      created_at: Date;
      updated_at: Date;
    }>(query, params);

    return rows.map((r) => ({
      id: r.id,
      orgUnitId: r.org_unit_id,
      weekNumber: r.week_number,
      year: r.year,
      startDate: r.start_date.toISOString().split('T')[0]!,
      endDate: r.end_date.toISOString().split('T')[0]!,
      coordinatorId: r.coordinator_id ?? undefined,
      coordinatorName: r.coordinator_name,
      verifiedBy: r.verified_by ?? undefined,
      status: r.status,
      observations: r.observations ?? undefined,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));
  }

  async findSheetById(id: string): Promise<AttendanceSheet | null> {
    const { rows } = await this.pool.query<{
      id: string;
      org_unit_id: string;
      week_number: number;
      year: number;
      start_date: Date;
      end_date: Date;
      coordinator_id: string | null;
      coordinator_name: string;
      verified_by: string | null;
      status: AttendanceSheetStatus;
      observations: string | null;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM attendance_sheets WHERE id = $1 LIMIT 1', [id]);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      orgUnitId: r.org_unit_id,
      weekNumber: r.week_number,
      year: r.year,
      startDate: r.start_date.toISOString().split('T')[0]!,
      endDate: r.end_date.toISOString().split('T')[0]!,
      coordinatorId: r.coordinator_id ?? undefined,
      coordinatorName: r.coordinator_name,
      verifiedBy: r.verified_by ?? undefined,
      status: r.status,
      observations: r.observations ?? undefined,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    };
  }

  async findSheet(orgUnitId: string, weekNumber: number, year: number): Promise<AttendanceSheet | null> {
    const { rows } = await this.pool.query<{
      id: string;
      org_unit_id: string;
      week_number: number;
      year: number;
      start_date: Date;
      end_date: Date;
      coordinator_id: string | null;
      coordinator_name: string;
      verified_by: string | null;
      status: AttendanceSheetStatus;
      observations: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      'SELECT * FROM attendance_sheets WHERE org_unit_id = $1 AND week_number = $2 AND year = $3 LIMIT 1',
      [orgUnitId, weekNumber, year],
    );
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      orgUnitId: r.org_unit_id,
      weekNumber: r.week_number,
      year: r.year,
      startDate: r.start_date.toISOString().split('T')[0]!,
      endDate: r.end_date.toISOString().split('T')[0]!,
      coordinatorId: r.coordinator_id ?? undefined,
      coordinatorName: r.coordinator_name,
      verifiedBy: r.verified_by ?? undefined,
      status: r.status,
      observations: r.observations ?? undefined,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    };
  }

  async createSheet(data: Omit<AttendanceSheet, 'id' | 'createdAt' | 'updatedAt'>): Promise<AttendanceSheet> {
    const { rows } = await this.pool.query<{
      id: string;
      org_unit_id: string;
      week_number: number;
      year: number;
      start_date: Date;
      end_date: Date;
      coordinator_id: string | null;
      coordinator_name: string;
      verified_by: string | null;
      status: AttendanceSheetStatus;
      observations: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO attendance_sheets (
        org_unit_id, week_number, year, start_date, end_date,
        coordinator_id, coordinator_name, verified_by, status, observations,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *`,
      [
        data.orgUnitId,
        data.weekNumber,
        data.year,
        data.startDate,
        data.endDate,
        data.coordinatorId ?? null,
        data.coordinatorName,
        data.verifiedBy ?? null,
        data.status,
        data.observations ?? null,
      ],
    );
    const r = rows[0]!;
    return {
      id: r.id,
      orgUnitId: r.org_unit_id,
      weekNumber: r.week_number,
      year: r.year,
      startDate: r.start_date.toISOString().split('T')[0]!,
      endDate: r.end_date.toISOString().split('T')[0]!,
      coordinatorId: r.coordinator_id ?? undefined,
      coordinatorName: r.coordinator_name,
      verifiedBy: r.verified_by ?? undefined,
      status: r.status,
      observations: r.observations ?? undefined,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    };
  }

  async updateSheet(id: string, data: Partial<Omit<AttendanceSheet, 'id' | 'createdAt' | 'updatedAt'>>): Promise<AttendanceSheet | null> {
    const existing = await this.findSheetById(id);
    if (!existing) return null;

    const { rows } = await this.pool.query<{
      id: string;
      org_unit_id: string;
      week_number: number;
      year: number;
      start_date: Date;
      end_date: Date;
      coordinator_id: string | null;
      coordinator_name: string;
      verified_by: string | null;
      status: AttendanceSheetStatus;
      observations: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE attendance_sheets SET
        coordinator_id = COALESCE($1, coordinator_id),
        coordinator_name = COALESCE($2, coordinator_name),
        verified_by = COALESCE($3, verified_by),
        status = COALESCE($4, status),
        observations = COALESCE($5, observations),
        updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        data.coordinatorId ?? null,
        data.coordinatorName ?? null,
        data.verifiedBy ?? null,
        data.status ?? null,
        data.observations ?? null,
        id,
      ],
    );
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      orgUnitId: r.org_unit_id,
      weekNumber: r.week_number,
      year: r.year,
      startDate: r.start_date.toISOString().split('T')[0]!,
      endDate: r.end_date.toISOString().split('T')[0]!,
      coordinatorId: r.coordinator_id ?? undefined,
      coordinatorName: r.coordinator_name,
      verifiedBy: r.verified_by ?? undefined,
      status: r.status,
      observations: r.observations ?? undefined,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    };
  }

  async listRecordsBySheetId(sheetId: string): Promise<AttendanceRecord[]> {
    const { rows } = await this.pool.query<{
      id: string;
      sheet_id: string;
      employee_id: string;
      date: Date;
      day_of_week: number;
      time_in: string | null;
      time_out: string | null;
      status: AttendanceRecordStatus;
      regular_hours: string;
      overtime_day_hours: string;
      overtime_night_hours: string;
      night_shift_hours: string;
      worker_signed: boolean;
      observations: string | null;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM attendance_records WHERE sheet_id = $1 ORDER BY date ASC, employee_id ASC', [sheetId]);

    return rows.map((r) => ({
      id: r.id,
      sheetId: r.sheet_id,
      employeeId: r.employee_id,
      date: r.date.toISOString().split('T')[0]!,
      dayOfWeek: r.day_of_week,
      timeIn: r.time_in ?? undefined,
      timeOut: r.time_out ?? undefined,
      status: r.status,
      regularHours: Number.parseFloat(r.regular_hours),
      overtimeDayHours: Number.parseFloat(r.overtime_day_hours),
      overtimeNightHours: Number.parseFloat(r.overtime_night_hours),
      nightShiftHours: Number.parseFloat(r.night_shift_hours),
      workerSigned: r.worker_signed,
      observations: r.observations ?? undefined,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));
  }

  async saveRecords(records: Omit<AttendanceRecord, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<AttendanceRecord[]> {
    const result: AttendanceRecord[] = [];
    for (const r of records) {
      const { rows } = await this.pool.query<{
        id: string;
        sheet_id: string;
        employee_id: string;
        date: Date;
        day_of_week: number;
        time_in: string | null;
        time_out: string | null;
        status: AttendanceRecordStatus;
        regular_hours: string;
        overtime_day_hours: string;
        overtime_night_hours: string;
        night_shift_hours: string;
        worker_signed: boolean;
        observations: string | null;
        created_at: Date;
        updated_at: Date;
      }>(
        `INSERT INTO attendance_records (
          sheet_id, employee_id, date, day_of_week,
          time_in, time_out, status, regular_hours,
          overtime_day_hours, overtime_night_hours, night_shift_hours,
          worker_signed, observations, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
        ON CONFLICT (sheet_id, employee_id, date) DO UPDATE SET
          time_in = EXCLUDED.time_in,
          time_out = EXCLUDED.time_out,
          status = EXCLUDED.status,
          regular_hours = EXCLUDED.regular_hours,
          overtime_day_hours = EXCLUDED.overtime_day_hours,
          overtime_night_hours = EXCLUDED.overtime_night_hours,
          night_shift_hours = EXCLUDED.night_shift_hours,
          worker_signed = EXCLUDED.worker_signed,
          observations = EXCLUDED.observations,
          updated_at = NOW()
        RETURNING *`,
        [
          r.sheetId,
          r.employeeId,
          r.date,
          r.dayOfWeek,
          r.timeIn ?? null,
          r.timeOut ?? null,
          r.status,
          r.regularHours,
          r.overtimeDayHours,
          r.overtimeNightHours,
          r.nightShiftHours,
          r.workerSigned,
          r.observations ?? null,
        ],
      );
      const row = rows[0]!;
      result.push({
        id: row.id,
        sheetId: row.sheet_id,
        employeeId: row.employee_id,
        date: row.date.toISOString().split('T')[0]!,
        dayOfWeek: row.day_of_week,
        timeIn: row.time_in ?? undefined,
        timeOut: row.time_out ?? undefined,
        status: row.status,
        regularHours: Number.parseFloat(row.regular_hours),
        overtimeDayHours: Number.parseFloat(row.overtime_day_hours),
        overtimeNightHours: Number.parseFloat(row.overtime_night_hours),
        nightShiftHours: Number.parseFloat(row.night_shift_hours),
        workerSigned: row.worker_signed,
        observations: row.observations ?? undefined,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      });
    }
    return result;
  }
}

export function createPgRepositories(pool: Pool): Repositories {
  return {
    settings: new PgSettingsRepository(pool),
    users: new PgUserRepository(pool),
    sessions: new PgSessionRepository(pool),
    territories: new PgTerritoryRepository(pool),
    orgUnits: new PgOrgUnitRepository(pool),
    positions: new PgPositionRepository(pool),
    employees: new PgEmployeeRepository(pool),
    contracts: new PgContractRepository(pool),
    dependents: new PgFamilyDependentRepository(pool),
    movements: new PgContractMovementRepository(pool),
    requests: new PgEmployeeRequestRepository(pool),
    attendance: new PgAttendanceRepository(pool),
    payroll: new MemoryPayrollRepository(),
    credentials: new MemoryDigitalCredentialRepository(),
    holidays: new MemoryHolidayRepository(),
    bankPayments: new MemoryBankPaymentRepository(),
    assets: new MemoryAssignedAssetRepository(),
    sst: new MemorySstRepository(),
    jobPostings: new MemoryJobPostingRepository(),
    jobApplications: new MemoryJobApplicationRepository(),
    training: new MemoryTrainingRepository(),
    performance: new MemoryPerformanceRepository(),
  };
}

