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
  JobPostingRecord,
  IJobPostingRepository,
  JobApplicationRecord,
  IJobApplicationRepository,
  TrainingCourseRecord,
  TrainingEnrollmentRecord,
  ITrainingRepository,
  PerformanceEvaluationRecord,
  IPerformanceRepository,
  IBankAccountRepository,
  BankAccount,
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

export class MemoryBankAccountRepository implements IBankAccountRepository {
  private accounts: BankAccount[] = [];
  private nextId = 1;

  async listByEmployeeId(employeeId: string): Promise<BankAccount[]> {
    return this.accounts.filter((a) => a.employeeId === employeeId).map((a) => ({ ...a }));
  }

  async create(data: Omit<BankAccount, 'id' | 'createdAt'>): Promise<BankAccount> {
    const account: BankAccount = {
      ...data,
      id: `bank-${this.nextId++}`,
      createdAt: new Date().toISOString(),
    };
    this.accounts.push(account);
    return { ...account };
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

  async findById(id: number): Promise<Position | null> {
    const p = this.positions.get(id);
    return p ? { ...p } : null;
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

export class MemoryPayrollRepository implements IPayrollRepository {
  private batches = new Map<string, PayrollBatch>();
  private receipts = new Map<string, PayrollReceiptRecord>();

  async listBatches(): Promise<PayrollBatch[]> {
    return Array.from(this.batches.values()).sort(
      (a, b) => b.year - a.year || b.month - a.month || b.createdAt.localeCompare(a.createdAt)
    );
  }

  async findBatchById(id: string): Promise<PayrollBatch | null> {
    const b = this.batches.get(id);
    return b ? { ...b } : null;
  }

  async createBatch(batch: Omit<PayrollBatch, 'id' | 'createdAt' | 'updatedAt'>): Promise<PayrollBatch> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const item: PayrollBatch = {
      ...batch,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.batches.set(id, item);
    return { ...item };
  }

  async updateBatchStatus(id: string, status: string): Promise<PayrollBatch | null> {
    const b = this.batches.get(id);
    if (!b) return null;
    const updated: PayrollBatch = {
      ...b,
      status,
      updatedAt: new Date().toISOString(),
    };
    this.batches.set(id, updated);
    return { ...updated };
  }

  async listReceiptsByBatchId(batchId: string): Promise<PayrollReceiptRecord[]> {
    return Array.from(this.receipts.values())
      .filter((r) => r.payrollId === batchId)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  async listReceiptsByEmployeeId(employeeId: string): Promise<PayrollReceiptRecord[]> {
    return Array.from(this.receipts.values())
      .filter((r) => r.employeeId === employeeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findReceiptById(id: string): Promise<PayrollReceiptRecord | null> {
    const r = this.receipts.get(id);
    return r ? { ...r } : null;
  }

  async saveReceipts(receipts: Omit<PayrollReceiptRecord, 'id' | 'createdAt'>[]): Promise<PayrollReceiptRecord[]> {
    const saved: PayrollReceiptRecord[] = [];
    const now = new Date().toISOString();

    for (const r of receipts) {
      const id = randomUUID();
      const item: PayrollReceiptRecord = {
        ...r,
        id,
        createdAt: now,
      };
      this.receipts.set(id, item);
      saved.push({ ...item });
    }

    return saved;
  }
}

export class MemoryDigitalCredentialRepository implements IDigitalCredentialRepository {
  private credentials = new Map<string, DigitalCredential>();

  async findByEmployeeId(employeeId: string): Promise<DigitalCredential | null> {
    for (const c of this.credentials.values()) {
      if (c.employeeId === employeeId && c.status === 'activa') {
        return { ...c };
      }
    }
    return null;
  }

  async findByToken(token: string): Promise<DigitalCredential | null> {
    for (const c of this.credentials.values()) {
      if (c.verificationToken === token) {
        return { ...c };
      }
    }
    return null;
  }

  async create(data: Omit<DigitalCredential, 'id' | 'createdAt'>): Promise<DigitalCredential> {
    const id = randomUUID();
    const item: DigitalCredential = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
    };
    this.credentials.set(id, item);
    return { ...item };
  }

  async updateStatus(id: string, status: 'activa' | 'revocada' | 'suspendida'): Promise<DigitalCredential | null> {
    const c = this.credentials.get(id);
    if (!c) return null;
    const updated: DigitalCredential = {
      ...c,
      status,
    };
    this.credentials.set(id, updated);
    return { ...updated };
  }
}

export class MemoryHolidayRepository implements IHolidayRepository {
  private holidays = new Map<string, HolidayRecord>();
  private nextId = 1;

  constructor() {
    this.seedDefaultNationalHolidays();
  }

  private seedDefaultNationalHolidays() {
    const currentYear = new Date().getFullYear();
    const defaults = [
      { date: `${currentYear}-01-01`, name: 'Año Nuevo', type: 'nacional' as const },
      { date: `${currentYear}-04-19`, name: 'Declaración de la Independencia (19 de Abril)', type: 'nacional' as const },
      { date: `${currentYear}-05-01`, name: 'Día Internacional del Trabajador', type: 'nacional' as const },
      { date: `${currentYear}-06-24`, name: 'Batalla de Carabobo', type: 'nacional' as const },
      { date: `${currentYear}-07-05`, name: 'Día de la Independencia (5 de Julio)', type: 'nacional' as const },
      { date: `${currentYear}-07-24`, name: 'Natalicio del Libertador Simón Bolívar', type: 'nacional' as const },
      { date: `${currentYear}-10-12`, name: 'Día de la Resistencia Indígena', type: 'nacional' as const },
      { date: `${currentYear}-12-24`, name: 'Víspera de Navidad', type: 'nacional' as const },
      { date: `${currentYear}-12-25`, name: 'Natividad de Nuestro Señor', type: 'nacional' as const },
      { date: `${currentYear}-12-31`, name: 'Fin de Año', type: 'nacional' as const },
    ];

    for (const d of defaults) {
      this.create({
        date: d.date,
        name: d.name,
        type: d.type,
        isWorkingDay: false,
        payRateMultiplier: 1.5,
        description: 'Feriado nacional de ley LOTTT',
      });
    }
  }

  async list(year?: number): Promise<HolidayRecord[]> {
    const all = Array.from(this.holidays.values());
    if (year) {
      return all.filter((h) => h.date.startsWith(String(year))).sort((a, b) => a.date.localeCompare(b.date));
    }
    return all.sort((a, b) => a.date.localeCompare(b.date));
  }

  async findByDate(date: string): Promise<HolidayRecord | null> {
    const h = this.holidays.get(date);
    return h ? { ...h } : null;
  }

  async create(data: Omit<HolidayRecord, 'id' | 'createdAt'>): Promise<HolidayRecord> {
    const id = this.nextId++;
    const item: HolidayRecord = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
    };
    this.holidays.set(data.date, item);
    return { ...item };
  }
}

export class MemoryBankPaymentRepository implements IBankPaymentRepository {
  private files = new Map<string, BankPaymentFileRecord>();

  async listByBatchId(batchId: string): Promise<BankPaymentFileRecord[]> {
    return Array.from(this.files.values())
      .filter((f) => f.payrollBatchId === batchId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(id: string): Promise<BankPaymentFileRecord | null> {
    const f = this.files.get(id);
    return f ? { ...f } : null;
  }

  async save(record: BankPaymentFileRecord): Promise<void> {
    this.files.set(record.id, { ...record });
  }
}

export class MemoryAssignedAssetRepository implements IAssignedAssetRepository {
  private assets = new Map<string, AssignedAssetRecord>();

  async list(): Promise<AssignedAssetRecord[]> {
    return Array.from(this.assets.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listByEmployeeId(employeeId: string): Promise<AssignedAssetRecord[]> {
    return Array.from(this.assets.values())
      .filter((a) => a.employeeId === employeeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(id: string): Promise<AssignedAssetRecord | null> {
    const a = this.assets.get(id);
    return a ? { ...a } : null;
  }

  async create(asset: Omit<AssignedAssetRecord, 'id' | 'createdAt'>): Promise<AssignedAssetRecord> {
    const id = randomUUID();
    const created: AssignedAssetRecord = {
      ...asset,
      id,
      createdAt: new Date().toISOString(),
    };
    this.assets.set(id, created);
    return { ...created };
  }

  async updateStatus(id: string, status: AssignedAssetRecord['status'], returnDate?: string): Promise<AssignedAssetRecord | null> {
    const existing = this.assets.get(id);
    if (!existing) return null;
    const updated: AssignedAssetRecord = {
      ...existing,
      status,
      returnDate: returnDate !== undefined ? returnDate : existing.returnDate,
    };
    this.assets.set(id, updated);
    return { ...updated };
  }
}

export class MemorySstRepository implements ISstRepository {
  private records = new Map<string, SstRiskNotificationRecord>();

  async listByEmployeeId(employeeId: string): Promise<SstRiskNotificationRecord[]> {
    return Array.from(this.records.values())
      .filter((r) => r.employeeId === employeeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(id: string): Promise<SstRiskNotificationRecord | null> {
    const r = this.records.get(id);
    return r ? { ...r } : null;
  }

  async create(data: Omit<SstRiskNotificationRecord, 'id' | 'createdAt'>): Promise<SstRiskNotificationRecord> {
    const id = randomUUID();
    const created: SstRiskNotificationRecord = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
    };
    this.records.set(id, created);
    return { ...created };
  }

  async acknowledge(id: string, signedAt: string): Promise<SstRiskNotificationRecord | null> {
    const existing = this.records.get(id);
    if (!existing) return null;
    const updated: SstRiskNotificationRecord = {
      ...existing,
      isAcknowledged: true,
      signedAt,
    };
    this.records.set(id, updated);
    return { ...updated };
  }
}

export class MemoryJobPostingRepository implements IJobPostingRepository {
  private postings = new Map<string, JobPostingRecord>();

  async list(): Promise<JobPostingRecord[]> {
    return Array.from(this.postings.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(id: string): Promise<JobPostingRecord | null> {
    const p = this.postings.get(id);
    return p ? { ...p } : null;
  }

  async create(data: Omit<JobPostingRecord, 'id' | 'createdAt'>): Promise<JobPostingRecord> {
    const item: JobPostingRecord = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.postings.set(item.id, item);
    return { ...item };
  }

  async updateStatus(id: string, status: JobPostingRecord['status']): Promise<JobPostingRecord | null> {
    const item = this.postings.get(id);
    if (!item) return null;
    const updated = { ...item, status };
    this.postings.set(id, updated);
    return { ...updated };
  }
}

export class MemoryJobApplicationRepository implements IJobApplicationRepository {
  private applications = new Map<string, JobApplicationRecord>();

  async listByPostingId(postingId: string): Promise<JobApplicationRecord[]> {
    return Array.from(this.applications.values())
      .filter((a) => a.jobPostingId === postingId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(id: string): Promise<JobApplicationRecord | null> {
    const a = this.applications.get(id);
    return a ? { ...a } : null;
  }

  async create(data: Omit<JobApplicationRecord, 'id' | 'createdAt' | 'stageUpdatedAt'>): Promise<JobApplicationRecord> {
    const now = new Date().toISOString();
    const item: JobApplicationRecord = {
      ...data,
      id: randomUUID(),
      stageUpdatedAt: now,
      createdAt: now,
    };
    this.applications.set(item.id, item);
    return { ...item };
  }

  async updateStage(id: string, stage: JobApplicationRecord['stage'], notes?: string): Promise<JobApplicationRecord | null> {
    const item = this.applications.get(id);
    if (!item) return null;
    const updated: JobApplicationRecord = {
      ...item,
      stage,
      notes: notes !== undefined ? notes : item.notes,
      stageUpdatedAt: new Date().toISOString(),
    };
    this.applications.set(id, updated);
    return { ...updated };
  }
}

export class MemoryTrainingRepository implements ITrainingRepository {
  private courses = new Map<string, TrainingCourseRecord>();
  private enrollments = new Map<string, TrainingEnrollmentRecord>();

  async listCourses(): Promise<TrainingCourseRecord[]> {
    return Array.from(this.courses.values()).sort((a, b) => a.title.localeCompare(b.title));
  }

  async findCourseById(id: string): Promise<TrainingCourseRecord | null> {
    const c = this.courses.get(id);
    return c ? { ...c } : null;
  }

  async createCourse(data: Omit<TrainingCourseRecord, 'id' | 'createdAt'>): Promise<TrainingCourseRecord> {
    const item: TrainingCourseRecord = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.courses.set(item.id, item);
    return { ...item };
  }

  async listEnrollments(workerId?: string): Promise<TrainingEnrollmentRecord[]> {
    const all = Array.from(this.enrollments.values());
    if (workerId) {
      return all.filter((e) => e.workerId === workerId);
    }
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async enrollWorker(data: Omit<TrainingEnrollmentRecord, 'id' | 'createdAt'>): Promise<TrainingEnrollmentRecord> {
    const item: TrainingEnrollmentRecord = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.enrollments.set(item.id, item);
    return { ...item };
  }

  async updateEnrollmentStatus(
    id: string,
    status: TrainingEnrollmentRecord['status'],
    score?: number,
    completionDate?: string
  ): Promise<TrainingEnrollmentRecord | null> {
    const item = this.enrollments.get(id);
    if (!item) return null;
    const updated: TrainingEnrollmentRecord = {
      ...item,
      status,
      score: score !== undefined ? score : item.score,
      completionDate: completionDate !== undefined ? completionDate : item.completionDate,
    };
    this.enrollments.set(id, updated);
    return { ...updated };
  }
}

export class MemoryPerformanceRepository implements IPerformanceRepository {
  private evaluations = new Map<string, PerformanceEvaluationRecord>();

  async list(workerId?: string): Promise<PerformanceEvaluationRecord[]> {
    const all = Array.from(this.evaluations.values());
    if (workerId) {
      return all.filter((e) => e.workerId === workerId);
    }
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(id: string): Promise<PerformanceEvaluationRecord | null> {
    const e = this.evaluations.get(id);
    return e ? { ...e } : null;
  }

  async create(data: Omit<PerformanceEvaluationRecord, 'id' | 'createdAt'>): Promise<PerformanceEvaluationRecord> {
    const item: PerformanceEvaluationRecord = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.evaluations.set(item.id, item);
    return { ...item };
  }
}

export function createMemoryRepositories(): Repositories {
  return {
    settings: new MemorySettingsRepository(),
    users: new MemoryUserRepository(),
    sessions: new MemorySessionRepository(),
    bankAccounts: new MemoryBankAccountRepository(),
    territories: new MemoryTerritoryRepository(),
    orgUnits: new MemoryOrgUnitRepository(),
    positions: new MemoryPositionRepository(),
    employees: new MemoryEmployeeRepository(),
    contracts: new MemoryContractRepository(),
    dependents: new MemoryFamilyDependentRepository(),
    movements: new MemoryContractMovementRepository(),
    requests: new MemoryEmployeeRequestRepository(),
    attendance: new MemoryAttendanceRepository(),
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
