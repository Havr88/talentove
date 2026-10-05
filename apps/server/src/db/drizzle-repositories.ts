import { randomUUID } from 'node:crypto';
import type { Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq, and, sql, desc, asc } from 'drizzle-orm';
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
  MovementType,
  OrgUnit,
  Position,
  Repositories,
  RequestStatus,
  Session,
  Territory,
  User,
  PayrollBatch,
  PayrollReceiptRecord,
  IPayrollRepository,
  DigitalCredential,
  IDigitalCredentialRepository,
  HolidayRecord,
  IHolidayRepository,
  BankPaymentFileRecord,
  IBankPaymentRepository,
  AssignedAssetRecord,
  IAssignedAssetRepository,
  SstRiskNotificationRecord,
  ISstRepository,
} from './types.js';
import * as schema from './schema.js';
import { MemorySstRepository, MemoryJobPostingRepository, MemoryJobApplicationRepository, MemoryTrainingRepository, MemoryPerformanceRepository } from './memory-repositories.js';

export class DrizzleSettingsRepository implements ISettingsRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async getSettings(): Promise<CompanySettings | null> {
    const rows = await this.db.select().from(schema.settingsTable).where(eq(schema.settingsTable.id, 1)).limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      companyName: r.companyName,
      nativeId: r.nativeId,
      instanceName: r.instanceName,
      primaryColor: r.primaryColor,
      accentColor: r.accentColor,
      isConfigured: r.isConfigured,
      updatedAt: r.updatedAt,
    };
  }

  async saveSettings(settings: Omit<CompanySettings, 'id' | 'updatedAt'>): Promise<CompanySettings> {
    const now = new Date().toISOString();
    await this.db
      .insert(schema.settingsTable)
      .values({
        id: 1,
        companyName: settings.companyName,
        nativeId: settings.nativeId,
        instanceName: settings.instanceName,
        primaryColor: settings.primaryColor,
        accentColor: settings.accentColor,
        isConfigured: settings.isConfigured,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.settingsTable.id,
        set: {
          companyName: settings.companyName,
          nativeId: settings.nativeId,
          instanceName: settings.instanceName,
          primaryColor: settings.primaryColor,
          accentColor: settings.accentColor,
          isConfigured: settings.isConfigured,
          updatedAt: now,
        },
      });

    return {
      id: 1,
      ...settings,
      updatedAt: now,
    };
  }
}

export class DrizzleUserRepository implements IUserRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async count(): Promise<number> {
    const rows = await this.db.select({ count: sql<number>`count(*)` }).from(schema.usersTable);
    return rows[0]?.count ?? 0;
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(schema.usersTable)
      .where(eq(schema.usersTable.email, email.toLowerCase().trim()))
      .limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      email: r.email,
      passwordHash: r.passwordHash,
      fullName: r.fullName,
      role: r.role as any,
      status: r.status as any,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async findById(id: string): Promise<User | null> {
    const rows = await this.db.select().from(schema.usersTable).where(eq(schema.usersTable.id, id)).limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      email: r.email,
      passwordHash: r.passwordHash,
      fullName: r.fullName,
      role: r.role as any,
      status: r.status as any,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.db.insert(schema.usersTable).values({
      id,
      email: user.email.toLowerCase().trim(),
      passwordHash: user.passwordHash,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      createdAt: now,
      updatedAt: now,
    });

    return {
      ...user,
      id,
      email: user.email.toLowerCase().trim(),
      createdAt: now,
      updatedAt: now,
    };
  }
}

export class DrizzleSessionRepository implements ISessionRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async create(session: Omit<Session, 'id' | 'createdAt'>): Promise<Session> {
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.db.insert(schema.sessionsTable).values({
      id,
      userId: session.userId,
      tokenHash: session.tokenHash,
      lastActiveAt: session.lastActiveAt,
      expiresAt: session.expiresAt,
      createdAt: now,
    });
    return {
      ...session,
      id,
      createdAt: now,
    };
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const rows = await this.db
      .select()
      .from(schema.sessionsTable)
      .where(eq(schema.sessionsTable.tokenHash, tokenHash))
      .limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      userId: r.userId,
      tokenHash: r.tokenHash,
      lastActiveAt: r.lastActiveAt,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    };
  }

  async touch(tokenHash: string, lastActiveAt: string): Promise<void> {
    await this.db
      .update(schema.sessionsTable)
      .set({ lastActiveAt })
      .where(eq(schema.sessionsTable.tokenHash, tokenHash));
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.db.delete(schema.sessionsTable).where(eq(schema.sessionsTable.tokenHash, tokenHash));
  }

  async deleteExpired(nowIso: string): Promise<number> {
    const result = await this.db
      .delete(schema.sessionsTable)
      .where(sql`${schema.sessionsTable.expiresAt} < ${nowIso}`);
    return result.rowsAffected;
  }
}

export class DrizzleTerritoryRepository implements ITerritoryRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async list(): Promise<Territory[]> {
    const rows = await this.db.select().from(schema.territoriesTable).orderBy(asc(schema.territoriesTable.nombre));
    return rows.map((r) => ({
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      capital: r.capital,
    }));
  }

  async findById(id: number): Promise<Territory | null> {
    const rows = await this.db.select().from(schema.territoriesTable).where(eq(schema.territoriesTable.id, id)).limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      capital: r.capital,
    };
  }

  async findByCodigo(codigo: string): Promise<Territory | null> {
    const rows = await this.db.select().from(schema.territoriesTable).where(eq(schema.territoriesTable.codigo, codigo)).limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      capital: r.capital,
    };
  }
}

export class DrizzleOrgUnitRepository implements IOrgUnitRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async list(): Promise<OrgUnit[]> {
    const rows = await this.db.select().from(schema.orgUnitsTable).orderBy(asc(schema.orgUnitsTable.name));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      typeId: r.typeId,
      parentId: r.parentId ?? undefined,
      createdAt: r.createdAt,
    }));
  }

  async create(data: Omit<OrgUnit, 'id' | 'createdAt'>): Promise<OrgUnit> {
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.db.insert(schema.orgUnitsTable).values({
      id,
      name: data.name,
      typeId: data.typeId,
      parentId: data.parentId ?? null,
      createdAt: now,
    });
    return {
      ...data,
      id,
      createdAt: now,
    };
  }

  async findById(id: string): Promise<OrgUnit | null> {
    const rows = await this.db.select().from(schema.orgUnitsTable).where(eq(schema.orgUnitsTable.id, id)).limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      name: r.name,
      typeId: r.typeId,
      parentId: r.parentId ?? undefined,
      createdAt: r.createdAt,
    };
  }
}

export class DrizzlePositionRepository implements IPositionRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async list(): Promise<Position[]> {
    const rows = await this.db.select().from(schema.positionsTable).orderBy(asc(schema.positionsTable.name));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      categoria: r.categoria,
      grupoIsco: r.grupoIsco,
      aplicaSector: r.aplicaSector as any,
      activo: r.activo,
    }));
  }

  async create(data: Omit<Position, 'id'>): Promise<Position> {
    const now = new Date().toISOString();
    const result = await this.db.insert(schema.positionsTable).values({
      name: data.name,
      categoria: data.categoria,
      grupoIsco: data.grupoIsco,
      aplicaSector: data.aplicaSector,
      activo: data.activo,
      createdAt: now,
    });
    const id = Number(result.lastInsertRowid);
    return {
      ...data,
      id,
    };
  }

  async findById(id: number): Promise<Position | null> {
    const rows = await this.db.select().from(schema.positionsTable).where(eq(schema.positionsTable.id, id)).limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      name: r.name,
      categoria: r.categoria,
      grupoIsco: r.grupoIsco,
      aplicaSector: r.aplicaSector as any,
      activo: r.activo,
    };
  }

  async findByName(name: string): Promise<Position | null> {
    const rows = await this.db.select().from(schema.positionsTable).where(eq(schema.positionsTable.name, name)).limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      name: r.name,
      categoria: r.categoria,
      grupoIsco: r.grupoIsco,
      aplicaSector: r.aplicaSector as any,
      activo: r.activo,
    };
  }
}

export class DrizzleEmployeeRepository implements IEmployeeRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async list(): Promise<Employee[]> {
    const rows = await this.db.select().from(schema.employeesTable).orderBy(desc(schema.employeesTable.createdAt));
    return rows.map((r) => ({
      id: r.id,
      cedulaTipo: r.cedulaTipo as any,
      cedulaNumero: r.cedulaNumero,
      nativeId: r.nativeId,
      rif: r.rif ?? undefined,
      nombres: r.nombres,
      apellidos: r.apellidos,
      fechaNacimiento: r.fechaNacimiento,
      sexo: r.sexo as any,
      estadoCivil: r.estadoCivil as any,
      correo: r.correo ?? undefined,
      telefono: r.telefono ?? undefined,
      direccion: r.direccion,
      territoryId: r.territoryId ?? undefined,
      status: r.status as any,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async findById(id: string): Promise<Employee | null> {
    const rows = await this.db.select().from(schema.employeesTable).where(eq(schema.employeesTable.id, id)).limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      cedulaTipo: r.cedulaTipo as any,
      cedulaNumero: r.cedulaNumero,
      nativeId: r.nativeId,
      rif: r.rif ?? undefined,
      nombres: r.nombres,
      apellidos: r.apellidos,
      fechaNacimiento: r.fechaNacimiento,
      sexo: r.sexo as any,
      estadoCivil: r.estadoCivil as any,
      correo: r.correo ?? undefined,
      telefono: r.telefono ?? undefined,
      direccion: r.direccion,
      territoryId: r.territoryId ?? undefined,
      status: r.status as any,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async findByNativeId(nativeId: string): Promise<Employee | null> {
    const rows = await this.db
      .select()
      .from(schema.employeesTable)
      .where(eq(schema.employeesTable.nativeId, nativeId))
      .limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      cedulaTipo: r.cedulaTipo as any,
      cedulaNumero: r.cedulaNumero,
      nativeId: r.nativeId,
      rif: r.rif ?? undefined,
      nombres: r.nombres,
      apellidos: r.apellidos,
      fechaNacimiento: r.fechaNacimiento,
      sexo: r.sexo as any,
      estadoCivil: r.estadoCivil as any,
      correo: r.correo ?? undefined,
      telefono: r.telefono ?? undefined,
      direccion: r.direccion,
      territoryId: r.territoryId ?? undefined,
      status: r.status as any,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async create(data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<Employee> {
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.db.insert(schema.employeesTable).values({
      id,
      cedulaTipo: data.cedulaTipo,
      cedulaNumero: data.cedulaNumero,
      nativeId: data.nativeId,
      rif: data.rif ?? null,
      nombres: data.nombres,
      apellidos: data.apellidos,
      fechaNacimiento: data.fechaNacimiento,
      sexo: data.sexo,
      estadoCivil: data.estadoCivil,
      correo: data.correo ?? null,
      telefono: data.telefono ?? null,
      direccion: data.direccion,
      territoryId: data.territoryId ?? null,
      status: data.status,
      createdAt: now,
      updatedAt: now,
    });

    return {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
  }

  async update(
    id: string,
    data: Partial<Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Employee | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    await this.db
      .update(schema.employeesTable)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(schema.employeesTable.id, id));

    return this.findById(id);
  }

  async count(): Promise<number> {
    const rows = await this.db.select({ count: sql<number>`count(*)` }).from(schema.employeesTable);
    return rows[0]?.count ?? 0;
  }
}

export class DrizzleContractRepository implements IContractRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async findActiveByEmployeeId(employeeId: string): Promise<Contract | null> {
    const rows = await this.db
      .select()
      .from(schema.contractsTable)
      .where(and(eq(schema.contractsTable.employeeId, employeeId), eq(schema.contractsTable.activo, true)))
      .limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      employeeId: r.employeeId,
      locationId: r.locationId ?? undefined,
      orgUnitId: r.orgUnitId ?? undefined,
      positionId: r.positionId ?? undefined,
      personnelTypeId: r.personnelTypeId ?? undefined,
      tipo: r.tipo as any,
      sector: r.sector as any,
      fechaIngreso: r.fechaIngreso,
      fechaFin: r.fechaFin ?? undefined,
      salarioBase: r.salarioBase,
      currency: r.currency as any,
      jornadaHoras: r.jornadaHoras,
      activo: r.activo,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async findByEmployeeId(employeeId: string): Promise<Contract[]> {
    const rows = await this.db
      .select()
      .from(schema.contractsTable)
      .where(eq(schema.contractsTable.employeeId, employeeId))
      .orderBy(desc(schema.contractsTable.fechaIngreso));

    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      locationId: r.locationId ?? undefined,
      orgUnitId: r.orgUnitId ?? undefined,
      positionId: r.positionId ?? undefined,
      personnelTypeId: r.personnelTypeId ?? undefined,
      tipo: r.tipo as any,
      sector: r.sector as any,
      fechaIngreso: r.fechaIngreso,
      fechaFin: r.fechaFin ?? undefined,
      salarioBase: r.salarioBase,
      currency: r.currency as any,
      jornadaHoras: r.jornadaHoras,
      activo: r.activo,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async create(data: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contract> {
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.db.insert(schema.contractsTable).values({
      id,
      employeeId: data.employeeId,
      locationId: data.locationId ?? null,
      orgUnitId: data.orgUnitId ?? null,
      positionId: data.positionId ?? null,
      personnelTypeId: data.personnelTypeId ?? null,
      tipo: data.tipo,
      sector: data.sector,
      fechaIngreso: data.fechaIngreso,
      fechaFin: data.fechaFin ?? null,
      salarioBase: data.salarioBase,
      currency: data.currency,
      jornadaHoras: data.jornadaHoras,
      activo: data.activo,
      createdAt: now,
      updatedAt: now,
    });
    return {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
  }

  async update(
    id: string,
    data: Partial<Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Contract | null> {
    const now = new Date().toISOString();
    await this.db
      .update(schema.contractsTable)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(schema.contractsTable.id, id));

    const rows = await this.db.select().from(schema.contractsTable).where(eq(schema.contractsTable.id, id)).limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      employeeId: r.employeeId,
      locationId: r.locationId ?? undefined,
      orgUnitId: r.orgUnitId ?? undefined,
      positionId: r.positionId ?? undefined,
      personnelTypeId: r.personnelTypeId ?? undefined,
      tipo: r.tipo as any,
      sector: r.sector as any,
      fechaIngreso: r.fechaIngreso,
      fechaFin: r.fechaFin ?? undefined,
      salarioBase: r.salarioBase,
      currency: r.currency as any,
      jornadaHoras: r.jornadaHoras,
      activo: r.activo,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}

export class DrizzleFamilyDependentRepository implements IFamilyDependentRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async listByEmployeeId(employeeId: string): Promise<FamilyDependent[]> {
    const rows = await this.db
      .select()
      .from(schema.familyDependentsTable)
      .where(eq(schema.familyDependentsTable.employeeId, employeeId))
      .orderBy(asc(schema.familyDependentsTable.fechaNacimiento));

    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      nombres: r.nombres,
      apellidos: r.apellidos,
      parentesco: r.parentesco as any,
      cedula: r.cedula ?? undefined,
      fechaNacimiento: r.fechaNacimiento,
      sexo: r.sexo as any,
      gradoInstruccion: r.gradoInstruccion,
      discapacidad: r.discapacidad,
      createdAt: r.createdAt,
    }));
  }

  async create(data: Omit<FamilyDependent, 'id' | 'createdAt'>): Promise<FamilyDependent> {
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.db.insert(schema.familyDependentsTable).values({
      id,
      employeeId: data.employeeId,
      nombres: data.nombres,
      apellidos: data.apellidos,
      parentesco: data.parentesco,
      cedula: data.cedula ?? null,
      fechaNacimiento: data.fechaNacimiento,
      sexo: data.sexo,
      gradoInstruccion: data.gradoInstruccion,
      discapacidad: data.discapacidad,
      createdAt: now,
    });
    return {
      ...data,
      id,
      createdAt: now,
    };
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.db.delete(schema.familyDependentsTable).where(eq(schema.familyDependentsTable.id, id));
    return res.rowsAffected > 0;
  }
}

export class DrizzleContractMovementRepository implements IContractMovementRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async listByEmployeeId(employeeId: string): Promise<ContractMovement[]> {
    const rows = await this.db
      .select()
      .from(schema.contractMovementsTable)
      .where(eq(schema.contractMovementsTable.employeeId, employeeId))
      .orderBy(desc(schema.contractMovementsTable.fechaEfectiva));

    return rows.map((r) => ({
      id: r.id,
      contractId: r.contractId,
      employeeId: r.employeeId,
      tipoMovimiento: r.tipoMovimiento as MovementType,
      fechaEfectiva: r.fechaEfectiva,
      cargoAnterior: r.cargoAnterior ?? undefined,
      cargoNuevo: r.cargoNuevo,
      unidadAnterior: r.unidadAnterior ?? undefined,
      unidadNueva: r.unidadNueva,
      salarioAnterior: r.salarioAnterior ?? undefined,
      salarioNuevo: r.salarioNuevo,
      motivo: r.motivo ?? undefined,
      aprobadoPor: r.aprobadoPor ?? undefined,
      createdAt: r.createdAt,
    }));
  }

  async create(data: Omit<ContractMovement, 'id' | 'createdAt'>): Promise<ContractMovement> {
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.db.insert(schema.contractMovementsTable).values({
      id,
      contractId: data.contractId,
      employeeId: data.employeeId,
      tipoMovimiento: data.tipoMovimiento,
      fechaEfectiva: data.fechaEfectiva,
      cargoAnterior: data.cargoAnterior ?? null,
      cargoNuevo: data.cargoNuevo,
      unidadAnterior: data.unidadAnterior ?? null,
      unidadNueva: data.unidadNueva,
      salarioAnterior: data.salarioAnterior ?? null,
      salarioNuevo: data.salarioNuevo,
      motivo: data.motivo ?? null,
      aprobadoPor: data.aprobadoPor ?? null,
      createdAt: now,
    });
    return {
      ...data,
      id,
      createdAt: now,
    };
  }
}

export class DrizzleEmployeeRequestRepository implements IEmployeeRequestRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async list(): Promise<EmployeeRequest[]> {
    const rows = await this.db.select().from(schema.employeeRequestsTable).orderBy(desc(schema.employeeRequestsTable.createdAt));
    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      tipo: r.tipo as any,
      motivo: r.motivo,
      estatus: r.estatus as RequestStatus,
      fechaDesde: r.fechaDesde ?? undefined,
      fechaHasta: r.fechaHasta ?? undefined,
      diasSolicitados: r.diasSolicitados ?? undefined,
      montoSolicitado: r.montoSolicitado ?? undefined,
      observacionesRrhh: r.observacionesRrhh ?? undefined,
      codigoVerificacion: r.codigoVerificacion ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async listByEmployeeId(employeeId: string): Promise<EmployeeRequest[]> {
    const rows = await this.db
      .select()
      .from(schema.employeeRequestsTable)
      .where(eq(schema.employeeRequestsTable.employeeId, employeeId))
      .orderBy(desc(schema.employeeRequestsTable.createdAt));

    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      tipo: r.tipo as any,
      motivo: r.motivo,
      estatus: r.estatus as RequestStatus,
      fechaDesde: r.fechaDesde ?? undefined,
      fechaHasta: r.fechaHasta ?? undefined,
      diasSolicitados: r.diasSolicitados ?? undefined,
      montoSolicitado: r.montoSolicitado ?? undefined,
      observacionesRrhh: r.observacionesRrhh ?? undefined,
      codigoVerificacion: r.codigoVerificacion ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async findById(id: string): Promise<EmployeeRequest | null> {
    const rows = await this.db.select().from(schema.employeeRequestsTable).where(eq(schema.employeeRequestsTable.id, id)).limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      employeeId: r.employeeId,
      tipo: r.tipo as any,
      motivo: r.motivo,
      estatus: r.estatus as RequestStatus,
      fechaDesde: r.fechaDesde ?? undefined,
      fechaHasta: r.fechaHasta ?? undefined,
      diasSolicitados: r.diasSolicitados ?? undefined,
      montoSolicitado: r.montoSolicitado ?? undefined,
      observacionesRrhh: r.observacionesRrhh ?? undefined,
      codigoVerificacion: r.codigoVerificacion ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async findByCodigoVerificacion(codigo: string): Promise<EmployeeRequest | null> {
    const rows = await this.db
      .select()
      .from(schema.employeeRequestsTable)
      .where(eq(schema.employeeRequestsTable.codigoVerificacion, codigo))
      .limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      employeeId: r.employeeId,
      tipo: r.tipo as any,
      motivo: r.motivo,
      estatus: r.estatus as RequestStatus,
      fechaDesde: r.fechaDesde ?? undefined,
      fechaHasta: r.fechaHasta ?? undefined,
      diasSolicitados: r.diasSolicitados ?? undefined,
      montoSolicitado: r.montoSolicitado ?? undefined,
      observacionesRrhh: r.observacionesRrhh ?? undefined,
      codigoVerificacion: r.codigoVerificacion ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async create(data: Omit<EmployeeRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmployeeRequest> {
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.db.insert(schema.employeeRequestsTable).values({
      id,
      employeeId: data.employeeId,
      tipo: data.tipo,
      motivo: data.motivo,
      estatus: data.estatus,
      fechaDesde: data.fechaDesde ?? null,
      fechaHasta: data.fechaHasta ?? null,
      diasSolicitados: data.diasSolicitados ?? null,
      montoSolicitado: data.montoSolicitado ?? null,
      observacionesRrhh: data.observacionesRrhh ?? null,
      codigoVerificacion: data.codigoVerificacion ?? null,
      createdAt: now,
      updatedAt: now,
    });
    return {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateStatus(
    id: string,
    estatus: RequestStatus,
    observacionesRrhh?: string
  ): Promise<EmployeeRequest | null> {
    const now = new Date().toISOString();
    await this.db
      .update(schema.employeeRequestsTable)
      .set({
        estatus,
        observacionesRrhh: observacionesRrhh ?? null,
        updatedAt: now,
      })
      .where(eq(schema.employeeRequestsTable.id, id));

    return this.findById(id);
  }
}

export class DrizzleAttendanceRepository implements IAttendanceRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async listSheets(filters?: {
    orgUnitId?: string | undefined;
    year?: number | undefined;
    status?: AttendanceSheetStatus | undefined;
  }): Promise<AttendanceSheet[]> {
    let query = this.db.select().from(schema.attendanceSheetsTable);
    const conditions = [];

    if (filters?.orgUnitId) conditions.push(eq(schema.attendanceSheetsTable.orgUnitId, filters.orgUnitId));
    if (filters?.year) conditions.push(eq(schema.attendanceSheetsTable.year, filters.year));
    if (filters?.status) conditions.push(eq(schema.attendanceSheetsTable.status, filters.status));

    const rows = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(schema.attendanceSheetsTable.startDate))
      : await query.orderBy(desc(schema.attendanceSheetsTable.startDate));

    return rows.map((r) => ({
      id: r.id,
      orgUnitId: r.orgUnitId,
      weekNumber: r.weekNumber,
      year: r.year,
      startDate: r.startDate,
      endDate: r.endDate,
      coordinatorId: r.coordinatorId ?? undefined,
      coordinatorName: r.coordinatorName,
      verifiedBy: r.verifiedBy ?? undefined,
      status: r.status as AttendanceSheetStatus,
      observations: r.observations ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async findSheetById(id: string): Promise<AttendanceSheet | null> {
    const rows = await this.db.select().from(schema.attendanceSheetsTable).where(eq(schema.attendanceSheetsTable.id, id)).limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      orgUnitId: r.orgUnitId,
      weekNumber: r.weekNumber,
      year: r.year,
      startDate: r.startDate,
      endDate: r.endDate,
      coordinatorId: r.coordinatorId ?? undefined,
      coordinatorName: r.coordinatorName,
      verifiedBy: r.verifiedBy ?? undefined,
      status: r.status as AttendanceSheetStatus,
      observations: r.observations ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async findSheet(orgUnitId: string, weekNumber: number, year: number): Promise<AttendanceSheet | null> {
    const rows = await this.db
      .select()
      .from(schema.attendanceSheetsTable)
      .where(
        and(
          eq(schema.attendanceSheetsTable.orgUnitId, orgUnitId),
          eq(schema.attendanceSheetsTable.weekNumber, weekNumber),
          eq(schema.attendanceSheetsTable.year, year)
        )
      )
      .limit(1);

    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      orgUnitId: r.orgUnitId,
      weekNumber: r.weekNumber,
      year: r.year,
      startDate: r.startDate,
      endDate: r.endDate,
      coordinatorId: r.coordinatorId ?? undefined,
      coordinatorName: r.coordinatorName,
      verifiedBy: r.verifiedBy ?? undefined,
      status: r.status as AttendanceSheetStatus,
      observations: r.observations ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async createSheet(data: Omit<AttendanceSheet, 'id' | 'createdAt' | 'updatedAt'>): Promise<AttendanceSheet> {
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.db.insert(schema.attendanceSheetsTable).values({
      id,
      orgUnitId: data.orgUnitId,
      weekNumber: data.weekNumber,
      year: data.year,
      startDate: data.startDate,
      endDate: data.endDate,
      coordinatorId: data.coordinatorId ?? null,
      coordinatorName: data.coordinatorName,
      verifiedBy: data.verifiedBy ?? null,
      status: data.status,
      observations: data.observations ?? null,
      createdAt: now,
      updatedAt: now,
    });
    return {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateSheet(
    id: string,
    data: Partial<Omit<AttendanceSheet, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<AttendanceSheet | null> {
    const now = new Date().toISOString();
    await this.db
      .update(schema.attendanceSheetsTable)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(schema.attendanceSheetsTable.id, id));

    return this.findSheetById(id);
  }

  async listRecordsBySheetId(sheetId: string): Promise<AttendanceRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.attendanceRecordsTable)
      .where(eq(schema.attendanceRecordsTable.sheetId, sheetId))
      .orderBy(asc(schema.attendanceRecordsTable.date), asc(schema.attendanceRecordsTable.employeeId));

    return rows.map((r) => ({
      id: r.id,
      sheetId: r.sheetId,
      employeeId: r.employeeId,
      date: r.date,
      dayOfWeek: r.dayOfWeek,
      timeIn: r.timeIn ?? undefined,
      timeOut: r.timeOut ?? undefined,
      status: r.status as AttendanceRecordStatus,
      regularHours: r.regularHours,
      overtimeDayHours: r.overtimeDayHours,
      overtimeNightHours: r.overtimeNightHours,
      nightShiftHours: r.nightShiftHours,
      workerSigned: r.workerSigned,
      observations: r.observations ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async saveRecords(
    records: Omit<AttendanceRecord, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<AttendanceRecord[]> {
    const saved: AttendanceRecord[] = [];
    const now = new Date().toISOString();

    for (const r of records) {
      const id = randomUUID();
      await this.db
        .insert(schema.attendanceRecordsTable)
        .values({
          id,
          sheetId: r.sheetId,
          employeeId: r.employeeId,
          date: r.date,
          dayOfWeek: r.dayOfWeek,
          timeIn: r.timeIn ?? null,
          timeOut: r.timeOut ?? null,
          status: r.status,
          regularHours: r.regularHours,
          overtimeDayHours: r.overtimeDayHours,
          overtimeNightHours: r.overtimeNightHours,
          nightShiftHours: r.nightShiftHours,
          workerSigned: r.workerSigned,
          observations: r.observations ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            schema.attendanceRecordsTable.sheetId,
            schema.attendanceRecordsTable.employeeId,
            schema.attendanceRecordsTable.date,
          ],
          set: {
            timeIn: r.timeIn ?? null,
            timeOut: r.timeOut ?? null,
            status: r.status,
            regularHours: r.regularHours,
            overtimeDayHours: r.overtimeDayHours,
            overtimeNightHours: r.overtimeNightHours,
            nightShiftHours: r.nightShiftHours,
            workerSigned: r.workerSigned,
            observations: r.observations ?? null,
            updatedAt: now,
          },
        });
    }

    if (records.length > 0) {
      return this.listRecordsBySheetId(records[0]!.sheetId);
    }
    return saved;
  }
}

export class DrizzlePayrollRepository implements IPayrollRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async listBatches(): Promise<PayrollBatch[]> {
    const rows = await this.db
      .select()
      .from(schema.payrollsTable)
      .orderBy(desc(schema.payrollsTable.year), desc(schema.payrollsTable.month), desc(schema.payrollsTable.createdAt));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      periodType: r.periodType,
      year: r.year,
      month: r.month,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
      totalEarnings: r.totalEarnings,
      totalDeductions: r.totalDeductions,
      totalNet: r.totalNet,
      exchangeRateBcv: r.exchangeRateBcv,
      processedBy: r.processedBy ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async findBatchById(id: string): Promise<PayrollBatch | null> {
    const rows = await this.db.select().from(schema.payrollsTable).where(eq(schema.payrollsTable.id, id)).limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      title: r.title,
      periodType: r.periodType,
      year: r.year,
      month: r.month,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
      totalEarnings: r.totalEarnings,
      totalDeductions: r.totalDeductions,
      totalNet: r.totalNet,
      exchangeRateBcv: r.exchangeRateBcv,
      processedBy: r.processedBy ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async createBatch(batch: Omit<PayrollBatch, 'id' | 'createdAt' | 'updatedAt'>): Promise<PayrollBatch> {
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.db.insert(schema.payrollsTable).values({
      id,
      title: batch.title,
      periodType: batch.periodType,
      year: batch.year,
      month: batch.month,
      startDate: batch.startDate,
      endDate: batch.endDate,
      status: batch.status,
      totalEarnings: batch.totalEarnings,
      totalDeductions: batch.totalDeductions,
      totalNet: batch.totalNet,
      exchangeRateBcv: batch.exchangeRateBcv,
      processedBy: batch.processedBy ?? null,
      createdAt: now,
      updatedAt: now,
    });
    const created = await this.findBatchById(id);
    return created!;
  }

  async updateBatchStatus(id: string, status: string): Promise<PayrollBatch | null> {
    const now = new Date().toISOString();
    await this.db.update(schema.payrollsTable).set({ status, updatedAt: now }).where(eq(schema.payrollsTable.id, id));
    return this.findBatchById(id);
  }

  async listReceiptsByBatchId(batchId: string): Promise<PayrollReceiptRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.payrollReceiptsTable)
      .where(eq(schema.payrollReceiptsTable.payrollId, batchId));
    return rows.map((r) => ({
      id: r.id,
      payrollId: r.payrollId,
      employeeId: r.employeeId,
      snapshot: r.snapshot,
      baseSalary: r.baseSalary,
      educationPremium: r.educationPremium,
      seniorityPremium: r.seniorityPremium,
      kidsPremium: r.kidsPremium,
      overtimePay: r.overtimePay,
      nightBonusPay: r.nightBonusPay,
      cestaTicket: r.cestaTicket,
      totalEarnings: r.totalEarnings,
      ivssDeduction: r.ivssDeduction,
      faovDeduction: r.faovDeduction,
      spfDeduction: r.spfDeduction,
      absenceDeduction: r.absenceDeduction,
      totalDeductions: r.totalDeductions,
      netPay: r.netPay,
      netPayUsd: r.netPayUsd,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }

  async listReceiptsByEmployeeId(employeeId: string): Promise<PayrollReceiptRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.payrollReceiptsTable)
      .where(eq(schema.payrollReceiptsTable.employeeId, employeeId))
      .orderBy(desc(schema.payrollReceiptsTable.createdAt));
    return rows.map((r) => ({
      id: r.id,
      payrollId: r.payrollId,
      employeeId: r.employeeId,
      snapshot: r.snapshot,
      baseSalary: r.baseSalary,
      educationPremium: r.educationPremium,
      seniorityPremium: r.seniorityPremium,
      kidsPremium: r.kidsPremium,
      overtimePay: r.overtimePay,
      nightBonusPay: r.nightBonusPay,
      cestaTicket: r.cestaTicket,
      totalEarnings: r.totalEarnings,
      ivssDeduction: r.ivssDeduction,
      faovDeduction: r.faovDeduction,
      spfDeduction: r.spfDeduction,
      absenceDeduction: r.absenceDeduction,
      totalDeductions: r.totalDeductions,
      netPay: r.netPay,
      netPayUsd: r.netPayUsd,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }

  async findReceiptById(id: string): Promise<PayrollReceiptRecord | null> {
    const rows = await this.db
      .select()
      .from(schema.payrollReceiptsTable)
      .where(eq(schema.payrollReceiptsTable.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      payrollId: r.payrollId,
      employeeId: r.employeeId,
      snapshot: r.snapshot,
      baseSalary: r.baseSalary,
      educationPremium: r.educationPremium,
      seniorityPremium: r.seniorityPremium,
      kidsPremium: r.kidsPremium,
      overtimePay: r.overtimePay,
      nightBonusPay: r.nightBonusPay,
      cestaTicket: r.cestaTicket,
      totalEarnings: r.totalEarnings,
      ivssDeduction: r.ivssDeduction,
      faovDeduction: r.faovDeduction,
      spfDeduction: r.spfDeduction,
      absenceDeduction: r.absenceDeduction,
      totalDeductions: r.totalDeductions,
      netPay: r.netPay,
      netPayUsd: r.netPayUsd,
      status: r.status,
      createdAt: r.createdAt,
    };
  }

  async saveReceipts(receipts: Omit<PayrollReceiptRecord, 'id' | 'createdAt'>[]): Promise<PayrollReceiptRecord[]> {
    const saved: PayrollReceiptRecord[] = [];
    const now = new Date().toISOString();
    for (const r of receipts) {
      const id = randomUUID();
      await this.db.insert(schema.payrollReceiptsTable).values({
        id,
        payrollId: r.payrollId,
        employeeId: r.employeeId,
        snapshot: r.snapshot,
        baseSalary: r.baseSalary,
        educationPremium: r.educationPremium,
        seniorityPremium: r.seniorityPremium,
        kidsPremium: r.kidsPremium,
        overtimePay: r.overtimePay,
        nightBonusPay: r.nightBonusPay,
        cestaTicket: r.cestaTicket,
        totalEarnings: r.totalEarnings,
        ivssDeduction: r.ivssDeduction,
        faovDeduction: r.faovDeduction,
        spfDeduction: r.spfDeduction,
        absenceDeduction: r.absenceDeduction,
        totalDeductions: r.totalDeductions,
        netPay: r.netPay,
        netPayUsd: r.netPayUsd,
        status: r.status,
        createdAt: now,
      });
      saved.push({
        ...r,
        id,
        createdAt: now,
      });
    }
    return saved;
  }
}

export class DrizzleDigitalCredentialRepository implements IDigitalCredentialRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async findByEmployeeId(employeeId: string): Promise<DigitalCredential | null> {
    const rows = await this.db
      .select()
      .from(schema.digitalCredentialsTable)
      .where(and(eq(schema.digitalCredentialsTable.employeeId, employeeId), eq(schema.digitalCredentialsTable.status, 'activa')))
      .limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      employeeId: r.employeeId,
      verificationToken: r.verificationToken,
      issuedAt: r.issuedAt,
      expiresAt: r.expiresAt,
      bloodType: r.bloodType,
      emergencyContact: r.emergencyContact,
      emergencyPhone: r.emergencyPhone,
      status: r.status as 'activa' | 'revocada' | 'suspendida',
      qrCodeDataUri: r.qrCodeDataUri ?? undefined,
      createdAt: r.createdAt,
    };
  }

  async findByToken(token: string): Promise<DigitalCredential | null> {
    const rows = await this.db
      .select()
      .from(schema.digitalCredentialsTable)
      .where(eq(schema.digitalCredentialsTable.verificationToken, token))
      .limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      employeeId: r.employeeId,
      verificationToken: r.verificationToken,
      issuedAt: r.issuedAt,
      expiresAt: r.expiresAt,
      bloodType: r.bloodType,
      emergencyContact: r.emergencyContact,
      emergencyPhone: r.emergencyPhone,
      status: r.status as 'activa' | 'revocada' | 'suspendida',
      qrCodeDataUri: r.qrCodeDataUri ?? undefined,
      createdAt: r.createdAt,
    };
  }

  async create(data: Omit<DigitalCredential, 'id' | 'createdAt'>): Promise<DigitalCredential> {
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.db.insert(schema.digitalCredentialsTable).values({
      id,
      employeeId: data.employeeId,
      verificationToken: data.verificationToken,
      issuedAt: data.issuedAt,
      expiresAt: data.expiresAt,
      bloodType: data.bloodType,
      emergencyContact: data.emergencyContact,
      emergencyPhone: data.emergencyPhone,
      status: data.status,
      qrCodeDataUri: data.qrCodeDataUri ?? null,
      createdAt: now,
    });
    return {
      ...data,
      id,
      createdAt: now,
    };
  }

  async updateStatus(id: string, status: 'activa' | 'revocada' | 'suspendida'): Promise<DigitalCredential | null> {
    await this.db
      .update(schema.digitalCredentialsTable)
      .set({ status })
      .where(eq(schema.digitalCredentialsTable.id, id));
    const rows = await this.db
      .select()
      .from(schema.digitalCredentialsTable)
      .where(eq(schema.digitalCredentialsTable.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      employeeId: r.employeeId,
      verificationToken: r.verificationToken,
      issuedAt: r.issuedAt,
      expiresAt: r.expiresAt,
      bloodType: r.bloodType,
      emergencyContact: r.emergencyContact,
      emergencyPhone: r.emergencyPhone,
      status: r.status as 'activa' | 'revocada' | 'suspendida',
      qrCodeDataUri: r.qrCodeDataUri ?? undefined,
      createdAt: r.createdAt,
    };
  }
}

export class DrizzleHolidayRepository implements IHolidayRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async list(year?: number): Promise<HolidayRecord[]> {
    const rows = await this.db.select().from(schema.holidaysTable).orderBy(asc(schema.holidaysTable.date));
    const all = rows.map((r) => ({
      id: r.id,
      date: r.date,
      name: r.name,
      type: r.type as 'nacional' | 'decreto' | 'bancario' | 'regional',
      isWorkingDay: Boolean(r.isWorkingDay),
      payRateMultiplier: r.payRateMultiplier,
      description: r.description ?? undefined,
      createdAt: r.createdAt,
    }));
    if (year) {
      return all.filter((h) => h.date.startsWith(String(year)));
    }
    return all;
  }

  async findByDate(date: string): Promise<HolidayRecord | null> {
    const rows = await this.db
      .select()
      .from(schema.holidaysTable)
      .where(eq(schema.holidaysTable.date, date))
      .limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: r.id,
      date: r.date,
      name: r.name,
      type: r.type as 'nacional' | 'decreto' | 'bancario' | 'regional',
      isWorkingDay: Boolean(r.isWorkingDay),
      payRateMultiplier: r.payRateMultiplier,
      description: r.description ?? undefined,
      createdAt: r.createdAt,
    };
  }

  async create(data: Omit<HolidayRecord, 'id' | 'createdAt'>): Promise<HolidayRecord> {
    const now = new Date().toISOString();
    const result = await this.db.insert(schema.holidaysTable).values({
      date: data.date,
      name: data.name,
      type: data.type,
      isWorkingDay: data.isWorkingDay,
      payRateMultiplier: data.payRateMultiplier,
      description: data.description ?? null,
      createdAt: now,
    });
    const id = Number(result.lastInsertRowid ?? 1);
    return {
      ...data,
      id,
      createdAt: now,
    };
  }
}

export class DrizzleBankPaymentRepository implements IBankPaymentRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async listByBatchId(batchId: string): Promise<BankPaymentFileRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.bankPaymentFilesTable)
      .where(eq(schema.bankPaymentFilesTable.payrollBatchId, batchId))
      .orderBy(desc(schema.bankPaymentFilesTable.createdAt));

    return rows.map((r) => ({
      id: r.id,
      payrollBatchId: r.payrollBatchId,
      bankCode: r.bankCode,
      bankName: r.bankName,
      fileName: r.fileName,
      content: r.content,
      totalRecords: r.totalRecords,
      totalAmount: r.totalAmount,
      hash: r.hash,
      createdAt: r.createdAt,
      createdBy: r.createdBy,
    }));
  }

  async findById(id: string): Promise<BankPaymentFileRecord | null> {
    const rows = await this.db
      .select()
      .from(schema.bankPaymentFilesTable)
      .where(eq(schema.bankPaymentFilesTable.id, id))
      .limit(1);

    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      payrollBatchId: r.payrollBatchId,
      bankCode: r.bankCode,
      bankName: r.bankName,
      fileName: r.fileName,
      content: r.content,
      totalRecords: r.totalRecords,
      totalAmount: r.totalAmount,
      hash: r.hash,
      createdAt: r.createdAt,
      createdBy: r.createdBy,
    };
  }

  async save(record: BankPaymentFileRecord): Promise<void> {
    await this.db.insert(schema.bankPaymentFilesTable).values({
      id: record.id,
      payrollBatchId: record.payrollBatchId,
      bankCode: record.bankCode,
      bankName: record.bankName,
      fileName: record.fileName,
      content: record.content,
      totalRecords: record.totalRecords,
      totalAmount: record.totalAmount,
      hash: record.hash,
      createdAt: record.createdAt,
      createdBy: record.createdBy,
    });
  }
}

export class DrizzleAssignedAssetRepository implements IAssignedAssetRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async list(): Promise<AssignedAssetRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.assignedAssetsTable)
      .orderBy(desc(schema.assignedAssetsTable.createdAt));

    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      assetType: r.assetType as any,
      assetCode: r.assetCode,
      description: r.description,
      serialNumber: r.serialNumber ?? undefined,
      assignedDate: r.assignedDate,
      status: r.status as any,
      returnDate: r.returnDate ?? undefined,
      notes: r.notes ?? undefined,
      createdAt: r.createdAt,
    }));
  }

  async listByEmployeeId(employeeId: string): Promise<AssignedAssetRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.assignedAssetsTable)
      .where(eq(schema.assignedAssetsTable.employeeId, employeeId))
      .orderBy(desc(schema.assignedAssetsTable.createdAt));

    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      assetType: r.assetType as any,
      assetCode: r.assetCode,
      description: r.description,
      serialNumber: r.serialNumber ?? undefined,
      assignedDate: r.assignedDate,
      status: r.status as any,
      returnDate: r.returnDate ?? undefined,
      notes: r.notes ?? undefined,
      createdAt: r.createdAt,
    }));
  }

  async findById(id: string): Promise<AssignedAssetRecord | null> {
    const rows = await this.db
      .select()
      .from(schema.assignedAssetsTable)
      .where(eq(schema.assignedAssetsTable.id, id))
      .limit(1);

    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      employeeId: r.employeeId,
      assetType: r.assetType as any,
      assetCode: r.assetCode,
      description: r.description,
      serialNumber: r.serialNumber ?? undefined,
      assignedDate: r.assignedDate,
      status: r.status as any,
      returnDate: r.returnDate ?? undefined,
      notes: r.notes ?? undefined,
      createdAt: r.createdAt,
    };
  }

  async create(asset: Omit<AssignedAssetRecord, 'id' | 'createdAt'>): Promise<AssignedAssetRecord> {
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.db.insert(schema.assignedAssetsTable).values({
      id,
      employeeId: asset.employeeId,
      assetType: asset.assetType,
      assetCode: asset.assetCode,
      description: asset.description,
      serialNumber: asset.serialNumber,
      assignedDate: asset.assignedDate,
      status: asset.status,
      returnDate: asset.returnDate,
      notes: asset.notes,
      createdAt: now,
    });

    return {
      ...asset,
      id,
      createdAt: now,
    };
  }

  async updateStatus(id: string, status: AssignedAssetRecord['status'], returnDate?: string): Promise<AssignedAssetRecord | null> {
    await this.db
      .update(schema.assignedAssetsTable)
      .set({
        status,
        ...(returnDate !== undefined ? { returnDate } : {}),
      })
      .where(eq(schema.assignedAssetsTable.id, id));

    return this.findById(id);
  }
}

export class DrizzleSstRepository implements ISstRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async listByEmployeeId(employeeId: string): Promise<SstRiskNotificationRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.sstRiskNotificationsTable)
      .where(eq(schema.sstRiskNotificationsTable.employeeId, employeeId))
      .orderBy(desc(schema.sstRiskNotificationsTable.createdAt));

    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      positionName: r.positionName,
      workArea: r.workArea,
      riskFactors: JSON.parse(r.riskFactors),
      preventiveMeasures: JSON.parse(r.preventiveMeasures),
      eppRequired: JSON.parse(r.eppRequired),
      isAcknowledged: Boolean(r.isAcknowledged),
      signedAt: r.signedAt ?? undefined,
      createdAt: r.createdAt,
    }));
  }

  async findById(id: string): Promise<SstRiskNotificationRecord | null> {
    const rows = await this.db
      .select()
      .from(schema.sstRiskNotificationsTable)
      .where(eq(schema.sstRiskNotificationsTable.id, id))
      .limit(1);

    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      employeeId: r.employeeId,
      positionName: r.positionName,
      workArea: r.workArea,
      riskFactors: JSON.parse(r.riskFactors),
      preventiveMeasures: JSON.parse(r.preventiveMeasures),
      eppRequired: JSON.parse(r.eppRequired),
      isAcknowledged: Boolean(r.isAcknowledged),
      signedAt: r.signedAt ?? undefined,
      createdAt: r.createdAt,
    };
  }

  async create(data: Omit<SstRiskNotificationRecord, 'id' | 'createdAt'>): Promise<SstRiskNotificationRecord> {
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.db.insert(schema.sstRiskNotificationsTable).values({
      id,
      employeeId: data.employeeId,
      positionName: data.positionName,
      workArea: data.workArea,
      riskFactors: JSON.stringify(data.riskFactors),
      preventiveMeasures: JSON.stringify(data.preventiveMeasures),
      eppRequired: JSON.stringify(data.eppRequired),
      isAcknowledged: data.isAcknowledged,
      signedAt: data.signedAt,
      createdAt: now,
    });

    return {
      ...data,
      id,
      createdAt: now,
    };
  }

  async acknowledge(id: string, signedAt: string): Promise<SstRiskNotificationRecord | null> {
    await this.db
      .update(schema.sstRiskNotificationsTable)
      .set({
        isAcknowledged: true,
        signedAt,
      })
      .where(eq(schema.sstRiskNotificationsTable.id, id));

    return this.findById(id);
  }
}

/**
 * Crea e inicializa la suite completa de repositorios Drizzle para LibSQL / SQLite.
 */
export function createDrizzleRepositories(client: Client): Repositories {
  const db = drizzle(client, { schema });
  return {
    settings: new DrizzleSettingsRepository(db),
    users: new DrizzleUserRepository(db),
    sessions: new DrizzleSessionRepository(db),
    territories: new DrizzleTerritoryRepository(db),
    orgUnits: new DrizzleOrgUnitRepository(db),
    positions: new DrizzlePositionRepository(db),
    employees: new DrizzleEmployeeRepository(db),
    contracts: new DrizzleContractRepository(db),
    dependents: new DrizzleFamilyDependentRepository(db),
    movements: new DrizzleContractMovementRepository(db),
    requests: new DrizzleEmployeeRequestRepository(db),
    attendance: new DrizzleAttendanceRepository(db),
    payroll: new DrizzlePayrollRepository(db),
    credentials: new DrizzleDigitalCredentialRepository(db),
    holidays: new DrizzleHolidayRepository(db),
    bankPayments: new DrizzleBankPaymentRepository(db),
    assets: new DrizzleAssignedAssetRepository(db),
    sst: new DrizzleSstRepository(db),
    jobPostings: new MemoryJobPostingRepository(),
    jobApplications: new MemoryJobApplicationRepository(),
    training: new MemoryTrainingRepository(),
    performance: new MemoryPerformanceRepository(),
  };
}
