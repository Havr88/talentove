export type DomainErrorCode =
  | 'moneda_invalida'
  | 'importe_invalido'
  | 'escala_invalida'
  | 'escala_fuera_de_rango'
  | 'operacion_entre_monedas'
  | 'tasa_invalida'
  | 'tipo_fuente_no_admitido'
  | 'fecha_invalida'
  | 'hora_invalida'
  | 'zona_horaria_invalida'
  | 'periodo_invalido'
  | 'turno_invalido'
  | 'identificador_invalido'
  | 'catalogo_invalido';

/**
 * Error de dominio: código estable para la API y mensaje en es-VE para la interfaz.
 * Los códigos son parte del contrato con el cliente; los mensajes no.
 */
export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details: Readonly<Record<string, string | number | boolean>>;

  constructor(
    code: DomainErrorCode,
    message: string,
    details: Readonly<Record<string, string | number | boolean>> = {},
  ) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}
