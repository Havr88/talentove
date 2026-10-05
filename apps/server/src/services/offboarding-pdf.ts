import PDFDocument from 'pdfkit';
import type { LiquidationResult } from '@talento-ve/domain';

export interface SettlementPdfData {
  companyName: string;
  nativeId: string;
  employeeFullName: string;
  nationalId: string;
  positionTitle: string;
  hireDate: string;
  terminationDate: string;
  terminationReason: string;
  baseSalary: number;
  dailyIntegralSalary: number;
  result: LiquidationResult;
}

export interface Forma14100Data {
  companyName: string;
  nativeId: string;
  ivssEmployerNumber: string;
  employeeFullName: string;
  nationalId: string;
  hireDate: string;
  terminationDate: string;
  lastSalary: number;
  terminationReason: string;
}

export function generateSettlementPdf(data: SettlementPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
      info: {
        Title: `Finiquito de Prestaciones Sociales - ${data.employeeFullName}`,
        Author: data.companyName,
        Subject: 'Liquidación de Prestaciones Sociales LOTTT Art. 142',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Membrete
    doc.font('Helvetica-Bold').fontSize(11).text('REPÚBLICA BOLIVARIANA DE VENEZUELA', { align: 'center' });
    doc.text(data.companyName.toUpperCase(), { align: 'center' });
    doc.font('Helvetica').fontSize(9).text(`RIF: ${data.nativeId} | GESTIÓN DE TALENTO HUMANO`, { align: 'center' });
    doc.moveDown(0.5);

    doc.lineWidth(1).strokeColor('#0f172a').moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(0.8);

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(
      'FINIQUITO Y LIQUIDACIÓN DE PRESTACIONES SOCIALES',
      { align: 'center' }
    );
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#475569').text(
      'CONFORME A LA LEY ORGÁNICA DEL TRABAJO, LOS TRABAJADORES Y LAS TRABAJADORAS (LOTTT - ART. 142)',
      { align: 'center' }
    );
    doc.moveDown(0.8);

    // Ficha del trabajador
    doc.rect(50, doc.y, 512, 58).fillAndStroke('#f8fafc', '#cbd5e1');
    const bY = doc.y + 6;
    doc.fillColor('#0f172a').fontSize(8.5);
    doc.font('Helvetica-Bold').text('TRABAJADOR: ', 60, bY, { continued: true });
    doc.font('Helvetica').text(data.employeeFullName);

    doc.font('Helvetica-Bold').text('C.I.: ', 60, bY + 14, { continued: true });
    doc.font('Helvetica').text(data.nationalId);

    doc.font('Helvetica-Bold').text('CARGO: ', 60, bY + 28, { continued: true });
    doc.font('Helvetica').text(data.positionTitle);

    doc.font('Helvetica-Bold').text('INGRESO: ', 320, bY, { continued: true });
    doc.font('Helvetica').text(data.hireDate);

    doc.font('Helvetica-Bold').text('EGRESO: ', 320, bY + 14, { continued: true });
    doc.font('Helvetica').text(data.terminationDate);

    doc.font('Helvetica-Bold').text('TIEMPO DE SERVICIO: ', 320, bY + 28, { continued: true });
    doc.font('Helvetica').text(
      `${data.result.serviceDuration.years} años, ${data.result.serviceDuration.months} meses, ${data.result.serviceDuration.days} días`
    );

    doc.font('Helvetica-Bold').text('MOTIVO: ', 60, bY + 42, { continued: true });
    doc.font('Helvetica').text(data.terminationReason.toUpperCase());

    doc.y = bY + 58;
    doc.moveDown(0.8);

    // Bases salariales
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text('BASES SALARIALES DE CÁLCULO');
    doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
    doc.text(
      `Último Salario Normal: Bs. ${data.baseSalary.toFixed(2)} | Salario Diario Integral: Bs. ${data.dailyIntegralSalary.toFixed(2)}`
    );
    doc.moveDown(0.6);

    // Conceptos
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text('DETALLE DE ASIGNACIONES Y CONCEPTOS DE LEY');
    doc.moveDown(0.3);

    // Encabezado de tabla
    const tableTop = doc.y;
    doc.rect(50, tableTop, 512, 16).fill('#e2e8f0');
    doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold');
    doc.text('CONCEPTO / BASE LEGAL', 55, tableTop + 4);
    doc.text('DÍAS', 380, tableTop + 4, { width: 50, align: 'right' });
    doc.text('MONTO (BS.)', 450, tableTop + 4, { width: 105, align: 'right' });

    let curY = tableTop + 18;
    doc.font('Helvetica').fontSize(8).fillColor('#1e293b');

    for (const c of data.result.concepts) {
      doc.text(c.description, 55, curY, { width: 320 });
      doc.text(c.factorDays.toString(), 380, curY, { width: 50, align: 'right' });
      doc.text(c.amount.amount, 450, curY, { width: 105, align: 'right' });
      curY += 16;
      doc.lineWidth(0.5).strokeColor('#f1f5f9').moveTo(50, curY - 2).lineTo(562, curY - 2).stroke();
    }

    doc.rect(50, curY, 512, 20).fill('#0f172a');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
    doc.text('TOTAL NETO A PERCIBIR POR LIQUIDACIÓN:', 60, curY + 6);
    doc.text(`Bs. ${data.result.totals.netToPay.amount}`, 440, curY + 6, { width: 115, align: 'right' });

    curY += 30;
    doc.y = curY;

    // Finiquito y Paz y Salvo
    doc.font('Helvetica').fontSize(7.5).fillColor('#475569').text(
      'PAZ Y SALVO Y FINIQUITO LABORAL: El trabajador deja constancia de haber recibido a su entera y cabal satisfacción el importe neto aquí liquidado, declarando que no se le adeuda suma alguna por concepto de salarios, prestaciones sociales, vacaciones, utilidades, indemnizaciones o cualquier otro concepto dimanante de la relación de trabajo que en esta fecha concluye legalmente.',
      { align: 'justify' }
    );

    const signY = doc.y + 35;
    doc.lineWidth(0.8).strokeColor('#94a3b8').moveTo(80, signY).lineTo(240, signY).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text('TRABAJADOR CONFORME', 80, signY + 4, { width: 160, align: 'center' });
    doc.font('Helvetica').fontSize(7.5).text(`C.I.: ${data.nationalId}`, 80, signY + 14, { width: 160, align: 'center' });

    doc.lineWidth(0.8).strokeColor('#94a3b8').moveTo(370, signY).lineTo(530, signY).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text('POR LA ENTIDAD DE TRABAJO', 370, signY + 4, { width: 160, align: 'center' });
    doc.font('Helvetica').fontSize(7.5).text(data.companyName, 370, signY + 14, { width: 160, align: 'center' });

    doc.end();
  });
}

export function generateForma14100Pdf(data: Forma14100Data): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
      info: {
        Title: `Forma 14-100 IVSS - ${data.employeeFullName}`,
        Author: 'Instituto Venezolano de los Seguros Sociales',
        Subject: 'Constancia de Egreso del Trabajador (Forma 14-100)',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Membrete Oficial IVSS
    doc.font('Helvetica-Bold').fontSize(10).text('REPÚBLICA BOLIVARIANA DE VENEZUELA', { align: 'center' });
    doc.text('MINISTERIO DEL PODER POPULAR PARA EL PROCESO SOCIAL DE TRABAJO', { align: 'center' });
    doc.fontSize(11).text('INSTITUTO VENEZOLANO DE LOS SEGUROS SOCIALES (IVSS)', { align: 'center' });
    doc.fontSize(8.5).font('Helvetica').text('DIRECCIÓN GENERAL DE AFILIACIÓN Y PRESTACIONES EN DINERO', { align: 'center' });
    doc.moveDown(0.5);

    doc.lineWidth(1.5).strokeColor('#0284c7').moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(0.8);

    doc.rect(50, doc.y, 512, 24).fill('#0f172a');
    doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold').text(
      'FORMA 14-100: CONSTANCIA DE EGRESO DEL TRABAJADOR',
      50,
      doc.y + 6,
      { align: 'center', width: 512 }
    );
    doc.moveDown(1.5);

    // 1. Datos de la Empresa
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text('PARTE 1: DATOS DEL EMPLEADOR O ENTIDAD DE TRABAJO');
    doc.rect(50, doc.y + 2, 512, 45).fillAndStroke('#f8fafc', '#cbd5e1');
    const p1Y = doc.y + 8;
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('RAZÓN SOCIAL: ', 60, p1Y, { continued: true });
    doc.font('Helvetica').text(data.companyName);

    doc.font('Helvetica-Bold').text('NÚMERO PATRONAL IVSS: ', 60, p1Y + 16, { continued: true });
    doc.font('Helvetica').text(data.ivssEmployerNumber);

    doc.font('Helvetica-Bold').text('Nº RIF: ', 330, p1Y + 16, { continued: true });
    doc.font('Helvetica').text(data.nativeId);

    doc.y = p1Y + 45;
    doc.moveDown(0.8);

    // 2. Datos del Asegurado
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text('PARTE 2: DATOS DEL ASEGURADO (TRABAJADOR)');
    doc.rect(50, doc.y + 2, 512, 60).fillAndStroke('#f8fafc', '#cbd5e1');
    const p2Y = doc.y + 8;
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('APELLIDOS Y NOMBRES: ', 60, p2Y, { continued: true });
    doc.font('Helvetica').text(data.employeeFullName);

    doc.font('Helvetica-Bold').text('CÉDULA DE IDENTIDAD: ', 60, p2Y + 16, { continued: true });
    doc.font('Helvetica').text(data.nationalId);

    doc.font('Helvetica-Bold').text('FECHA DE INGRESO: ', 60, p2Y + 32, { continued: true });
    doc.font('Helvetica').text(data.hireDate);

    doc.font('Helvetica-Bold').text('FECHA DE EGRESO (CESE): ', 330, p2Y + 32, { continued: true });
    doc.font('Helvetica').text(data.terminationDate);

    doc.y = p2Y + 60;
    doc.moveDown(0.8);

    // 3. Salario y Causa
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text('PARTE 3: DATOS DE LA RELACIÓN Y CAUSA DEL RETIRO');
    doc.rect(50, doc.y + 2, 512, 45).fillAndStroke('#f8fafc', '#cbd5e1');
    const p3Y = doc.y + 8;
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('ÚLTIMO SALARIO DEVENGADO: ', 60, p3Y, { continued: true });
    doc.font('Helvetica').text(`Bs. ${data.lastSalary.toFixed(2)}`);

    doc.font('Helvetica-Bold').text('MOTIVO DEL RETIRO: ', 60, p3Y + 16, { continued: true });
    doc.font('Helvetica').text(data.terminationReason.toUpperCase());

    doc.y = p3Y + 45;
    doc.moveDown(1.5);

    // Certificación
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#475569').text(
      'Certifico bajo fe de juramento que los datos suministrados en la presente declaración son exactos y corresponden fielmente a los registros contables y de personal de esta empresa.',
      { align: 'center' }
    );

    const sY = doc.y + 45;
    doc.lineWidth(0.8).strokeColor('#94a3b8').moveTo(70, sY).lineTo(250, sY).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text('FIRMA Y SELLO DEL PATRONO', 70, sY + 4, { width: 180, align: 'center' });

    doc.lineWidth(0.8).strokeColor('#94a3b8').moveTo(360, sY).lineTo(540, sY).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text('FIRMA DEL TRABAJADOR RETIRADO', 360, sY + 4, { width: 180, align: 'center' });

    doc.end();
  });
}
