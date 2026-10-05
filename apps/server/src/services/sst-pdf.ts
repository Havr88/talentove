import PDFDocument from 'pdfkit';

export interface SstRiskNotificationData {
  companyName: string;
  nativeId: string;
  employeeFullName: string;
  nationalId: string;
  positionTitle: string;
  orgUnitName: string;
  hireDate: string;
  risksIdentified: string[];
  preventiveMeasures: string[];
  eppAssigned?: string[];
  acknowledgedAt?: string | undefined;
  id: string;
}

export function generateSstRiskPdf(data: SstRiskNotificationData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Notificación de Riesgos LOPCYMAT - ${data.employeeFullName}`,
        Author: data.companyName,
        Subject: 'Notificación de Principios de Prevención y Riesgos Laborales (Art. 56 LOPCYMAT)',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Membrete
    doc.font('Helvetica-Bold').fontSize(11).text('REPÚBLICA BOLIVARIANA DE VENEZUELA', { align: 'center' });
    doc.text(data.companyName.toUpperCase(), { align: 'center' });
    doc.font('Helvetica').fontSize(9).text(`RIF: ${data.nativeId} | SISTEMA DE GESTIÓN SST / LOPCYMAT`, { align: 'center' });
    doc.moveDown(0.8);

    doc.lineWidth(1.5).strokeColor('#0284c7').moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(1);

    // Título Principal
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text(
      'NOTIFICACIÓN DE RIESGOS POR PUESTO DE TRABAJO',
      { align: 'center' }
    );
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569').text(
      'DERECHO A SABER Y CONDICIONES INSEGURAS O INSALUBRES (ART. 56 LOPCYMAT & ART. 53 REG. LOPCYMAT)',
      { align: 'center' }
    );
    doc.moveDown(1);

    // Identificación del Trabajador
    doc.rect(50, doc.y, 512, 60).fillAndStroke('#f8fafc', '#cbd5e1');
    const startBoxY = doc.y + 8;
    doc.fillColor('#0f172a').fontSize(9);
    doc.font('Helvetica-Bold').text('TRABAJADOR(A): ', 60, startBoxY, { continued: true });
    doc.font('Helvetica').text(data.employeeFullName);

    doc.font('Helvetica-Bold').text('CÉDULA DE IDENTIDAD: ', 60, startBoxY + 16, { continued: true });
    doc.font('Helvetica').text(data.nationalId);

    doc.font('Helvetica-Bold').text('CARGO / OCUPACIÓN: ', 320, startBoxY, { continued: true });
    doc.font('Helvetica').text(data.positionTitle);

    doc.font('Helvetica-Bold').text('DEPARTAMENTO: ', 320, startBoxY + 16, { continued: true });
    doc.font('Helvetica').text(data.orgUnitName);

    doc.font('Helvetica-Bold').text('FECHA DE NOTIFICACIÓN: ', 60, startBoxY + 32, { continued: true });
    doc.font('Helvetica').text(data.acknowledgedAt || new Date().toISOString().slice(0, 10));

    doc.y = startBoxY + 50;
    doc.moveDown(0.8);

    // Preámbulo Legal
    doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#334155').text(
      'En cumplimiento con el Numeral 3 del Artículo 56 de la Ley Orgánica de Prevención, Condiciones y Medio Ambiente de Trabajo (LOPCYMAT), se hace constar que el trabajador ha sido debidamente instruido y notificado respecto a los riesgos a los cuales estará expuesto en el desempeño de sus labores, así como los métodos de prevención y mitigación aplicables:',
      { align: 'justify' }
    );
    doc.moveDown(0.8);

    // Tabla de Riesgos y Medidas
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0f172a').text('1. RIESGOS INHERENTES IDENTIFICADOS');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(8.5).fillColor('#1e293b');
    for (const risk of data.risksIdentified) {
      doc.text(` •  ${risk}`);
    }
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0f172a').text('2. MEDIDAS PREVENTIVAS Y NORMAS DE SEGURIDAD');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(8.5).fillColor('#1e293b');
    for (const measure of data.preventiveMeasures) {
      doc.text(` •  ${measure}`);
    }
    doc.moveDown(0.6);

    if (data.eppAssigned && data.eppAssigned.length > 0) {
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0f172a').text('3. EQUIPOS DE PROTECCIÓN PERSONAL ASIGNADOS');
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(8.5).fillColor('#1e293b');
      for (const epp of data.eppAssigned) {
        doc.text(` •  ${epp}`);
      }
      doc.moveDown(0.6);
    }

    // Declaración y Firmas
    doc.rect(50, doc.y, 512, 105).stroke('#cbd5e1');
    const declY = doc.y + 6;
    doc.fontSize(7.5).font('Helvetica').fillColor('#475569').text(
      'DECLARACIÓN DEL TRABAJADOR: Declaro haber recibido por escrito y mediante inducción verbal la descripción clara y detallada de los riesgos específicos de mi puesto de trabajo, comprometiéndome a cumplir estrictamente con los procedimientos de seguridad y utilizar adecuadamente los equipos provistos.',
      60,
      declY,
      { width: 492, align: 'justify' }
    );

    const signY = declY + 45;
    // Firma trabajador
    doc.lineWidth(0.8).strokeColor('#94a3b8').moveTo(80, signY + 30).lineTo(250, signY + 30).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text('FIRMA DEL TRABAJADOR', 80, signY + 34, { width: 170, align: 'center' });
    doc.font('Helvetica').fontSize(7.5).text(`C.I.: ${data.nationalId}`, 80, signY + 44, { width: 170, align: 'center' });

    // Firma SST / Coordinador
    doc.lineWidth(0.8).strokeColor('#94a3b8').moveTo(350, signY + 30).lineTo(520, signY + 30).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text('POR SEGURIDAD Y SALUD LABORAL', 350, signY + 34, { width: 170, align: 'center' });
    doc.font('Helvetica').fontSize(7.5).text(data.companyName, 350, signY + 44, { width: 170, align: 'center' });

    doc.end();
  });
}
