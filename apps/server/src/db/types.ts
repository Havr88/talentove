export type UserRole = 'superadmin' | 'admin' | 'coordinator' | 'worker';
export type UserStatus = 'active' | 'suspended';

export interface CompanySettings {
  readonly id: number;
  readonly companyName: string;
  readonly nativeId: string;
  readonly instanceName: string;
  readonly primaryColor: string;
  readonly accentColor: string;
  readonly isConfigured: boolean;
  readonly updatedAt: string;
}

export interface User {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly fullName: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly totpSecretEnc?: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Session {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly lastActiveAt: string;
  readonly ipAddress?: string | undefined;
  readonly userAgent?: string | undefined;
}

export interface ISettingsRepository {
  getSettings(): Promise<CompanySettings | null>;
  saveSettings(data: Omit<CompanySettings, 'id' | 'updatedAt'>): Promise<CompanySettings>;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  count(): Promise<number>;
}

export interface ISessionRepository {
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  create(session: Omit<Session, 'id' | 'createdAt'>): Promise<Session>;
  touch(id: string, lastActiveAt: string): Promise<void>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
  deleteExpired(nowIso: string): Promise<number>;
}

export interface Repositories {
  readonly bankAccounts?: IBankAccountRepository | undefined;
  readonly settings: ISettingsRepository;
  readonly users: IUserRepository;
  readonly sessions: ISessionRepository;
  readonly territories: ITerritoryRepository;
  readonly orgUnits: IOrgUnitRepository;
  readonly positions: IPositionRepository;
  readonly employees: IEmployeeRepository;
  readonly contracts: IContractRepository;
  readonly dependents: IFamilyDependentRepository;
  readonly movements: IContractMovementRepository;
  readonly requests: IEmployeeRequestRepository;
  readonly attendance: IAttendanceRepository;
  readonly payroll: IPayrollRepository;
  readonly credentials: IDigitalCredentialRepository;
  readonly holidays: IHolidayRepository;
  readonly bankPayments: IBankPaymentRepository;
  readonly assets: IAssignedAssetRepository;
  readonly sst: ISstRepository;
  readonly jobPostings: IJobPostingRepository;
  readonly jobApplications: IJobApplicationRepository;
  readonly training: ITrainingRepository;
  readonly performance: IPerformanceRepository;
}

export interface Territory {
  readonly id: number;
  readonly codigo: string;
  readonly nombre: string;
  readonly capital: string;
}

export interface Location {
  readonly id: string;
  readonly companyId: number;
  readonly name: string;
  readonly territoryId: number;
  readonly municipio: string;
  readonly parroquia: string;
  readonly direccion: string;
  readonly createdAt: string;
}

export interface OrgUnitType {
  readonly id: number;
  readonly name: string;
  readonly level: number;
}

export interface OrgUnit {
  readonly id: string;
  readonly parentId?: string | undefined;
  readonly typeId: number;
  readonly name: string;
  readonly locationId?: string | undefined;
  readonly createdAt: string;
}

export interface Position {
  readonly id: number;
  readonly codigo?: string | undefined;
  readonly name: string;
  readonly categoria: string;
  readonly grupoIsco: string;
  readonly aplicaSector: 'ambos' | 'publico' | 'privado';
  readonly nivelTabuladorApn?: string | undefined;
  readonly activo: boolean;
}

export interface PersonnelType {
  readonly id: number;
  readonly nombre: string;
  readonly grupo: string;
  readonly vinculo: string;
  readonly sector: 'ambos' | 'publico' | 'privado';
  readonly relacionLaboral: boolean;
  readonly baseLegal?: string | undefined;
}

export type GradoInstruccion = 'BACH' | 'TSU' | 'PROF' | 'ESPEC' | 'MGS' | 'DOCT';
export const GRADO_INSTRUCCION_LABEL: Record<GradoInstruccion, string> = {
  BACH: 'Bachiller',
  TSU: 'Técnico Superior Universitario',
  PROF: 'Profesional Universitario',
  ESPEC: 'Especialista',
  MGS: 'Magíster',
  DOCT: 'Doctor(a)',
};

export type EmployeeStatus = 'activo' | 'reposo' | 'vacaciones' | 'suspendido' | 'retirado';
export type CivilStatus = 'soltero' | 'casado' | 'divorciado' | 'viudo' | 'union_estable';

export interface Employee {
  readonly id: string;
  readonly cedulaTipo: 'V' | 'E';
  readonly cedulaNumero: string;
  readonly nativeId: string;
  readonly rif?: string | undefined;
  readonly nombres: string;
  readonly apellidos: string;
  readonly fechaNacimiento: string;
  readonly sexo: 'M' | 'F';
  readonly estadoCivil: CivilStatus;
  readonly correo?: string | undefined;
  readonly telefono?: string | undefined;
  readonly direccion: string;
  readonly territoryId?: number | undefined;
  readonly gradoInstruccion?: GradoInstruccion | undefined;
  readonly status: EmployeeStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Contract {
  readonly id: string;
  readonly employeeId: string;
  readonly locationId?: string | undefined;
  readonly orgUnitId?: string | undefined;
  readonly positionId?: number | undefined;
  readonly personnelTypeId?: number | undefined;
  readonly tipo: 'indeterminado' | 'determinado' | 'obra_labor';
  readonly sector: 'publico' | 'privado';
  readonly fechaIngreso: string;
  readonly fechaIngresoApn?: string | undefined;
  readonly fechaFin?: string | undefined;
  readonly condicionLaboral?: string | undefined;
  readonly salarioBase: string;
  readonly currency: 'VES' | 'USD';
  readonly jornadaHoras: number;
  readonly activo: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BankAccount {
  readonly id: string;
  readonly employeeId: string;
  readonly bancoCodigo: string;
  readonly bancoNombre: string;
  readonly tipo: 'corriente' | 'ahorro' | 'pago_movil';
  readonly numero: string;
  readonly esPrincipal: boolean;
  readonly createdAt: string;
}

export interface IBankAccountRepository {
  listByEmployeeId(employeeId: string): Promise<BankAccount[]>;
  create(data: Omit<BankAccount, 'id' | 'createdAt'>): Promise<BankAccount>;
}

export interface ITerritoryRepository {
  list(): Promise<Territory[]>;
  findById(id: number): Promise<Territory | null>;
  findByCodigo(codigo: string): Promise<Territory | null>;
}

export interface IOrgUnitRepository {
  list(): Promise<OrgUnit[]>;
  create(data: Omit<OrgUnit, 'id' | 'createdAt'>): Promise<OrgUnit>;
  findById(id: string): Promise<OrgUnit | null>;
}

export interface IPositionRepository {
  list(): Promise<Position[]>;
  findById(id: number): Promise<Position | null>;
  create(data: Omit<Position, 'id'>): Promise<Position>;
  findByName(name: string): Promise<Position | null>;
}

export interface IEmployeeRepository {
  list(): Promise<Employee[]>;
  findById(id: string): Promise<Employee | null>;
  findByNativeId(nativeId: string): Promise<Employee | null>;
  create(data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<Employee>;
  update(id: string, data: Partial<Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Employee | null>;
  count(): Promise<number>;
}

export interface IContractRepository {
  findActiveByEmployeeId(employeeId: string): Promise<Contract | null>;
  findByEmployeeId(employeeId: string): Promise<Contract[]>;
  create(data: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contract>;
  update(id: string, data: Partial<Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Contract | null>;
}

export type DependentRelationship = 'hijo' | 'conyuge' | 'padre' | 'madre' | 'otro';

export interface FamilyDependent {
  readonly id: string;
  readonly employeeId: string;
  readonly nombres: string;
  readonly apellidos: string;
  readonly parentesco: DependentRelationship;
  readonly cedula?: string | undefined;
  readonly fechaNacimiento: string;
  readonly sexo: 'M' | 'F';
  readonly gradoInstruccion: string;
  readonly discapacidad: boolean;
  readonly createdAt: string;
}

export interface IFamilyDependentRepository {
  listByEmployeeId(employeeId: string): Promise<FamilyDependent[]>;
  create(data: Omit<FamilyDependent, 'id' | 'createdAt'>): Promise<FamilyDependent>;
  delete(id: string): Promise<boolean>;
}

export type MovementType = 'ingreso' | 'ascenso' | 'transferencia' | 'ajuste_salarial' | 'suspension' | 'retiro';

export interface ContractMovement {
  readonly id: string;
  readonly contractId: string;
  readonly employeeId: string;
  readonly tipoMovimiento: MovementType;
  readonly fechaEfectiva: string;
  readonly cargoAnterior?: string | undefined;
  readonly cargoNuevo: string;
  readonly unidadAnterior?: string | undefined;
  readonly unidadNueva: string;
  readonly salarioAnterior?: string | undefined;
  readonly salarioNuevo: string;
  readonly motivo?: string | undefined;
  readonly aprobadoPor?: string | undefined;
  readonly createdAt: string;
}

export interface IContractMovementRepository {
  listByEmployeeId(employeeId: string): Promise<ContractMovement[]>;
  create(data: Omit<ContractMovement, 'id' | 'createdAt'>): Promise<ContractMovement>;
}

export type RequestType = 'constancia_trabajo' | 'adelanto_prestaciones' | 'permiso' | 'vacaciones';
export type RequestStatus = 'pendiente' | 'aprobada' | 'rechazada' | 'procesada';

export interface EmployeeRequest {
  readonly id: string;
  readonly employeeId: string;
  readonly userId?: string | undefined;
  readonly tipo: RequestType;
  readonly estatus: RequestStatus;
  readonly motivo: string;
  readonly fechaDesde?: string | undefined;
  readonly fechaHasta?: string | undefined;
  readonly diasSolicitados?: number | undefined;
  readonly montoSolicitado?: string | undefined;
  readonly observacionesRrhh?: string | undefined;
  readonly codigoVerificacion?: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IEmployeeRequestRepository {
  list(): Promise<EmployeeRequest[]>;
  listByEmployeeId(employeeId: string): Promise<EmployeeRequest[]>;
  findById(id: string): Promise<EmployeeRequest | null>;
  findByCodigoVerificacion(codigo: string): Promise<EmployeeRequest | null>;
  create(data: Omit<EmployeeRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmployeeRequest>;
  updateStatus(id: string, estatus: RequestStatus, observacionesRrhh?: string): Promise<EmployeeRequest | null>;
}

export type AttendanceSheetStatus = 'borrador' | 'en_revision' | 'verificada' | 'cerrada';
export type AttendanceRecordStatus =
  | 'asistio'
  | 'falta_injustificada'
  | 'falta_justificada'
  | 'reposo_ivss'
  | 'vacaciones'
  | 'feriado'
  | 'dia_libre';

export interface AttendanceSheet {
  readonly id: string;
  readonly orgUnitId: string;
  readonly weekNumber: number;
  readonly year: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly coordinatorId?: string | undefined;
  readonly coordinatorName: string;
  readonly verifiedBy?: string | undefined;
  readonly status: AttendanceSheetStatus;
  readonly observations?: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AttendanceRecord {
  readonly id: string;
  readonly sheetId: string;
  readonly employeeId: string;
  readonly date: string;
  readonly dayOfWeek: number;
  readonly timeIn?: string | undefined;
  readonly timeOut?: string | undefined;
  readonly status: AttendanceRecordStatus;
  readonly regularHours: number;
  readonly overtimeDayHours: number;
  readonly overtimeNightHours: number;
  readonly nightShiftHours: number;
  readonly workerSigned: boolean;
  readonly observations?: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IAttendanceRepository {
  listSheets(filters?: { orgUnitId?: string | undefined; year?: number | undefined; status?: AttendanceSheetStatus | undefined }): Promise<AttendanceSheet[]>;
  findSheetById(id: string): Promise<AttendanceSheet | null>;
  findSheet(orgUnitId: string, weekNumber: number, year: number): Promise<AttendanceSheet | null>;
  createSheet(data: Omit<AttendanceSheet, 'id' | 'createdAt' | 'updatedAt'>): Promise<AttendanceSheet>;
  updateSheet(id: string, data: Partial<Omit<AttendanceSheet, 'id' | 'createdAt' | 'updatedAt'>>): Promise<AttendanceSheet | null>;
  listRecordsBySheetId(sheetId: string): Promise<AttendanceRecord[]>;
  saveRecords(records: Omit<AttendanceRecord, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<AttendanceRecord[]>;
}

// ----------------------------------------------------
// Hito M2b: Nómina Integral LOTTT & APN
// ----------------------------------------------------
export interface PayrollBatch {
  readonly id: string;
  readonly title: string;
  readonly periodType: string;
  readonly year: number;
  readonly month: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: string;
  readonly totalEarnings: number;
  readonly totalDeductions: number;
  readonly totalNet: number;
  readonly exchangeRateBcv: number;
  readonly processedBy?: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PayrollReceiptRecord {
  readonly id: string;
  readonly payrollId: string;
  readonly employeeId: string;
  readonly snapshot: string; // JSON con EmployeePayrollSnapshot
  readonly baseSalary: number;
  readonly educationPremium: number;
  readonly seniorityPremium: number;
  readonly kidsPremium: number;
  readonly overtimePay: number;
  readonly nightBonusPay: number;
  readonly cestaTicket: number;
  readonly totalEarnings: number;
  readonly ivssDeduction: number;
  readonly faovDeduction: number;
  readonly spfDeduction: number;
  readonly absenceDeduction: number;
  readonly totalDeductions: number;
  readonly netPay: number;
  readonly netPayUsd: number;
  readonly status: string;
  readonly createdAt: string;
}

export interface IPayrollRepository {
  listBatches(): Promise<PayrollBatch[]>;
  findBatchById(id: string): Promise<PayrollBatch | null>;
  createBatch(batch: Omit<PayrollBatch, 'id' | 'createdAt' | 'updatedAt'>): Promise<PayrollBatch>;
  updateBatchStatus(id: string, status: string): Promise<PayrollBatch | null>;
  listReceiptsByBatchId(batchId: string): Promise<PayrollReceiptRecord[]>;
  listReceiptsByEmployeeId(employeeId: string): Promise<PayrollReceiptRecord[]>;
  findReceiptById(id: string): Promise<PayrollReceiptRecord | null>;
  saveReceipts(receipts: Omit<PayrollReceiptRecord, 'id' | 'createdAt'>[]): Promise<PayrollReceiptRecord[]>;
}

// ----------------------------------------------------
// Hito M2c: Carnetización Institucional CR-80 con QR
// ----------------------------------------------------
export interface DigitalCredential {
  readonly id: string;
  readonly employeeId: string;
  readonly verificationToken: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly bloodType: string;
  readonly emergencyContact: string;
  readonly emergencyPhone: string;
  readonly status: 'activa' | 'revocada' | 'suspendida';
  readonly qrCodeDataUri?: string | undefined;
  readonly createdAt: string;
}

export interface IDigitalCredentialRepository {
  findByEmployeeId(employeeId: string): Promise<DigitalCredential | null>;
  findByToken(token: string): Promise<DigitalCredential | null>;
  create(data: Omit<DigitalCredential, 'id' | 'createdAt'>): Promise<DigitalCredential>;
  updateStatus(id: string, status: 'activa' | 'revocada' | 'suspendida'): Promise<DigitalCredential | null>;
}

// ----------------------------------------------------
// Hito M3: Calendario de Feriados y Decretos
// ----------------------------------------------------
export interface HolidayRecord {
  readonly id: number;
  readonly date: string;
  readonly name: string;
  readonly type: 'nacional' | 'decreto' | 'bancario' | 'regional';
  readonly isWorkingDay: boolean;
  readonly payRateMultiplier: number;
  readonly description?: string | undefined;
  readonly createdAt: string;
}

export interface IHolidayRepository {
  list(year?: number): Promise<HolidayRecord[]>;
  findByDate(date: string): Promise<HolidayRecord | null>;
  create(data: Omit<HolidayRecord, 'id' | 'createdAt'>): Promise<HolidayRecord>;
}

// ----------------------------------------------------
// Integraciones Bancarias de Pago de Nómina (M2b)
// ----------------------------------------------------
export interface BankPaymentFileRecord {
  readonly id: string;
  readonly payrollBatchId: string;
  readonly bankCode: string;
  readonly bankName: string;
  readonly fileName: string;
  readonly content: string;
  readonly totalRecords: number;
  readonly totalAmount: number;
  readonly hash: string;
  readonly createdAt: string;
  readonly createdBy: string;
}

export interface IBankPaymentRepository {
  listByBatchId(batchId: string): Promise<BankPaymentFileRecord[]>;
  findById(id: string): Promise<BankPaymentFileRecord | null>;
  save(record: BankPaymentFileRecord): Promise<void>;
}

// ----------------------------------------------------
// Control de Activos Asignados (Módulo E - M3)
// ----------------------------------------------------
export interface AssignedAssetRecord {
  readonly id: string;
  readonly employeeId: string;
  readonly assetType: 'equipo_computo' | 'linea_telefonica' | 'uniforme' | 'epp' | 'vehiculo' | 'llave_acceso' | 'otro';
  readonly assetCode: string;
  readonly description: string;
  readonly serialNumber?: string | undefined;
  readonly assignedDate: string;
  readonly status: 'asignado' | 'devuelto' | 'extraviado' | 'danado';
  readonly returnDate?: string | undefined;
  readonly notes?: string | undefined;
  readonly createdAt: string;
}

export interface IAssignedAssetRepository {
  list(): Promise<AssignedAssetRecord[]>;
  listByEmployeeId(employeeId: string): Promise<AssignedAssetRecord[]>;
  findById(id: string): Promise<AssignedAssetRecord | null>;
  create(asset: Omit<AssignedAssetRecord, 'id' | 'createdAt'>): Promise<AssignedAssetRecord>;
  updateStatus(id: string, status: AssignedAssetRecord['status'], returnDate?: string): Promise<AssignedAssetRecord | null>;
}

// ----------------------------------------------------
// Seguridad y Salud Laboral LOPCYMAT (SST - M3)
// ----------------------------------------------------
export interface SstRiskNotificationRecord {
  readonly id: string;
  readonly employeeId: string;
  readonly positionName: string;
  readonly workArea: string;
  readonly riskFactors: string[];
  readonly preventiveMeasures: string[];
  readonly eppRequired: string[];
  readonly isAcknowledged: boolean;
  readonly signedAt?: string | undefined;
  readonly createdAt: string;
}

export interface ISstRepository {
  listByEmployeeId(employeeId: string): Promise<SstRiskNotificationRecord[]>;
  findById(id: string): Promise<SstRiskNotificationRecord | null>;
  create(data: Omit<SstRiskNotificationRecord, 'id' | 'createdAt'>): Promise<SstRiskNotificationRecord>;
  acknowledge(id: string, signedAt: string): Promise<SstRiskNotificationRecord | null>;
}

// ----------------------------------------------------
// ATS y Reclutamiento (M3)
// ----------------------------------------------------
export interface JobPostingRecord {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly orgUnitId: string;
  readonly positionId: number;
  readonly type: 'interna' | 'publica' | 'mixta';
  readonly status: 'borrador' | 'publicada' | 'pausada' | 'cerrada';
  readonly vacanciesCount: number;
  readonly salaryMinBs?: string;
  readonly salaryMaxBs?: string;
  readonly description: string;
  readonly requirements: string[];
  readonly closingDate?: string;
  readonly createdAt: string;
}

export interface IJobPostingRepository {
  list(): Promise<JobPostingRecord[]>;
  findById(id: string): Promise<JobPostingRecord | null>;
  create(data: Omit<JobPostingRecord, 'id' | 'createdAt'>): Promise<JobPostingRecord>;
  updateStatus(id: string, status: JobPostingRecord['status']): Promise<JobPostingRecord | null>;
}

export interface JobApplicationRecord {
  readonly id: string;
  readonly jobPostingId: string;
  readonly candidateName: string;
  readonly candidateCedula: string;
  readonly candidateEmail: string;
  readonly candidatePhone: string;
  readonly candidateAddress?: string;
  readonly stage: 'postulado' | 'revision' | 'entrevista' | 'oferta' | 'contratado' | 'descartado';
  readonly score?: number | undefined;
  readonly notes?: string | undefined;
  readonly stageUpdatedAt: string;
  readonly createdAt: string;
}

export interface IJobApplicationRepository {
  listByPostingId(postingId: string): Promise<JobApplicationRecord[]>;
  findById(id: string): Promise<JobApplicationRecord | null>;
  create(data: Omit<JobApplicationRecord, 'id' | 'createdAt' | 'stageUpdatedAt'>): Promise<JobApplicationRecord>;
  updateStage(id: string, stage: JobApplicationRecord['stage'], notes?: string): Promise<JobApplicationRecord | null>;
}

// ----------------------------------------------------
// Capacitación y Formación INCES (M3)
// ----------------------------------------------------
export interface TrainingCourseRecord {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly category: 'tecnica' | 'seguridad' | 'habilidades_blandas' | 'pna_inces';
  readonly durationHours: number;
  readonly minPassingScore: number;
  readonly createdAt: string;
}

export interface TrainingEnrollmentRecord {
  readonly id: string;
  readonly courseId: string;
  readonly workerId: string;
  readonly status: 'inscrito' | 'en_progreso' | 'aprobado' | 'reprobado';
  readonly score?: number | undefined;
  readonly completionDate?: string | undefined;
  readonly createdAt: string;
}

export interface ITrainingRepository {
  listCourses(): Promise<TrainingCourseRecord[]>;
  findCourseById(id: string): Promise<TrainingCourseRecord | null>;
  createCourse(data: Omit<TrainingCourseRecord, 'id' | 'createdAt'>): Promise<TrainingCourseRecord>;
  listEnrollments(workerId?: string): Promise<TrainingEnrollmentRecord[]>;
  enrollWorker(data: Omit<TrainingEnrollmentRecord, 'id' | 'createdAt'>): Promise<TrainingEnrollmentRecord>;
  updateEnrollmentStatus(id: string, status: TrainingEnrollmentRecord['status'], score?: number | undefined, completionDate?: string): Promise<TrainingEnrollmentRecord | null>;
}

// ----------------------------------------------------
// Evaluación de Desempeño (M3)
// ----------------------------------------------------
export interface PerformanceEvaluationRecord {
  readonly id: string;
  readonly workerId: string;
  readonly period: string;
  readonly goalsScore: number;
  readonly competenciesScore: number;
  readonly finalScore: number;
  readonly meritLevel: string;
  readonly isEligibleForPromotion: boolean;
  readonly isEligibleForBonus: boolean;
  readonly evaluatorId?: string | undefined;
  readonly comments?: string | undefined;
  readonly createdAt: string;
}

export interface IPerformanceRepository {
  list(workerId?: string): Promise<PerformanceEvaluationRecord[]>;
  findById(id: string): Promise<PerformanceEvaluationRecord | null>;
  create(data: Omit<PerformanceEvaluationRecord, 'id' | 'createdAt'>): Promise<PerformanceEvaluationRecord>;
}




