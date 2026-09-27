import PDFDocument from 'pdfkit';

export interface AttendanceSheetPdfData {
  companyName: string;
  nativeId: string;
  departmentName: string;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  coordinatorName: string;
  verifiedByName?: string | undefined;
  rows: {
    cedula: string;
    fullName: string;
    days: {
      dayName: string;
      timeIn?: string | undefined;
      timeOut?: string | undefined;
      status: string;
      signed: boolean;
    }[];
    observations?: string | undefined;
  }[];
}

/**
 * Genera la Planilla Oficial de Asistencia Semanal por Departamento en PDF (formato horizontal).
 */
export function generateAttendanceSheetPdf(data: AttendanceSheetPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      layout: 'landscape',
      margins: { top: 35, bottom: 35, left: 35, right: 35 },
      info: {
        Title: `Planilla de Asistencia Semanal - Sem ${data.weekNumber} ${data.year} - ${data.departmentName}`,
        Author: data.companyName,
        Subject: 'Control de Asistencia Semanal LOTTT',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // 1. Membrete
    doc.fontSize(11).font('Helvetica-Bold').text(data.companyName.toUpperCase(), { align: 'center' });
    doc.fontSize(8.5).font('Helvetica').text(`RIF: ${data.nativeId}  •  DIRECCIÓN DE GESTIÓN HUMANA Y TALENTO`, { align: 'center' });
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0d47a1').text(
      'PLANILLA SEMANAL DE CONTROL DE ASISTENCIA Y PERMANENCIA',
      { align: 'center' },
    );
    doc.fillColor('#000000');
    doc.moveDown(0.5);

    // 2. Metadatos de la planilla
    const metaY = doc.y;
    doc.fontSize(8.5).font('Helvetica-Bold');
    doc.text(`Departamento / Unidad: `, 35, metaY, { continued: true });
    doc.font('Helvetica').text(data.departmentName);

    doc.font('Helvetica-Bold').text(`Semana N°: `, 35, metaY + 12, { continued: true });
    doc.font('Helvetica').text(`${data.weekNumber} (${data.year})  •  Período: ${data.startDate} al ${data.endDate}`);

    doc.font('Helvetica-Bold').text(`Coordinador Responsable: `, 450, metaY, { continued: true });
    doc.font('Helvetica').text(data.coordinatorName);

    doc.font('Helvetica-Bold').text(`Estado de Verificación: `, 450, metaY + 12, { continued: true });
    doc.font('Helvetica').text(data.verifiedByName ? `Verificado por ${data.verifiedByName}` : 'En Proceso / Pendiente por RRHH');

    doc.moveDown(1.5);

    // 3. Tabla de Trabajadores y Días
    const tableTop = doc.y + 5;
    const colWidths = {
      cedula: 65,
      nombre: 120,
      dia: 65, // x 7 días = 455
      obs: 80,
    };

    // Cabecera de la tabla
    doc.rect(35, tableTop, 722, 18).fillColor('#eceff1').fill();
    doc.strokeColor('#b0bec5').lineWidth(0.5).rect(35, tableTop, 722, 18).stroke();

    doc.fillColor('#263238').fontSize(7.5).font('Helvetica-Bold');
    doc.text('CÉDULA', 38, tableTop + 5, { width: colWidths.cedula });
    doc.text('TRABAJADOR', 103, tableTop + 5, { width: colWidths.nombre });

    const diasNombres = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
    let xOffset = 223;
    for (let i = 0; i < 7; i++) {
      doc.text(diasNombres[i]!, xOffset, tableTop + 5, { width: colWidths.dia, align: 'center' });
      xOffset += colWidths.dia;
    }
    doc.text('OBSERVACIONES', xOffset, tableTop + 5, { width: colWidths.obs, align: 'center' });

    let currentY = tableTop + 18;

    // Filas de trabajadores
    doc.font('Helvetica').fontSize(7);

    for (const row of data.rows) {
      if (currentY > 480) {
        doc.addPage();
        currentY = 40;
      }

      const rowHeight = 22;
      doc.strokeColor('#cfd8dc').rect(35, currentY, 722, rowHeight).stroke();

      doc.fillColor('#263238').font('Helvetica-Bold').text(row.cedula, 38, currentY + 6, { width: colWidths.cedula });
      doc.font('Helvetica').text(row.fullName, 103, currentY + 6, { width: colWidths.nombre });

      let dayX = 223;
      for (let d = 0; d < 7; d++) {
        const dayRecord = row.days[d];
        if (dayRecord) {
          if (dayRecord.status === 'asistio') {
            const timeText = `${dayRecord.timeIn || '—'} a ${dayRecord.timeOut || '—'}`;
            const signText = dayRecord.signed ? '✓ Fir' : '';
            doc.fontSize(6.5).text(`${timeText} ${signText}`, dayX, currentY + 4, {
              width: colWidths.dia,
              align: 'center',
            });
          } else if (dayRecord.status === 'falta_injustificada') {
            doc.fontSize(6.5).fillColor('#c62828').text('INASIST', dayX, currentY + 6, {
              width: colWidths.dia,
              align: 'center',
            });
            doc.fillColor('#263238');
          } else if (dayRecord.status === 'feriado') {
            doc.fontSize(6.5).fillColor('#1565c0').text('FERIADO', dayX, currentY + 6, {
              width: colWidths.dia,
              align: 'center',
            });
            doc.fillColor('#263238');
          } else if (dayRecord.status === 'reposo_ivss') {
            doc.fontSize(6.5).fillColor('#e65100').text('REPOSO', dayX, currentY + 6, {
              width: colWidths.dia,
              align: 'center',
            });
            doc.fillColor('#263238');
          } else {
            doc.fontSize(6.5).fillColor('#78909c').text(dayRecord.status.substring(0, 7).toUpperCase(), dayX, currentY + 6, {
              width: colWidths.dia,
              align: 'center',
            });
            doc.fillColor('#263238');
          }
        } else {
          doc.fontSize(6.5).fillColor('#90a4ae').text('—', dayX, currentY + 6, {
            width: colWidths.dia,
            align: 'center',
          });
          doc.fillColor('#263238');
        }
        dayX += colWidths.dia;
      }

      doc.fontSize(6.5).text(row.observations || 'Sin obs.', dayX + 2, currentY + 6, {
        width: colWidths.obs - 4,
        align: 'left',
      });

      currentY += rowHeight;
    }

    // 4. Bloque de Firmas y Validación
    const firmasY = Math.max(currentY + 25, 510);

    // Firma Coordinador
    doc.moveTo(80, firmasY).lineTo(280, firmasY).lineWidth(0.8).strokeColor('#000000').stroke();
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000').text('FIRMA DEL COORDINADOR(A)', 80, firmasY + 5, {
      width: 200,
      align: 'center',
    });
    doc.font('Helvetica').fontSize(7.5).text(data.coordinatorName, 80, firmasY + 16, {
      width: 200,
      align: 'center',
    });
    doc.fontSize(6.5).fillColor('#546e7a').text('Certifico el cumplimiento de los turnos semanales', 80, firmasY + 26, {
      width: 200,
      align: 'center',
    });

    // Firma Analista de Talento Humano
    doc.moveTo(480, firmasY).lineTo(680, firmasY).lineWidth(0.8).strokeColor('#000000').stroke();
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000').text('VERIFICADO POR TALENTO HUMANO', 480, firmasY + 5, {
      width: 200,
      align: 'center',
    });
    doc.font('Helvetica').fontSize(7.5).text(data.verifiedByName || 'Analista de Gestión Humana', 480, firmasY + 16, {
      width: 200,
      align: 'center',
    });
    doc.fontSize(6.5).fillColor('#546e7a').text('Cargado y validado en el sistema para nómina', 480, firmasY + 26, {
      width: 200,
      align: 'center',
    });

    doc.end();
  });
}
