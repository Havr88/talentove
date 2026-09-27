import { randomUUID } from 'node:crypto';
import type {
  AttendanceRecord,
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

export class MemorySettingsRepository implements ISettingsRepository {
  private settings: CompanySettings | null = null;

  async getSettings(): Promise<CompanySettings | null> {
    return this.settings ? { ...this.settings } : null;
  }

  async saveSettings(data: Omit<CompanySettings, 'id' | 'updatedAt'>): Promise<CompanySettings> {
    const updated: CompanySettings = {
      ...data,
      id: 1,
      updatedAt: new Date().toISOString(),
    };
    this.settings = updated;
    return { ...updated };
  }
}

export class MemoryUserRepository implements IUserRepository {
  private users = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    const u = this.users.get(id);
    return u ? { ...u } : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase().trim();
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === normalized) {
        return { ...u };
      }
    }
    return null;
  }

  async create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const created: User = {
      ...user,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, created);
    return { ...created };
  }

  async count(): Promise<number> {
    return this.users.size;
  }
}

export class MemorySessionRepository implements ISessionRepository {
  private sessions = new Map<string, Session>();

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    for (const s of this.sessions.values()) {
      if (s.tokenHash === tokenHash) {
        return { ...s };
      }
    }
    return null;
  }

  async create(session: Omit<Session, 'id' | 'createdAt'>): Promise<Session> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const created: Session = {
      ...session,
      id,
      createdAt: now,
    };
    this.sessions.set(id, created);
    return { ...created };
  }

  async touch(id: string, lastActiveAt: string): Promise<void> {
    const s = this.sessions.get(id);
    if (s) {
      this.sessions.set(id, { ...s, lastActiveAt });
    }
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    for (const [id, s] of this.sessions.entries()) {
      if (s.tokenHash === tokenHash) {
        this.sessions.delete(id);
        break;
      }
    }
  }

  async deleteExpired(nowIso: string): Promise<number> {
    const now = new Date(nowIso).getTime();
    let count = 0;
    for (const [id, s] of this.sessions.entries()) {
      if (new Date(s.expiresAt).getTime() <= now) {
        this.sessions.delete(id);
        count++;
      }
    }
    return count;
  }
}

export class MemoryTerritoryRepository implements ITerritoryRepository {
  private territories: Territory[] = [
    { id: 1, codigo: 'VE-A', nombre: 'Distrito Capital', capital: 'Caracas' },
    { id: 2, codigo: 'VE-B', nombre: 'Anzoátegui', capital: 'Barcelona' },
    { id: 3, codigo: 'VE-C', nombre: 'Apure', capital: 'San Fernando de Apure' },
    { id: 4, codigo: 'VE-D', nombre: 'Aragua', capital: 'Maracay' },
    { id: 5, codigo: 'VE-E', nombre: 'Barinas', capital: 'Barinas' },
    { id: 6, codigo: 'VE-F', nombre: 'Bolívar', capital: 'Ciudad Bolívar' },
    { id: 7, codigo: 'VE-G', nombre: 'Carabobo', capital: 'Valencia' },
    { id: 8, codigo: 'VE-H', nombre: 'Cojedes', capital: 'San Carlos' },
    { id: 9, codigo: 'VE-I', nombre: 'Delta Amacuro', capital: 'Tucupita' },
    { id: 10, codigo: 'VE-J', nombre: 'Falcón', capital: 'Coro' },
    { id: 11, codigo: 'VE-K', nombre: 'Guárico', capital: 'San Juan de los Morros' },
    { id: 12, codigo: 'VE-L', nombre: 'Lara', capital: 'Barquisimeto' },
    { id: 13, codigo: 'VE-M', nombre: 'Mérida', capital: 'Mérida' },
    { id: 14, codigo: 'VE-N', nombre: 'Miranda', capital: 'Los Teques' },
    { id: 15, codigo: 'VE-O', nombre: 'Monagas', capital: 'Maturín' },
    { id: 16, codigo: 'VE-P', nombre: 'Nueva Esparta', capital: 'La Asunción' },
    { id: 17, codigo: 'VE-R', nombre: 'Portuguesa', capital: 'Guanare' },
    { id: 18, codigo: 'VE-S', nombre: 'Sucre', capital: 'Cumaná' },
    { id: 19, codigo: 'VE-T', nombre: 'Táchira', capital: 'San Cristóbal' },
    { id: 20, codigo: 'VE-U', nombre: 'Trujillo', capital: 'Trujillo' },
    { id: 21, codigo: 'VE-V', nombre: 'La Guaira', capital: 'La Guaira' },
    { id: 22, codigo: 'VE-W', nombre: 'Yaracuy', capital: 'San Felipe' },
    { id: 23, codigo: 'VE-X', nombre: 'Zulia', capital: 'Maracaibo' },
    { id: 24, codigo: 'VE-Z', nombre: 'Amazonas', capital: 'Puerto Ayacucho' },
  ];

  async list(): Promise<Territory[]> {
    return [...this.territories];
  }

  async findById(id: number): Promise<Territory | null> {
    const t = this.territories.find((item) => item.id === id);
    return t ? { ...t } : null;
  }

  async findByCodigo(codigo: string): Promise<Territory | null> {
    const norm = codigo.toUpperCase().trim();
    const t = this.territories.find((item) => item.codigo === norm);
    return t ? { ...t } : null;
  }
}

export class MemoryOrgUnitRepository implements IOrgUnitRepository {
  private units = new Map<string, OrgUnit>();

  async list(): Promise<OrgUnit[]> {
    return Array.from(this.units.values());
  }

  async create(data: Omit<OrgUnit, 'id' | 'createdAt'>): Promise<OrgUnit> {
    const id = randomUUID();
    const created: OrgUnit = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
    };
    this.units.set(id, created);
    return { ...created };
  }

  async findById(id: string): Promise<OrgUnit | null> {
    const u = this.units.get(id);
    return u ? { ...u } : null;
  }
}

export class MemoryPositionRepository implements IPositionRepository {
  private positions = new Map<number, Position>();
  private nextId = 1;

  async list(): Promise<Position[]> {
    return Array.from(this.positions.values());
  }

  async create(data: Omit<Position, 'id'>): Promise<Position> {
    const id = this.nextId++;
    const created: Position = {
      ...data,
      id,
    };
    this.positions.set(id, created);
    return { ...created };
  }

  async findByName(name: string): Promise<Position | null> {
    const norm = name.toLowerCase().trim();
    for (const p of this.positions.values()) {
      if (p.name.toLowerCase() === norm) {
        return { ...p };
      }
    }
    return null;
  }
}

export class MemoryEmployeeRepository implements IEmployeeRepository {
  private employees = new Map<string, Employee>();

  async list(): Promise<Employee[]> {
    return Array.from(this.employees.values());
  }

  async findById(id: string): Promise<Employee | null> {
    const e = this.employees.get(id);
    return e ? { ...e } : null;
  }

  async findByNativeId(nativeId: string): Promise<Employee | null> {
    const norm = nativeId.toUpperCase().trim();
    for (const e of this.employees.values()) {
      if (e.nativeId === norm) {
        return { ...e };
      }
    }
    return null;
  }

  async create(data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<Employee> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const created: Employee = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.employees.set(id, created);
    return { ...created };
  }

  async update(id: string, data: Partial<Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Employee | null> {
    const existing = this.employees.get(id);
    if (!existing) return null;
    const updated: Employee = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.employees.set(id, updated);
    return { ...updated };
  }

  async count(): Promise<number> {
    return this.employees.size;
  }
}

export class MemoryContractRepository implements IContractRepository {
  private contracts = new Map<string, Contract>();

  async findActiveByEmployeeId(employeeId: string): Promise<Contract | null> {
    for (const c of this.contracts.values()) {
      if (c.employeeId === employeeId && c.activo) {
        return { ...c };
      }
    }
    return null;
  }

  async findByEmployeeId(employeeId: string): Promise<Contract[]> {
    return Array.from(this.contracts.values()).filter((c) => c.employeeId === employeeId);
  }

  async create(data: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contract> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const created: Contract = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.contracts.set(id, created);
    return { ...created };
  }

  async update(id: string, data: Partial<Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Contract | null> {
    const existing = this.contracts.get(id);
    if (!existing) return null;
    const updated: Contract = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.contracts.set(id, updated);
    return { ...updated };
  }
}

export class MemoryFamilyDependentRepository implements IFamilyDependentRepository {
  private dependents = new Map<string, FamilyDependent>();

  async listByEmployeeId(employeeId: string): Promise<FamilyDependent[]> {
    return Array.from(this.dependents.values()).filter((d) => d.employeeId === employeeId);
  }

  async create(data: Omit<FamilyDependent, 'id' | 'createdAt'>): Promise<FamilyDependent> {
    const id = randomUUID();
    const created: FamilyDependent = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
    };
    this.dependents.set(id, created);
    return { ...created };
  }

  async delete(id: string): Promise<boolean> {
    return this.dependents.delete(id);
  }
}

export class MemoryContractMovementRepository implements IContractMovementRepository {
  private movements: ContractMovement[] = [];

  async listByEmployeeId(employeeId: string): Promise<ContractMovement[]> {
    return this.movements
      .filter((m) => m.employeeId === employeeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async create(data: Omit<ContractMovement, 'id' | 'createdAt'>): Promise<ContractMovement> {
    const created: ContractMovement = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.movements.push(created);
    return { ...created };
  }
}

export class MemoryEmployeeRequestRepository implements IEmployeeRequestRepository {
  private requests = new Map<string, EmployeeRequest>();

  async list(): Promise<EmployeeRequest[]> {
    return Array.from(this.requests.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listByEmployeeId(employeeId: string): Promise<EmployeeRequest[]> {
    return Array.from(this.requests.values())
      .filter((r) => r.employeeId === employeeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(id: string): Promise<EmployeeRequest | null> {
    const r = this.requests.get(id);
    return r ? { ...r } : null;
  }

  async findByCodigoVerificacion(codigo: string): Promise<EmployeeRequest | null> {
    const norm = codigo.trim();
    for (const r of this.requests.values()) {
      if (r.codigoVerificacion === norm) {
        return { ...r };
      }
    }
    return null;
  }

  async create(data: Omit<EmployeeRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmployeeRequest> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const created: EmployeeRequest = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.requests.set(id, created);
    return { ...created };
  }

  async updateStatus(id: string, estatus: RequestStatus, observacionesRrhh?: string): Promise<EmployeeRequest | null> {
    const existing = this.requests.get(id);
    if (!existing) return null;
    const updated: EmployeeRequest = {
      ...existing,
      estatus,
      ...(observacionesRrhh !== undefined ? { observacionesRrhh } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.requests.set(id, updated);
    return { ...updated };
  }
}

export class MemoryAttendanceRepository implements IAttendanceRepository {
  private sheets = new Map<string, AttendanceSheet>();
  private records = new Map<string, AttendanceRecord>();

  async listSheets(filters?: { orgUnitId?: string | undefined; year?: number | undefined; status?: AttendanceSheetStatus | undefined }): Promise<AttendanceSheet[]> {
    let list = Array.from(this.sheets.values());
    if (filters?.orgUnitId) {
      list = list.filter((s) => s.orgUnitId === filters.orgUnitId);
    }
    if (filters?.year) {
      list = list.filter((s) => s.year === filters.year);
    }
    if (filters?.status) {
      list = list.filter((s) => s.status === filters.status);
    }
    return list.sort((a, b) => b.startDate.localeCompare(a.startDate));
  }

  async findSheetById(id: string): Promise<AttendanceSheet | null> {
    const s = this.sheets.get(id);
    return s ? { ...s } : null;
  }

  async findSheet(orgUnitId: string, weekNumber: number, year: number): Promise<AttendanceSheet | null> {
    for (const s of this.sheets.values()) {
      if (s.orgUnitId === orgUnitId && s.weekNumber === weekNumber && s.year === year) {
        return { ...s };
      }
    }
    return null;
  }

  async createSheet(data: Omit<AttendanceSheet, 'id' | 'createdAt' | 'updatedAt'>): Promise<AttendanceSheet> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const created: AttendanceSheet = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.sheets.set(id, created);
    return { ...created };
  }

  async updateSheet(id: string, data: Partial<Omit<AttendanceSheet, 'id' | 'createdAt' | 'updatedAt'>>): Promise<AttendanceSheet | null> {
    const existing = this.sheets.get(id);
    if (!existing) return null;
    const updated: AttendanceSheet = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.sheets.set(id, updated);
    return { ...updated };
  }

  async listRecordsBySheetId(sheetId: string): Promise<AttendanceRecord[]> {
    return Array.from(this.records.values())
      .filter((r) => r.sheetId === sheetId)
      .sort((a, b) => a.date.localeCompare(b.date) || a.employeeId.localeCompare(b.employeeId));
  }

  async saveRecords(records: Omit<AttendanceRecord, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<AttendanceRecord[]> {
    const saved: AttendanceRecord[] = [];
    const now = new Date().toISOString();

    for (const r of records) {
      // Buscar si ya existe por sheetId, employeeId y date
      let existingId: string | null = null;
      for (const [key, item] of this.records.entries()) {
        if (item.sheetId === r.sheetId && item.employeeId === r.employeeId && item.date === r.date) {
          existingId = key;
          break;
        }
      }

      const id = existingId ?? randomUUID();
      const recordItem: AttendanceRecord = {
        ...r,
        id,
        createdAt: existingId ? (this.records.get(existingId)?.createdAt ?? now) : now,
        updatedAt: now,
      };
      this.records.set(id, recordItem);
      saved.push({ ...recordItem });
    }

    return saved;
  }
}

export function createMemoryRepositories(): Repositories {
  return {
    settings: new MemorySettingsRepository(),
    users: new MemoryUserRepository(),
    sessions: new MemorySessionRepository(),
    territories: new MemoryTerritoryRepository(),
    orgUnits: new MemoryOrgUnitRepository(),
    positions: new MemoryPositionRepository(),
    employees: new MemoryEmployeeRepository(),
    contracts: new MemoryContractRepository(),
    dependents: new MemoryFamilyDependentRepository(),
    movements: new MemoryContractMovementRepository(),
    requests: new MemoryEmployeeRequestRepository(),
    attendance: new MemoryAttendanceRepository(),
  };
}
