import { DomainError } from '../errors.js';

export type TipoIdentificador = 'persona_natural' | 'persona_juridica';
export type Confianza = 'alta' | 'media' | 'baja';

export interface PrefixRule {
  readonly prefijo: string;
  readonly tipo: TipoIdentificador;
  readonly significado: string;
  readonly longitudesDigitos: readonly number[];
  readonly confianza: Confianza;
}

export interface IdCatalog {
  readonly prefijos: readonly PrefixRule[];
  /** `false` mientras el catálogo no esté verificado contra la fuente oficial. */
  readonly verificado: boolean;
  readonly fechaConsulta: string;
}

export type ValidationFailureCode = 'formato' | 'prefijo_desconocido' | 'longitud';

export type NativeIdResult =
  | {
      readonly ok: true;
      readonly value: string;
      readonly prefijo: string;
      readonly tipo: TipoIdentificador;
      readonly verificado: boolean;
    }
  | {
      readonly ok: false;
      readonly code: ValidationFailureCode;
      readonly message: string;
      readonly verificado: boolean;
    };

const CON_SEPARADORES = /^[\s.\-_/]+$/;
const SIN_ALFANUMERICOS = /[^0-9A-Za-z]/g;
const LETRA_Y_DIGITOS = /^([A-Za-z])([0-9]+)$/;

function esRegistro(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null;
}

function esReglaPrefijoCruda(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return (
    esRegistro(valor) &&
    typeof valor.prefijo === 'string' &&
    typeof valor.tipo === 'string' &&
    Array.isArray(valor.longitudes_digitos)
  );
}

/** El dataset habla español (`longitudes_digitos`); el dominio trabaja en inglés. */
function aReglaPrefijo(valor: Readonly<Record<string, unknown>>): PrefixRule {
  return {
    prefijo: valor.prefijo as string,
    tipo: valor.tipo as TipoIdentificador,
    significado: typeof valor.significado === 'string' ? valor.significado : '',
    longitudesDigitos: (valor.longitudes_digitos as number[]).map((longitud) => Number(longitud)),
    confianza: (typeof valor.confianza === 'string' ? valor.confianza : 'baja') as Confianza,
  };
}

/** Valida el contrato del catálogo; un dataset roto debe fallar al arrancar, no en vivo. */
export function parseIdCatalog(crudo: unknown): IdCatalog {
  if (!esRegistro(crudo) || !Array.isArray(crudo.prefijos) || crudo.prefijos.length === 0) {
    throw new DomainError('catalogo_invalido', 'El catálogo de identificadores está vacío o mal formado');
  }
  const meta = esRegistro(crudo._meta) ? crudo._meta : {};
  if (!crudo.prefijos.every(esReglaPrefijoCruda)) {
    throw new DomainError('catalogo_invalido', 'Alguna regla de prefijo no cumple el contrato');
  }
  return {
    prefijos: crudo.prefijos.map(aReglaPrefijo),
    verificado: String(meta.verificacion ?? '').startsWith('VERIFICADO'),
    fechaConsulta: typeof meta.fecha_consulta === 'string' ? meta.fecha_consulta : 'desconocida',
  };
}

/** Forma canónica: prefijo + dígitos, sin separadores y con el prefijo en mayúsculas. */
export function normalizeNativeId(entrada: string): string {
  if (typeof entrada !== 'string' || entrada.trim() === '' || CON_SEPARADORES.test(entrada)) {
    throw new DomainError('identificador_invalido', 'El identificador está vacío', { entrada: String(entrada) });
  }
  const compacto = entrada.replace(SIN_ALFANUMERICOS, '').toUpperCase();
  const coincidencia = LETRA_Y_DIGITOS.exec(compacto);
  if (!coincidencia) {
    throw new DomainError('identificador_invalido', 'El identificador no tiene la forma prefijo + dígitos', {
      entrada,
    });
  }
  return `${coincidencia[1] ?? ''}${coincidencia[2] ?? ''}`;
}

function reglaDe(catalog: IdCatalog, prefijo: string): PrefixRule | undefined {
  return catalog.prefijos.find((regla) => regla.prefijo === prefijo);
}

/**
 * Valida prefijo y longitud contra el catálogo. **No** valida el dígito verificador
 * mientras el catálogo no esté verificado (ADR-0012): es peor rechazar una cédula
 * válida que aceptar una sucia.
 */
export function validateNativeId(entrada: string, catalog: IdCatalog): NativeIdResult {
  let canonico: string;
  try {
    canonico = normalizeNativeId(entrada);
  } catch (error) {
    return {
      ok: false,
      code: 'formato',
      message: error instanceof DomainError ? error.message : 'Identificador inválido',
      verificado: catalog.verificado,
    };
  }
  const prefijo = canonico[0] ?? '';
  const digitos = canonico.slice(1);
  const regla = reglaDe(catalog, prefijo);
  if (!regla) {
    return {
      ok: false,
      code: 'prefijo_desconocido',
      message: `Prefijo ${prefijo} no está en el catálogo`,
      verificado: catalog.verificado,
    };
  }
  if (!regla.longitudesDigitos.includes(digitos.length)) {
    return {
      ok: false,
      code: 'longitud',
      message: `El prefijo ${prefijo} no tiene ${digitos.length} dígitos en el catálogo`,
      verificado: catalog.verificado,
    };
  }
  return {
    ok: true,
    value: canonico,
    prefijo,
    tipo: regla.tipo,
    verificado: catalog.verificado,
  };
}
