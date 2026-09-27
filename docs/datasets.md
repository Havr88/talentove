# Datasets del proyecto

> Estado: v1.0 (2026-09-26). Catálogo de datasets versionados en `data/` del repo, disponibles para seeds de PostgreSQL y validación en `packages/domain`. Principio: **los datos de referencia viven en el repo como datasets versionados con fuente y fecha** — los seeds de las migraciones se generan a partir de aquí.

## 1. `data/ve/bancos.json` — Instituciones financieras de Venezuela

**Qué contiene:** 27 instituciones con `codigo` (SUDEBAN, 4 dígitos), `nombre`, `rif` y `sector` (`estatal`/`privado`, heurística por prefijo de RIF: G=estatal, J=privado). Metadatos en `_meta` (fuente, fecha de consulta 2026-09-26, notas de verificación).

**Fuente:** [Alfonzzoj/bancos-venezuela-codigos](https://github.com/Alfonzzoj/bancos-venezuela-codigos) (actualización 2026-07-10), cotejado con la tabla de códigos de [Wikipedia/SUDEBAN](https://es.wikipedia.org) y el [BCV](https://www.bcv.org.ve). Notas: no incluye logos (derechos de terceros); SUDEBAN no publica JSON oficial — re-verificar contra SUDEBAN en producción; revisar fusiones/liquidaciones (el sistema bancario VE cambia con frecuencia).

**Secciones que lo consumen:**

| Consumidor | Uso |
|---|---|
| `bank_accounts` (expediente, M1a) | Selector de banco en cuentas del trabajador; **validador de cuenta**: 20 dígitos donde los primeros 4 = `codigo` del dataset |
| `bank_payment_files` (nómina, M2b) | Adaptadores bancarios paramétricos: cada layout lleva el código del banco emisor y valida los bancos destino contra el dataset |
| Pago Móvil C2P / datos de pago (M2b+) | Código de banco de 4 dígitos en formularios y conciliaciones |
| Reportes de nómina | Nombre/RIF del banco pagador en recibos y archivos |

**Sembrado:** migración M1a crea `financial_institutions` y siembra desde este JSON (una fila por institución); las FKs usan `codigo` como clave natural. Nueva institución = nueva entrada del dataset + seed versionado (nunca edición manual en producción).

## 2. `data/ve/cargos.json` — Catálogo semilla de cargos

**Qué contiene:** 66 denominaciones de cargos comunes en Venezuela con `categoria` (gerencia, coordinación, talento_humano, administración, finanzas, tecnología, logística, ventas, legal, operativo_calificado, operativo_elemental, transporte, seguridad, docencia, salud), `grupo_isco` (grupos mayores 1–9 de la [ISCO-08 en español, OIT](https://www.ilo.org/public/english/bureau/stat/isco/isco08/)), `aplica_sector` y `nivel_tabulador_apn` opcional (mapea a la Tabla 3/3.1 de la APN, §5.1 de `regionalizacion-venezuela.md`).

**Semillas editables (política clave):** el dataset es un **punto de partida, no un catálogo fijo**. En producción:
- El admin puede **crear, editar, renombrar, activar/desactivar y eliminar** cargos libremente (CRUD de `positions`).
- El re-seed **solo inserta cargos cuyo nombre no exista**; jamás sobrescribe ediciones del usuario.
- Importación masiva de cargos por Excel/CSV (parte de la carga masiva M1a).
- Para el régimen público (M4): curar la nomenclatura de la APN a partir del [Sistema de Clasificación de Cargos (Decreto N° 6.055)](https://vlexvenezuela.com/tags/sistema-clasificacion-cargos-administracion-publica-660870) y los [clasificadores de ONAPRE](http://www.onapre.gob.ve/index.php/publicaciones/descargas/viewcategory/30-clasificadores-presupuestarios) (documentos, no datasets — requiere curación manual); ampliación masiva opcional con el dataset [ESCO en español](https://esco.ec.europa.eu) (CSV, ~2.942 ocupaciones mapeadas a ISCO-08).

**Secciones que lo consumen:** `positions` (M1a), selector de cargo al crear asignaciones y contratos, ATS (vacantes por cargo, M3), carga masiva (validación de denominaciones sugeridas).

## 3. `data/ve/tipos-personal.json` — Tipos de personal

**Qué contiene:** 30 tipos de personal que combinan la nomenclatura APN (obrero fijo/contratado, administrativo/técnico/profesional fijo y contratado, **Alto Nivel**, **Libre Nombramiento y Remoción**, confianza, docente fijo/contratado/interino, militar FANB) con las clasificaciones de la LOTTT (permanente, determinado, obra, eventual, estacional, ocasional, tiempo parcial, confianza, teletrabajo) y las **relaciones no laborales** (aprendiz-beca, pasante, honorarios, consultor). Cada tipo lleva `relacion_laboral`: los no laborales **no generan prestaciones ni parafiscales** — decisión de dominio crítica para la nómina.

**Fuentes:** Decreto N° 6.055 (Gaceta 38.921), Ley del Estatuto de la Función Pública (Art. 20), Manual Descriptivo de Cargos APN, LOTTT y tabuladores APN (detalle en `_meta.fuentes`).

**Secciones que lo consumen:** `contracts` (M1a — selector obligatorio al contratar), filtros y reglas (`rule_sets` por tipo/convención), nómina (aplica tabulador APN; excluye no laborales), reportes por tipo de personal.

## 4. Datasets planificados

| Dataset | Ruta futura | Hito | Fuente prevista |
|---|---|---|---|
| Prefijos y longitudes de cédula/RIF | `data/ve/identificadores.json` | M0 | Catálogo de trabajo **NO verificado** contra SENIAT; la app valida prefijo y longitud y **no** el dígito verificador (ADR-0012) |
| Territorio VE: estados/municipios/parroquias | `data/ve/territorio.json` | M1a | geoBoundaries `gbOpen/VEN/ADM1+ADM2` (receta en `geo/docs/territorios-venezuela.md`, activo local) + `referencia-municipios.json` de IDANZ (Anzoátegui, 21 municipios con parroquias) |
| Catálogo de tipos de documento del expediente (con metadata_schema y base legal) | `data/ve/tipos-documento.json` | M1a | LOTTT/LOPCYMAT/IVSS — catálogo detallado en `regionalizacion-venezuela.md` §8 |
| Feriados VE (nacionales + móviles) | `data/ve/feriados.json` | M1b | Ley orgánica + computación eclesiástica de Pascua; locales por instalación (BD) |
| Especificación de RIF (prefijos, longitud del cuerpo, algoritmo del dígito verificador) | `data/ve/rif.json` | M1a | SENIAT — **pendiente de verificación**; ver `regionalizacion-venezuela.md` §1.1 |
| Tipos de documento / licencias conducción / otros catálogos | `data/ve/*.json` | según hito | Gacetas correspondientes |

## Convenciones

- Todo dataset lleva `_meta` con: fuente (URL), fecha de consulta, método de verificación y política de actualización.
- **`data/ve/` está versionado en git por diseño** (los seeds se generan a partir de estos archivos). El `.gitignore` solo excluye los datos locales de ejecución (`data/local/`, `data/tmp/`); si alguna vez se añade un patrón que vuelva a ignorar `data/`, este catálogo deja de ser cierto.
- Los seeds citan el dataset y su fecha; los reportes que dependan de un dato de referencia deben poder trazar de qué versión vino (si cambia la vigencia, nueva entrada en `rate_tables`/seed, no mutación).
- Prohibido commitear datos personales: solo catálogos públicos/de referencia.
