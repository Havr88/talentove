import type { Repositories, SstRiskNotificationRecord } from '../db/types.js';
import { generateSstRiskPdf } from './sst-pdf.js';

export class SstService {
  constructor(private repos: Repositories) {}

  async getOrCreateNotificationForEmployee(employeeId: string): Promise<SstRiskNotificationRecord> {
    const list = await this.repos.sst.listByEmployeeId(employeeId);
    if (list.length > 0 && list[0]) {
      return list[0];
    }

    const employee = await this.repos.employees.findById(employeeId);
    if (!employee) {
      throw new Error(`Empleado ${employeeId} no encontrado`);
    }

    const contracts = await this.repos.contracts.findByEmployeeId(employeeId);
    const contract = contracts[0];
    const position = contract?.positionId ? await this.repos.positions.findById(contract.positionId) : null;
    const orgUnit = contract?.orgUnitId ? await this.repos.orgUnits.findById(contract.orgUnitId) : null;

    // Riesgos y medidas estándar por defecto basados en LOPCYMAT
    const defaultRisks = [
      'Carga postural estática y disergonomía por uso prolongado de pantallas y estación de trabajo (Art. 56 LOPCYMAT).',
      'Fatiga visual asociada a iluminación artificial y brillo de monitores.',
      'Riesgos de caídas al mismo nivel por obstáculos o superficies irregulares.',
      'Estrés laboral y sobrecarga mental derivada de plazos y atención continua.',
      'Riesgos eléctricos derivados de conexiones y tomas de corriente en oficina.',
    ];

    const defaultMeasures = [
      'Adoptar posturas ergonómicas y ajustar la altura de la silla y monitor según norma COVENIN 2270.',
      'Realizar pausas activas de 5 a 10 minutos cada dos horas de labor continua.',
      'Mantener los pasillos y vías de circulación despejados de cables y objetos.',
      'Reportar de inmediato al Comité de Seguridad y Salud Laboral cualquier condición insegura observada.',
      'Desconectar equipos eléctricos tirando del enchufe y no del cable.',
    ];

    const notification = await this.repos.sst.create({
      employeeId,
      positionName: position?.name || 'Personal Administrativo / Operativo',
      workArea: orgUnit?.name || 'Sede Principal',
      riskFactors: defaultRisks,
      preventiveMeasures: defaultMeasures,
      eppRequired: ['Lentes de descanso con filtro azul (opcional)', 'Ergonomía de soporte lumbar'],
      isAcknowledged: false,
    });

    return notification;
  }

  async acknowledgeNotification(notificationId: string): Promise<SstRiskNotificationRecord> {
    const updated = await this.repos.sst.acknowledge(notificationId, new Date().toISOString().slice(0, 10));
    if (!updated) {
      throw new Error(`Notificación ${notificationId} no encontrada`);
    }
    return updated;
  }

  async generatePdf(notificationId: string): Promise<Buffer> {
    const notif = await this.repos.sst.findById(notificationId);
    if (!notif) {
      throw new Error(`Notificación ${notificationId} no encontrada`);
    }

    const employee = await this.repos.employees.findById(notif.employeeId);
    if (!employee) {
      throw new Error(`Empleado ${notif.employeeId} no encontrado`);
    }

    const contracts = await this.repos.contracts.findByEmployeeId(notif.employeeId);
    const contract = contracts[0];
    const orgUnit = contract?.orgUnitId ? await this.repos.orgUnits.findById(contract.orgUnitId) : null;
    const settings = await this.repos.settings.getSettings();

    return generateSstRiskPdf({
      companyName: settings?.companyName || 'EMPRESA DEMO C.A.',
      nativeId: settings?.nativeId || 'J309999990',
      employeeFullName: `${employee.nombres} ${employee.apellidos}`,
      nationalId: `${employee.cedulaTipo}-${employee.cedulaNumero}`,
      positionTitle: notif.positionName,
      orgUnitName: orgUnit?.name || notif.workArea || 'Sede Principal',
      hireDate: contract?.fechaIngreso || employee.createdAt.slice(0, 10),
      risksIdentified: notif.riskFactors,
      preventiveMeasures: notif.preventiveMeasures,
      eppAssigned: notif.eppRequired,
      acknowledgedAt: notif.signedAt || undefined,
      id: notif.id,
    });
  }
}
