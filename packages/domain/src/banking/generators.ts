import { createHash } from 'node:crypto';
import type {
  BankPaymentBatchInput,
  BankPaymentBeneficiary,
  GeneratedBankFile,
  VenezuelanBankCode,
} from './types.js';

/**
 * Limpia y normaliza el número de cuenta eliminando guiones o espacios.
 * Debe tener exactamente 20 dígitos.
 */
export function cleanAccountNumber(acc: string): string {
  const cleaned = acc.replace(/\D/g, '');
  if (cleaned.length !== 20) {
    throw new Error(`Número de cuenta bancaria inválido: "${acc}". Debe tener exactamente 20 dígitos.`);
  }
  return cleaned;
}

/**
 * Convierte un monto en string decimal a centavos enteros en string con ceros a la izquierda.
 * Ejemplo: "1250.50" -> 125050
 */
export function amountToCents(amountStr: string, padLength = 13): string {
  const num = Math.round(parseFloat(amountStr) * 100);
  return num.toString().padStart(padLength, '0');
}

export function sanitizeAscii(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '');
}

/**
 * Generador de archivo de pago de nómina para Banco de Venezuela (BDV - 0102).
 * Estándar de dispersión en cuentas nómina del Banco de Venezuela.
 */
export function generateBdvTxt(input: BankPaymentBatchInput): string {
  const { header, beneficiaries } = input;
  const cleanDebit = cleanAccountNumber(header.debitAccountNumber);
  const dateFormatted = header.paymentDate.replace(/-/g, ''); // YYYYMMDD

  let totalCents = 0;
  for (const b of beneficiaries) {
    totalCents += Math.round(parseFloat(b.amount.amount) * 100);
  }
  const totalCentsStr = totalCents.toString().padStart(15, '0');
  const totalRecordsStr = beneficiaries.length.toString().padStart(6, '0');

  const cleanRif = header.companyRif.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  // Línea 1: Registro de Cabecera (Control de Lote)
  const headerLine = `H|${cleanRif}|${cleanDebit}|${dateFormatted}|${totalRecordsStr}|${totalCentsStr}|${sanitizeAscii(header.paymentConcept).slice(0, 30).padEnd(30, ' ')}`;

  // Líneas de Detalle: Una por cada beneficiario
  const detailLines = beneficiaries.map((b, idx) => {
    const cleanCredit = cleanAccountNumber(b.accountNumber);
    const docType = b.cedulaTipo.toUpperCase();
    const docNum = b.cedulaNumero.replace(/\D/g, '').padStart(9, '0');
    const centsStr = amountToCents(b.amount.amount, 13);
    const seq = (idx + 1).toString().padStart(6, '0');
    const safeName = sanitizeAscii(b.fullName).slice(0, 35).padEnd(35, ' ');
    return `D|${seq}|${docType}${docNum}|${cleanCredit}|${centsStr}|${safeName}|${cleanDebit.slice(0, 4)}`;
  });

  return [headerLine, ...detailLines].join('\r\n');
}

/**
 * Generador de archivo de nómina para Banesco (0134).
 * Formato estándar de multipagos Banesco.
 */
export function generateBanescoTxt(input: BankPaymentBatchInput): string {
  const { header, beneficiaries } = input;
  const cleanDebit = cleanAccountNumber(header.debitAccountNumber);
  const dateFormatted = header.paymentDate.replace(/-/g, '');

  let totalCents = 0;
  for (const b of beneficiaries) {
    totalCents += Math.round(parseFloat(b.amount.amount) * 100);
  }
  const totalAmountStr = (totalCents / 100).toFixed(2).replace('.', ',');

  const lines: string[] = [];
  // Cabecera Banesco
  lines.push(`01${cleanDebit}${dateFormatted}${beneficiaries.length.toString().padStart(5, '0')}${totalAmountStr.padStart(15, '0')}`);

  // Detalles Banesco
  beneficiaries.forEach((b) => {
    const cleanCredit = cleanAccountNumber(b.accountNumber);
    const docType = b.cedulaTipo.toUpperCase();
    const docNum = b.cedulaNumero.replace(/\D/g, '').padStart(9, '0');
    const amountFormatted = parseFloat(b.amount.amount).toFixed(2).replace('.', ',').padStart(15, '0');
    const safeName = b.fullName.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 30).padEnd(30, ' ');
    lines.push(`02${cleanCredit}${docType}${docNum}${amountFormatted}${safeName}`);
  });

  return lines.join('\r\n');
}

/**
 * Generador de archivo para Mercantil Banco (0105).
 */
export function generateMercantilTxt(input: BankPaymentBatchInput): string {
  const { header, beneficiaries } = input;
  const cleanDebit = cleanAccountNumber(header.debitAccountNumber);
  const cleanRif = header.companyRif.replace(/[^A-Za-z0-9]/g, '').toUpperCase().padStart(12, '0');

  const lines: string[] = [];
  // Cabecera Mercantil
  lines.push(`000105${cleanRif}${cleanDebit}${header.paymentDate.replace(/-/g, '')}`);

  beneficiaries.forEach((b, idx) => {
    const cleanCredit = cleanAccountNumber(b.accountNumber);
    const docType = b.cedulaTipo.toUpperCase();
    const docNum = b.cedulaNumero.replace(/\D/g, '').padStart(9, '0');
    const cents = amountToCents(b.amount.amount, 11);
    const seq = (idx + 1).toString().padStart(5, '0');
    lines.push(`01${seq}${docType}${docNum}${cleanCredit}${cents}`);
  });

  return lines.join('\r\n');
}

/**
 * Generador de archivo para BBVA Provincial (0108).
 */
export function generateProvincialTxt(input: BankPaymentBatchInput): string {
  const { header, beneficiaries } = input;
  const cleanDebit = cleanAccountNumber(header.debitAccountNumber);
  const lines: string[] = [];

  beneficiaries.forEach((b) => {
    const cleanCredit = cleanAccountNumber(b.accountNumber);
    const doc = `${b.cedulaTipo.toUpperCase()}${b.cedulaNumero.replace(/\D/g, '').padStart(9, '0')}`;
    const cents = amountToCents(b.amount.amount, 13);
    const name = sanitizeAscii(b.fullName).slice(0, 30).padEnd(30, ' ');
    lines.push(`${cleanDebit}|${cleanCredit}|${doc}|${cents}|${name}`);
  });

  return lines.join('\r\n');
}

export const BANK_NAMES: Record<VenezuelanBankCode, string> = {
  '0102': 'Banco de Venezuela',
  '0134': 'Banesco Banco Universal',
  '0105': 'Mercantil Banco',
  '0108': 'BBVA Provincial',
  '0114': 'Bancaribe',
  '0115': 'Banco Exterior',
  '0163': 'Banco del Tesoro',
  '0172': 'Bancamiga',
  '0175': 'Banco Bicentenario',
  '0191': 'Banco Nacional de Crédito (BNC)',
};

/**
 * Genera el archivo bancario adecuado según el código bancario solicitado.
 */
export function generateBankPaymentFile(bankCode: VenezuelanBankCode, input: BankPaymentBatchInput): GeneratedBankFile {
  let content = '';
  const bankName = BANK_NAMES[bankCode] || 'Banco Venezolano';
  const dateStr = input.header.paymentDate.replace(/-/g, '');

  switch (bankCode) {
    case '0102':
      content = generateBdvTxt(input);
      break;
    case '0134':
      content = generateBanescoTxt(input);
      break;
    case '0105':
      content = generateMercantilTxt(input);
      break;
    case '0108':
      content = generateProvincialTxt(input);
      break;
    default:
      content = generateBdvTxt(input);
      break;
  }

  let totalNum = 0;
  for (const b of input.beneficiaries) {
    totalNum += parseFloat(b.amount.amount);
  }

  const hash = createHash('sha256').update(content, 'utf8').digest('hex');
  const fileName = `nomina_${bankCode}_${dateStr}_${input.header.batchId.slice(0, 8)}.txt`;

  return {
    bankCode,
    bankName,
    fileName,
    content,
    totalRecords: input.beneficiaries.length,
    totalAmountVES: totalNum.toFixed(2),
    hash,
  };
}
