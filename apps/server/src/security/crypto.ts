import { createHash, createHmac, hkdfSync, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

/**
 * Deriva una clave secundaria usando HKDF a partir del secreto maestro SESSION_SECRET.
 * Contextos separados (ADR-0007) para que las claves nunca coincidan.
 */
export function deriveKey(masterSecret: string, context: string, length = 32): Buffer {
  return Buffer.from(
    hkdfSync('sha256', Buffer.from(masterSecret), Buffer.from('talento-ve-salt'), Buffer.from(context), length),
  );
}

/**
 * Genera un token de sesión opaco de 256 bits (32 bytes aleatorios en hex).
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Calcula el hash SHA-256 del token opaco de sesión para persistencia en base de datos.
 * En la BD nunca vive el token en claro (ADR-0007).
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Genera un hash seguro de contraseña usando scrypt con sal criptográfica aleatoria.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifica una contraseña contra un hash almacenado (formato sal:hash).
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, keyHex] = stored.split(':');
  if (!salt || !keyHex) return false;
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(keyBuffer, derivedKey);
}

/**
 * Genera un token CSRF HMAC-SHA256 vinculado a la sesión y derivado con HKDF.
 */
export function generateCsrfToken(sessionId: string, masterSecret: string): string {
  const csrfKey = deriveKey(masterSecret, 'csrf-protection-v1', 32);
  const hmac = createHmac('sha256', csrfKey);
  hmac.update(sessionId);
  return hmac.digest('hex');
}

/**
 * Verifica la validez del token CSRF recibido contra el ID de sesión activo.
 */
export function verifyCsrfToken(token: string, sessionId: string, masterSecret: string): boolean {
  if (!token || !sessionId) return false;
  const expected = generateCsrfToken(sessionId, masterSecret);
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(tokenBuf, expectedBuf);
}
