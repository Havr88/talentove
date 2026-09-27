import { describe, expect, it } from 'vitest';
import { generateWorkCertificatePdf } from './certificate-generator.js';

describe('generateWorkCertificatePdf', () => {
  it('genera un Buffer de PDF válido con firma y cabeceras correctas', async () => {
    const pdfBuffer = await generateWorkCertificatePdf({
      companyName: 'Banco Central de Venezuela',
      nativeId: 'G-20000001-0',
      instanceName: 'TalentoVe BCV',
      employeeFullName: 'María de los Ángeles Rodríguez',
      cedula: 'V-19876543',
      cargo: 'Especialista en Finanzas Públicas',
      unidad: 'Gerencia de Estadísticas Económicas',
      fechaIngreso: '2022-03-15',
      salarioBase: '15000.00',
      currency: 'VES',
      sector: 'publico',
      verificationCode: 'ABC-12345-XYZ',
      baseUrl: 'http://localhost:3000',
    });

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    // Cabecera estándar de documento PDF (%PDF-)
    const pdfMagicNumber = pdfBuffer.subarray(0, 5).toString('ascii');
    expect(pdfMagicNumber).toBe('%PDF-');
  });
});
