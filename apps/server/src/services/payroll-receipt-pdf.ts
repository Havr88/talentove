import PDFDocument from 'pdfkit';
import type { PayrollCalculationResult } from '@talento-ve/domain';

export interface ReceiptPdfData {
  companyName: string;
  nativeId: string; // RIF
  receipt: PayrollCalculationResult;
  instanceName?: string;
}

export function generatePayrollReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { receipt, companyName, nativeId, instanceName } = data;
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 40, bottom: 40, left: 45, right: 45 },
      info: {
        Title: `Recibo de Pago - ${receipt.snapshot.fullName} - ${receipt.period.startDate}`,
        Author: companyName,
        Subject: 'Recibo Oficial de Nómina',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const startX = 45;
    const contentWidth = 522; // 612 - 90

    // 1. Membrete Institucional
    doc.fontSize(8).font('Helvetica-Bold').text('REPÚBLICA BOLIVARIANA DE VENEZUELA', { align: 'center' });
    doc.fontSize(8).font('Helvetica').text(`${companyName.toUpperCase()} — RIF: ${nativeId}`, { align: 'center' });
    if (instanceName) {
      doc.fontSize(7).text(instanceName.toUpperCase(), { align: 'center' });
    }
    doc.moveDown(0.5);

    // Título Recibo
    const periodLabel = receipt.period.periodType === 'primera_quincena'
      ? 'PRIMERA QUINCENA'
      : receipt.period.periodType === 'segunda_quincena'
      ? 'SEGUNDA QUINCENA'
      : 'MENSUAL';

    doc.rect(startX, doc.y, contentWidth, 22).fillAndStroke('#f1f5f9', '#cbd5e1');
    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
      .text(`RECIBO DE PAGO DE NÓMINA (${periodLabel})`, startX, doc.y - 17, {
        width: contentWidth,
        align: 'center',
      });
    doc.moveDown(0.8);

    // 2. Ficha de Datos del Trabajador y Periodo
    const infoY = doc.y;
    doc.rect(startX, infoY, contentWidth, 54).stroke('#cbd5e1');
    doc.fontSize(8).fillColor('#334155');

    const col1 = startX + 8;
    const col2 = startX + 260;

    doc.font('Helvetica-Bold').text('Cédula de Identidad:', col1, infoY + 6);
    doc.font('Helvetica').text(receipt.snapshot.cedula, col1 + 95, infoY + 6);

    doc.font('Helvetica-Bold').text('Trabajador:', col1, infoY + 18);
    doc.font('Helvetica').text(receipt.snapshot.fullName, col1 + 95, infoY + 18);

    doc.font('Helvetica-Bold').text('Cargo:', col1, infoY + 30);
    doc.font('Helvetica').text(receipt.snapshot.positionName, col1 + 95, infoY + 30);

    doc.font('Helvetica-Bold').text('Departamento:', col1, infoY + 42);
    doc.font('Helvetica').text(receipt.snapshot.departmentName, col1 + 95, infoY + 42);

    doc.font('Helvetica-Bold').text('Período Liquidado:', col2, infoY + 6);
    doc.font('Helvetica').text(`${receipt.period.startDate} al ${receipt.period.endDate}`, col2 + 90, infoY + 6);

    doc.font('Helvetica-Bold').text('Fecha Ingreso:', col2, infoY + 18);
    doc.font('Helvetica').text(receipt.snapshot.hireDate, col2 + 90, infoY + 18);

    doc.font('Helvetica-Bold').text('Antigüedad / Hijos:', col2, infoY + 30);
    doc.font('Helvetica').text(`${receipt.snapshot.seniorityYears} años servicio  |  ${receipt.snapshot.kidsCount} hijos`, col2 + 90, infoY + 30);

    doc.font('Helvetica-Bold').text('Tasa Ref. BCV:', col2, infoY + 42);
    doc.font('Helvetica').text(`${receipt.snapshot.exchangeRateBcv.toFixed(2)} Bs/USD`, col2 + 90, infoY + 42);

    doc.y = infoY + 62;

    // 3. Tabla Desglosada: Asignaciones vs Deducciones
    const tableTop = doc.y;
    const halfWidth = (contentWidth - 6) / 2;

    // Cabecera Asignaciones
    doc.rect(startX, tableTop, halfWidth, 18).fill('#e0f2fe');
    doc.fillColor('#0369a1').font('Helvetica-Bold').fontSize(8.5)
      .text('ASIGNACIONES / DEVENGOS', startX + 6, tableTop + 5, { width: halfWidth - 12 });

    // Cabecera Deducciones
    doc.rect(startX + halfWidth + 6, tableTop, halfWidth, 18).fill('#fee2e2');
    doc.fillColor('#b91c1c').font('Helvetica-Bold').fontSize(8.5)
      .text('DEDUCCIONES DE LEY Y RETENCIONES', startX + halfWidth + 12, tableTop + 5, { width: halfWidth - 12 });

    let currentY = tableTop + 22;
    doc.font('Helvetica').fontSize(8).fillColor('#1e293b');

    // Filas de Asignaciones
    const earningsList: { label: string; amount: string }[] = [
      { label: 'Sueldo Base del Período', amount: receipt.earnings.baseSalary.amount },
      { label: `Prima Profesionalización (${receipt.snapshot.educationLevel})`, amount: receipt.earnings.educationPremium.amount },
      { label: `Prima por Antigüedad (${receipt.snapshot.seniorityYears} años)`, amount: receipt.earnings.seniorityPremium.amount },
      { label: `Prima por Hijos (${receipt.snapshot.kidsCount})`, amount: receipt.earnings.kidsPremium.amount },
      { label: 'Cesta Ticket Socialista (LOTTT)', amount: receipt.earnings.cestaTicket.amount },
    ];
    if (parseFloat(receipt.earnings.overtimePay.amount) > 0) {
      earningsList.push({ label: 'Horas Extraordinarias Diurnas/Nocturnas', amount: receipt.earnings.overtimePay.amount });
    }
    if (parseFloat(receipt.earnings.nightBonusPay.amount) > 0) {
      earningsList.push({ label: 'Bono Nocturno', amount: receipt.earnings.nightBonusPay.amount });
    }

    let earnY = currentY;
    for (const earn of earningsList) {
      doc.text(earn.label, startX + 6, earnY, { width: halfWidth - 80 });
      doc.text(`${earn.amount} Bs`, startX + halfWidth - 70, earnY, { width: 65, align: 'right' });
      earnY += 14;
    }

    // Filas de Deducciones
    const deductionsList: { label: string; amount: string }[] = [
      { label: 'Seguro Social Obligatorio (IVSS 4%)', amount: receipt.deductions.ivss.amount },
      { label: 'Fondo Ahorro Obligatorio Vivienda (FAOV 1%)', amount: receipt.deductions.faov.amount },
      { label: 'Régimen Prestacional Empleo (SPF 0.5%)', amount: receipt.deductions.spf.amount },
    ];
    if (parseFloat(receipt.deductions.absenceDeduction.amount) > 0) {
      deductionsList.push({ label: 'Deducción por Ausencias Injustificadas', amount: receipt.deductions.absenceDeduction.amount });
    }
    if (parseFloat(receipt.deductions.otherDeductions.amount) > 0) {
      deductionsList.push({ label: 'Otras Retenciones / Anticipos', amount: receipt.deductions.otherDeductions.amount });
    }

    let dedY = currentY;
    for (const ded of deductionsList) {
      doc.text(ded.label, startX + halfWidth + 12, dedY, { width: halfWidth - 80 });
      doc.text(`${ded.amount} Bs`, startX + contentWidth - 70, dedY, { width: 65, align: 'right' });
      dedY += 14;
    }

    const maxItemsY = Math.max(earnY, dedY, currentY + 95);

    // Bordes de la tabla
    doc.rect(startX, tableTop, halfWidth, maxItemsY - tableTop).stroke('#cbd5e1');
    doc.rect(startX + halfWidth + 6, tableTop, halfWidth, maxItemsY - tableTop).stroke('#cbd5e1');

    doc.y = maxItemsY + 6;

    // 4. Totales
    const totalsY = doc.y;
    doc.rect(startX, totalsY, halfWidth, 22).fill('#f8fafc');
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a')
      .text('Total Asignaciones:', startX + 6, totalsY + 6);
    doc.text(`${receipt.earnings.totalEarnings.amount} Bs`, startX + halfWidth - 75, totalsY + 6, { width: 70, align: 'right' });

    doc.rect(startX + halfWidth + 6, totalsY, halfWidth, 22).fill('#f8fafc');
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a')
      .text('Total Deducciones:', startX + halfWidth + 12, totalsY + 6);
    doc.text(`${receipt.deductions.totalDeductions.amount} Bs`, startX + contentWidth - 75, totalsY + 6, { width: 70, align: 'right' });

    // Neto a Cobrar Destacado
    const netY = totalsY + 28;
    doc.rect(startX, netY, contentWidth, 26).fillAndStroke('#ecfdf5', '#10b981');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#065f46')
      .text('NETO A COBRAR:', startX + 12, netY + 7);
    doc.fontSize(11)
      .text(`${receipt.netPay.amount} ${receipt.netPay.currency}  (Aprox. $${receipt.netPayUsdEquivalent.toFixed(2)} USD)`, startX, netY + 7, { width: contentWidth - 16, align: 'right' });

    // 5. Aportes Patronales (Informativo de Ley)
    doc.y = netY + 36;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748b')
      .text('APORTES PATRONALES (INFORMATIVO DE LEY VENEZOLANA — NO DEDUCIBLE DEL TRABAJADOR):', startX);
    doc.font('Helvetica').fontSize(7.5);
    const patronalText = `IVSS (10%): ${receipt.statutory.ivssEmployer.amount} Bs  |  FAOV (2%): ${receipt.statutory.faovEmployer.amount} Bs  |  SPF (2%): ${receipt.statutory.spfEmployer.amount} Bs`;
    doc.text(`${patronalText}  |  TOTAL PATRONAL: ${receipt.statutory.totalEmployerContributions.amount} Bs`, startX, doc.y + 2);

    // 6. Firmas y Conformidad
    const signY = doc.y + 45;
    doc.strokeColor('#94a3b8');

    // Firma Trabajador
    doc.moveTo(startX + 20, signY).lineTo(startX + 200, signY).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#334155')
      .text('CONFORME TRABAJADOR', startX + 20, signY + 4, { width: 180, align: 'center' });
    doc.font('Helvetica').fontSize(7)
      .text('C.I. ' + receipt.snapshot.cedula, startX + 20, signY + 15, { width: 180, align: 'center' });

    // Firma RRHH y Sello
    doc.moveTo(startX + 320, signY).lineTo(startX + 500, signY).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#334155')
      .text('GERENCIA DE GESTIÓN HUMANA', startX + 320, signY + 4, { width: 180, align: 'center' });
    doc.font('Helvetica').fontSize(7)
      .text('Firma y Sello Digital Autorizado', startX + 320, signY + 15, { width: 180, align: 'center' });

    // 7. Pie de Página de Seguridad y Verificación
    doc.fontSize(6.5).font('Helvetica').fillColor('#94a3b8')
      .text(
        `Documento generado electrónicamente por TalentoVe. Snapshot inmutable id: ${receipt.snapshot.employeeId}-${receipt.period.startDate}. Fecha de emisión: ${receipt.snapshot.calculatedAt}`,
        startX,
        doc.page.height - 30,
        { width: contentWidth, align: 'center' }
      );

    doc.end();
  });
}
