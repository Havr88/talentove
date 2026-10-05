import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import type { Repositories, DigitalCredential, Employee } from '../db/types.js';

export interface IssueCredentialInput {
  employeeId: string;
  baseUrl: string;
  expiresInDays?: number;
}

export interface CredentialDetails {
  credential: DigitalCredential;
  employee: Employee;
  qrDataUrl: string;
  verificationUrl: string;
}

export class CredentialService {
  constructor(private readonly repos: Repositories) {}

  async issueOrGetCredential(input: IssueCredentialInput): Promise<CredentialDetails> {
    const employee = await this.repos.employees.findById(input.employeeId);
    if (!employee) {
      throw new Error(`Empleado con id "${input.employeeId}" no encontrado`);
    }

    let credential = await this.repos.credentials.findByEmployeeId(employee.id);

    if (!credential || credential.status !== 'activa') {
      const verificationToken = randomBytes(24).toString('hex');
      const now = new Date();
      const expiresDays = input.expiresInDays || 365;
      const expiry = new Date(now.getTime() + expiresDays * 24 * 60 * 60 * 1000);

      const verificationUrl = `${input.baseUrl}/verificar/carnet/${verificationToken}`;
      const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 256,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });

      credential = await this.repos.credentials.create({
        employeeId: employee.id,
        verificationToken,
        issuedAt: now.toISOString(),
        expiresAt: expiry.toISOString(),
        bloodType: 'O+',
        emergencyContact: 'RRHH',
        emergencyPhone: '0212-0000000',
        status: 'activa',
        qrCodeDataUri: qrDataUrl,
      });
    }

    const verificationUrl = `${input.baseUrl}/verificar/carnet/${credential.verificationToken}`;
    const qrDataUrl = credential.qrCodeDataUri || (await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    }));

    return {
      credential,
      employee,
      qrDataUrl,
      verificationUrl,
    };
  }

  async verifyCredential(token: string): Promise<{ valid: boolean; credential?: DigitalCredential; employee?: Employee; reason?: string }> {
    const credential = await this.repos.credentials.findByToken(token);
    if (!credential) {
      return { valid: false, reason: 'Credencial no encontrada o token inválido' };
    }

    if (credential.status === 'revocada') {
      return { valid: false, credential, reason: 'La credencial ha sido REVOCADA por la institución' };
    }

    const now = new Date();
    const expiry = new Date(credential.expiresAt);
    if (now > expiry) {
      return { valid: false, credential, reason: 'La credencial se encuentra EXPIRADA' };
    }

    const employee = await this.repos.employees.findById(credential.employeeId);
    if (!employee) {
      return { valid: false, credential, reason: 'Empleado asociado no encontrado' };
    }

    if (employee.status !== 'activo') {
      return { valid: false, credential, employee, reason: `El trabajador se encuentra en estado INACTIVO (${employee.status})` };
    }

    return { valid: true, credential, employee };
  }

  async revokeCredential(id: string): Promise<void> {
    await this.repos.credentials.updateStatus(id, 'revocada');
  }
}
