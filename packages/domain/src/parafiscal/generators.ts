import type {
  GeneratedParafiscalFile,
  ParafiscalCompanyHeader,
  ParafiscalWorkerEntry,
} from './types.js';

/**
 * Generador de archivo de cotización mensual para el sistema TIUNA del IVSS.
 * Formato estándar de carga de salarios y cotizaciones.
 */
export function generateTiunaIvssTxt(
  header: ParafiscalCompanyHeader,
  workers: ParafiscalWorkerEntry[]
): GeneratedParafiscalFile {
  const cleanRif = header.companyRif.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const patronal = header.ivssPatronalNumber.replace(/\D/g, '').padStart(9, '0');
  const mm = header.periodMonth.toString().padStart(2, '0');
  const yyyy = header.periodYear.toString();

  let totalWorkerDed = 0;
  let totalEmployerContr = 0;

  const lines: string[] = [];
  // Cabecera TIUNA
  lines.push(`TIUNA|${cleanRif}|${patronal}|${yyyy}${mm}|${workers.length}`);

  // Detalle por trabajador
  workers.forEach((w) => {
    const doc = `${w.cedulaTipo}${w.cedulaNumero.replace(/\D/g, '').padStart(9, '0')}`;
    const wDed = parseFloat(w.ivssWorkerDeduction.amount);
    const empContr = parseFloat(w.ivssEmployerContribution.amount);
    totalWorkerDed += wDed;
    totalEmployerContr += empContr;

    const salaryStr = parseFloat(w.baseSalary.amount).toFixed(2);
    const wDedStr = wDed.toFixed(2);
    const empContrStr = empContr.toFixed(2);
    const totalIvssStr = (wDed + empContr).toFixed(2);
    const safeName = w.fullName.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 40);

    lines.push(`${doc}|${safeName}|${w.hireDate}|${salaryStr}|${wDedStr}|${empContrStr}|${totalIvssStr}`);
  });

  const totalAll = totalWorkerDed + totalEmployerContr;
  const fileName = `TIUNA_${patronal}_${yyyy}${mm}.txt`;

  return {
    type: 'IVSS_TIUNA',
    fileName,
    content: lines.join('\r\n'),
    totalWorkers: workers.length,
    totalWorkerDeductionsVES: totalWorkerDed.toFixed(2),
    totalEmployerContributionsVES: totalEmployerContr.toFixed(2),
    totalContributionVES: totalAll.toFixed(2),
  };
}

/**
 * Generador de archivo de declaración mensual para el portal BANAVIH (FAOV en Línea).
 * Formato CSV/TXT oficial delimitado por punto y coma (;)
 */
export function generateFaovBanavihTxt(
  header: ParafiscalCompanyHeader,
  workers: ParafiscalWorkerEntry[]
): GeneratedParafiscalFile {
  const cleanRif = header.companyRif.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const banavihCode = header.banavihNumber || '00000000';
  const mm = header.periodMonth.toString().padStart(2, '0');
  const yyyy = header.periodYear.toString();

  let totalWorkerFaov = 0;
  let totalEmployerFaov = 0;

  const lines: string[] = [];
  // Cabecera informativa BANAVIH
  lines.push(`H;${cleanRif};${banavihCode};${yyyy};${mm};${workers.length}`);

  // Detalles BANAVIH: RIF_PATRONO;NACIONALIDAD;CEDULA;NOMBRE;SUELDO_INTEGRAL;RETENCION_1%;APORTE_2%;TOTAL_3%
  workers.forEach((w) => {
    const cedulaOnly = w.cedulaNumero.replace(/\D/g, '');
    const salary = parseFloat(w.totalEarnings.amount);
    const wFaov = parseFloat(w.faovWorkerDeduction.amount);
    const empFaov = parseFloat(w.faovEmployerContribution.amount);
    const tot = wFaov + empFaov;

    totalWorkerFaov += wFaov;
    totalEmployerFaov += empFaov;

    const safeName = w.fullName.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 40);

    lines.push(
      `${cleanRif};${w.cedulaTipo};${cedulaOnly};${safeName};${salary.toFixed(2)};${wFaov.toFixed(2)};${empFaov.toFixed(2)};${tot.toFixed(2)}`
    );
  });

  const grandTotal = totalWorkerFaov + totalEmployerFaov;
  const fileName = `FAOV_${cleanRif}_${yyyy}${mm}.txt`;

  return {
    type: 'FAOV_BANAVIH',
    fileName,
    content: lines.join('\r\n'),
    totalWorkers: workers.length,
    totalWorkerDeductionsVES: totalWorkerFaov.toFixed(2),
    totalEmployerContributionsVES: totalEmployerFaov.toFixed(2),
    totalContributionVES: grandTotal.toFixed(2),
  };
}

/**
 * Generador de informe consolidado INCES (2% Patronal sobre salarios).
 */
export function generateIncesSummary(
  header: ParafiscalCompanyHeader,
  workers: ParafiscalWorkerEntry[]
): GeneratedParafiscalFile {
  const cleanRif = header.companyRif.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const mm = header.periodMonth.toString().padStart(2, '0');
  const yyyy = header.periodYear.toString();

  let totalSalaries = 0;
  for (const w of workers) {
    totalSalaries += parseFloat(w.totalEarnings.amount);
  }

  // INCES Patronal: 2% sobre el total de sueldos y salarios
  const incesEmployer = totalSalaries * 0.02;

  const content = [
    `REPORTE OFICIAL DE APORTE INCES (LEY DEL INCES)`,
    `EMPRESA / ENTE: ${header.companyName}`,
    `RIF: ${cleanRif}`,
    `PERÍODO FISCAL: ${mm}/${yyyy}`,
    `TOTAL TRABAJADORES COTIZANTES: ${workers.length}`,
    `TOTAL NÓMINA PAGADA: ${totalSalaries.toFixed(2)} VES`,
    `APORTE PATRONAL OBLIGATORIO (2%): ${incesEmployer.toFixed(2)} VES`,
    `APORTE LABORAL (0.5% SOBRE UTILIDADES ANUALES): 0.00 VES (Solo aplicable en finiquito/utilidades)`,
    `TOTAL A ENTERAR ANTE EL INCES: ${incesEmployer.toFixed(2)} VES`,
  ].join('\r\n');

  const fileName = `INCES_${cleanRif}_${yyyy}${mm}.txt`;

  return {
    type: 'INCES_RESUMEN',
    fileName,
    content,
    totalWorkers: workers.length,
    totalWorkerDeductionsVES: '0.00',
    totalEmployerContributionsVES: incesEmployer.toFixed(2),
    totalContributionVES: incesEmployer.toFixed(2),
  };
}
