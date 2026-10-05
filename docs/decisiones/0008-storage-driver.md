# ADR-0008 — Almacenamiento de documentos: driver con clave opaca, disco local por defecto

**Estado:** Aceptada (2026-09-27) — cierra la decisión abierta #4 de `modulos-y-hitos.md` · **Contexto:** `arquitectura.md` §3, `seguridad.md` §1 y §8, ADR-0004

## Contexto

El sistema almacena documentos del expediente, adjuntos de solicitudes, actas de activos y
PDFs generados (`modelo-datos.md`: `files`, `employee_documents`, `request_attachments`,
`asset_assignments`). ADR-0004 fija disco local por defecto y S3/MinIO como opcional para no
añadir dependencias a la instalación.

Lo que faltaba decidir era la **interfaz** y, sobre todo, la **frontera de seguridad**: quién
controla la ruta del archivo y cómo se evita que un documento del expediente quede servido como
estático. Es la clase de error más habitual en sistemas de RRHH auto-alojados: un `uploads/`
colgado del directorio público y un `document_types` que expone la cédula de alguien a quien
conoce la URL.

## Decisión

### 1. Interfaz por clave, no por ruta

El almacenamiento se accede siempre por una **clave opaca**; la lógica de negocio nunca ve ni
compone una ruta del sistema de archivos.

```
interface StorageDriver {
  put(input: { key: string; body: Readable; contentType: string }): Promise<StoredObject>
  get(key: string): Promise<Readable>          // para streaming al cliente
  getMetadata(key: string): Promise<ObjectMetadata>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}
```

El driver **`local`** guarda en `STORAGE_LOCAL_PATH`; el driver **`s3`** usa el mismo contrato.
Añadir MinIO más adelante es implementar la interfaz, no tocar la lógica de negocio.

### 2. Las claves se generan, no se reciben

- La clave se deriva de un **UUID v4** y la extensión validada contra una lista blanca:
  `ab/12/34/5678…-cedula.pdf` (prefijo de 2 caracteres = distribución en subdirectorios, para
  no acumular miles de entradas en un mismo directorio).
- **El nombre enviado por el cliente nunca forma parte de la clave.** Se guarda aparte en
  `files.original_name`, únicamente para mostrar y para el `Content-Disposition` de la descarga.
- Consecuencia: el path traversal (`../`) es **imposible por construcción**, no por un filtro
  que se pueda olvidar. La función que genera la clave no acepta entrada de usuario, y por eso
  la lógica de negocio tampoco puede pasar rutas.

### 3. El contenido se sirve por una ruta autenticada, nunca como estático

- `uploads/` **no** cuelga del directorio de estáticos ni del servidor web; la descarga pasa
  por un endpoint que valida sesión **y** autorización sobre el documento concreto
  (¿es su expediente? ¿es su carga familiar? ¿está en el mismo equipo?).
- Se responde con `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` y
  **el Content-Type derivado del contenido detectado, no del que envió el cliente**.

### 4. El tipo MIME se detecta por contenido, no por cabecera

`libmagic` (o los primeros bytes del archivo) decide la extensión. El `Content-Type` de la
petición sirve solo como pista y se valida contra la lista blanca. Esto cierra la vía clásica
de subir un `.php`, `.svg` con script o `.html` y lograr que se sirva como contenido activo.

Pendiente declarado: **antivirus** (ClamAV) para las cargas. En una instalación de 2 GB puede
no ser viable; queda como control opcional documentado, no como requisito. Hasta entonces, el
control es servir siempre como descarga con `nosniff` y nunca con el MIME del cliente.

### 5. Metadatos y verificación de integridad

`files` guarda: `key`, `original_name`, `content_type_detectado`, `size`, `sha256`,
`subido_por`, `created_at`, `deleted_at`. El `sha256` permite (a) detectar corrupción en el
backup y (b) sostener el `hash` de los libros legales (`legal_register_issues.hash`) como
evidencia de qué se emitió.

**Integridad de escritura:** la subida se escribe a un archivo temporal y se renombra al
completarse, para que un proceso interrumpido no deje un archivo truncado que después se
presenta como válido.

### 6. Cifrado en reposo: responsabilidad del volumen, con la excepción anotada

**No se cifra el archivo en la aplicación.** Se recomienda (y se documenta en
`instalacion.md`) montar `uploads/` en un volumen cifrado (LUKS). Motivo honesto: cifrar en
la aplicación implica derivar la clave de `SESSION_SECRET`, lo que ataría la capacidad de
leer los documentos a un archivo `.env` — **perder el `.env` perdería los expedientes**, un
riesgo operativo mayor que el que mitiga.

Excepción: si el volumen no está cifrado y la política del cliente lo exige, la **clave de
cifrado se separa** en una variable aparte (`STORAGE_ENCRYPTION_KEY`), con su propia política de
respaldo. Se decide al configurar la instalación, no por defecto.

### 7. El backup incluye `uploads/`

`seguridad.md` §8 y `instalacion.md` ya lo indicaban: la copia de seguridad son **dos** cosas
(Volcado de la BD **más** el directorio de documentos). Se refuerza aquí porque el fallo
típico de recuperación es restaurar la BD y olvidar los archivos, dejando expedientes sin
documento sin que nada lo indique.

## Alternativas descartadas

- **Guardar el binario en la BD (`bytea`):** simple en el backup, pero infla la base, impide
  servir por streaming y complica `pg_dump` en instalaciones grandes. Descartado.
- **Exponer `uploads/` como directorio estático:** es la opción que se descarta de forma
  explícita; elimina la autorización y expone documentos de salud y cédulas a quien conozca la
  ruta.
- **Guardar el nombre original como nombre de archivo:** condiciona a que el saneado de
  rutas sea perfecto en cada driver. La clave generada lo hace innecesario.

## Consecuencias

- (+) Los documentos no son accesibles sin pasar por sesión y autorización.
- (+) Path traversal e inyección de tipo de archivo resueltos en el diseño, no por validación.
- (+) Un segundo backend es una implementación de interfaz.
- (−) Streaming a través de la aplicación: más carga de Node que servir estáticos. Aceptable
  para el volumen esperado (≤5.000 trabajadores), y es justamente el precio de la
  autorización.
- (−) El antivirus queda como control opcional; se documenta la limitación en vez de
  ocultarla.

---

## 8. Ruta de adaptación a múltiples backends y proveedores (2026-10-05)

Confirmado por el sponsor como evolución futura. Nada de lo anterior cambia: la interfaz de §1
es el contrato, y los puntos 2–7 (clave generada, descarga autenticada, MIME por contenido,
metadatos en `files`, backup) son **independientes del backend**.

### Drivers contemplados

| Driver | Uso | Notas de implementación |
|---|---|---|
| `local` | Por defecto (auto-alojado) | Disco/volumen cifrado (`STORAGE_LOCAL_PATH`); claves con prefijo `ab/12/…`; escritura temporal + rename |
| `s3` | S3-compatible | Cubre **MinIO** (self-hosted), AWS S3, Wasabi, Backblaze B2, Cloudflare R2, etc. con el mismo código: `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` (ya esbozadas en `env.example`) |
| Otros (WebDAV, etc.) | Solo bajo demanda real | No se diseñan por adelantado; mientras exista un S3-compatible, cubren el 99% de los casos |

### Qué cambia y qué NO cambia al cambiar de backend

**NO cambia** (vive en la aplicación): validación por magic bytes, tope de tamaño, autorización
por documento en el endpoint de descarga, generación de la clave, metadatos y `sha256` en `files`.

**Cambia**: dónde caen los bytes. La descarga puede (a) seguir **streaming a través de la app**
(simple, mismo endpoint; recomendado) o (b) usar **URLs prefirmadas de vida corta** si el volumen
de descargas lo amerita — en ese caso el endpoint autenticado **redirige** a la URL firmada y la
expiración hace de límite de sesión secundario, nunca de control de acceso único.

### Estado de implementación (nota honesta)

El **demo** actual (adjuntos de dependientes y documentos probatorios) escribe directo a
`STORAGE_LOCAL_PATH` dentro de las propias rutas — un atajo del modo demo. La adaptación es
**extraer ese bloque a `createLocalStorageDriver(env)`** implementando la interfaz de §1 e
inyectarlo (`STORAGE_DRIVER`), sin tocar las rutas ni la validación. Con eso, el driver `s3`
es solo la segunda implementación. Tarea de M1a-producción junto con la tabla `files` real.

### Migración de backend ya instalado

Si una instalación cambia `local` → `s3`: exportar/importar los objetos por clave (las claves son
opacas y estables, así que la migración es copiar objetos con su clave; los metadatos en `files`
no cambian) + un comando `bin/storage-sync` con verificación por `sha256`.
