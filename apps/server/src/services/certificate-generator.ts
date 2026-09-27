import PDFDocument from 'pdfkit';

export interface CertificateData {
  companyName: string;
  nativeId: string;
  instanceName: string;
  employeeFullName: string;
  cedula: string;
  cargo: string;
  unidad: string;
  fechaIngreso: string;
  salarioBase: string;
  currency: 'VES' | 'USD';
  sector: 'publico' | 'privado';
  verificationCode: string;
  baseUrl: string;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function formatFechaLarga(fechaIso: string): string {
  try {
    const parts = fechaIso.split('-');
    if (parts.length === 3) {
      const dia = Number.parseInt(parts[2]!, 10);
      const mes = MESES[Number.parseInt(parts[1]!, 10) - 1] ?? 'mes';
      const anio = parts[0]!;
      return `${dia} de ${mes} de ${anio}`;
    }
    return fechaIso;
  } catch {
    return fechaIso;
  }
}

/**
 * Genera el documento PDF formal de Constancia de Trabajo en Venezuela
 * con membrete, cuerpo legal, firma electrónica de RRHH y código de verificación.
 */
export function generateWorkCertificatePdf(data: CertificateData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
      info: {
        Title: `Constancia de Trabajo - ${data.employeeFullName}`,
        Author: data.companyName,
        Subject: 'Constancia Laboral',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // 1. Membrete institucional
    doc.fontSize(12).font('Helvetica-Bold').text(data.companyName.toUpperCase(), { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`RIF: ${data.nativeId}  •  ${data.instanceName}`, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#555555').text('DIRECCIÓN DE GESTIÓN HUMANA Y TALENTO', { align: 'center' });
    doc.fillColor('#000000');

    // Línea divisoria decorativa
    doc.moveDown(1);
    doc.moveTo(60, doc.y).lineTo(552, doc.y).lineWidth(1.5).strokeColor('#0d47a1').stroke();
    doc.moveDown(2);

    // 2. Título Central
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#0d47a1').text('CONSTANCIA DE TRABAJO', { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(2.5);

    // 3. Cuerpo de la Constancia
    const fechaIngresoLarga = formatFechaLarga(data.fechaIngreso);
    const ahora = new Date();
    const diaHoy = ahora.getDate();
    const mesHoy = MESES[ahora.getMonth()] ?? 'mes actual';
    const anioHoy = ahora.getFullYear();

    const regimen = data.sector === 'publico' ? 'Administración Pública' : 'sector privado (LOTTT)';

    const parrafo1 = `Quien suscribe, la Dirección de Gestión Humana de ${data.companyName}, por medio de la presente hace constar que el(la) ciudadano(a) ${data.employeeFullName.toUpperCase()}, titular de la cédula de identidad N° ${data.cedula}, presta sus servicios laborales en esta organización bajo el régimen de ${regimen}, desde el ${fechaIngresoLarga}.`;

    const parrafo2 = `Actualmente se desempeña en el cargo de ${data.cargo.toUpperCase()}, adscrito(a) a la unidad de ${data.unidad.toUpperCase()}, devengando una remuneración base mensual de ${data.currency} ${data.salarioBase}.`;

    const parrafo3 = `Constancia que se expide a petición de la parte interesada, en la ciudad de Caracas, República Bolivariana de Venezuela, a los ${diaHoy} días del mes de ${mesHoy} de ${anioHoy}.`;

    doc.fontSize(11).font('Helvetica').lineGap(6).text(parrafo1, {
      align: 'justify',
      indent: 30,
    });
    doc.moveDown(1.2);

    doc.text(parrafo2, {
      align: 'justify',
      indent: 30,
    });
    doc.moveDown(1.2);

    doc.text(parrafo3, {
      align: 'justify',
      indent: 30,
    });

    // 4. Firmas y Sellos
    doc.moveDown(4);
    const yFirma = doc.y;

    doc.fontSize(10).font('Helvetica-Bold').text('DIRECCIÓN DE GESTIÓN HUMANA', 60, yFirma, {
      align: 'center',
      width: 492,
    });
    doc.font('Helvetica').fontSize(9).text('Certificación y Validez Laboral Electrónica', 60, yFirma + 15, {
      align: 'center',
      width: 492,
    });

    // 5. Pie de Seguridad y Verificación
    const yFooter = 680;
    doc.moveTo(60, yFooter).lineTo(552, yFooter).lineWidth(0.5).strokeColor('#cccccc').stroke();

    const verifyUrl = `${data.baseUrl}/verificar/${data.verificationCode}`;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#333333').text('VALIDACIÓN DE AUTENTICIDAD DEL DOCUMENTO', 60, yFooter + 10, {
      align: 'left',
    });
    doc.font('Helvetica').fontSize(7.5).fillColor('#666666').text(
      `Código de verificación: ${data.verificationCode}\nPuede comprobar la veracidad de este documento accediendo a:\n${verifyUrl}`,
      60,
      yFooter + 22,
      { align: 'left', width: 492 },
    );

    doc.end();
  });
}
