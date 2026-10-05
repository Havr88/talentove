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

**Qué contiene:** 176 denominaciones de cargos en Venezuela con `categoria` (gerencia, coordinación, talento_humano, administración, finanzas, tecnología, logística, legal, comunicacion, ingeniería, deporte, seguridad, salud, operativo_calificado, operativo_elemental, transporte, docencia), `grupo_isco` (grupos mayores 1–9 de la [ISCO-08 en español, OIT](https://www.ilo.org/public/english/bureau/stat/isco/isco08/)), `aplica_sector`, `nivel_tabulador_apn` opcional y `origen`. **Convenciones de nomenclatura:** (1) niveles de recorrido en **NÚMEROS ROMANOS** (I–VII, Tabla 3 APN); (2) **el género no es parte del cargo** — variantes femeninas de roles genéricos se normalizan a forma neutra (a)/(o) y el género de la persona vive en `employees.sexo` (los nombres institucionales del lote original con género propio se conservan tal cual); (3) los cargos "Entrenador de X" **no son cargos independientes**: se resuelven como *Entrenador Deportivo* + especialización (ver §3); (4) el sufijo **"(e)" de encargado no forma parte del cargo** — es condición de la asignación (`assignments.condicion`); (5) **las sedes entre paréntesis tampoco son parte del cargo** ("Obrero (Estadio Venezuela)" = cargo Obrero + location/unidad) — crear las sedes como `locations` al instalar.

**Semillas editables (política clave):** el dataset es un **punto de partida, no un catálogo fijo**. En producción:
- El admin puede **crear, editar, renombrar, eliminar, importar y exportar** cargos libremente (sección de administración de `positions`, con descripción y características del cargo — manual descriptivo).
- El re-seed **solo inserta cargos cuyo nombre no exista**; jamás sobrescribe ediciones del usuario.
- Importación masiva de cargos por Excel/CSV (parte de la carga masiva M1a).
- Para el régimen público (M4): curar la nomenclatura de la APN a partir del [Sistema de Clasificación de Cargos (Decreto N° 6.055)](https://vlexvenezuela.com/tags/sistema-clasificacion-cargos-administracion-publica-660870) y los [clasificadores de ONAPRE](http://www.onapre.gob.ve/index.php/publicaciones/descargas/viewcategory/30-clasificadores-presupuestarios) (documentos, no datasets — requiere curación manual); ampliación masiva opcional con el dataset [ESCO en español](https://esco.ec.europa.eu) (CSV, ~2.942 ocupaciones mapeadas a ISCO-08).

**Secciones que lo consumen:** `positions` (M1a), selector de cargo al crear asignaciones y contratos, ATS (vacantes por cargo, M3), carga masiva (validación de denominaciones sugeridas).

## 3. `data/ve/especializaciones-entrenador.json` — Especializaciones del cargo Entrenador

**Qué contiene:** 44 disciplinas deportivas para el cargo **Entrenador Deportivo** (agregado al catálogo de cargos), de las cuales 7 llevan `adaptada: true` (deporte adaptado/discapacidad: Atletismo, Baloncesto, Bochas, Fútbol Sala, Natación, Remo, Taekwondo). Normalizaciones documentadas en `_meta` (dedup de "Tae kwon do/Taekwondo" y "Futbol sala/Futbol salon"; "Fútbol de Salón" se mantiene aparte por reglamento distinto; "rowing discapacidad" → "Remo (Discapacidad)").

**Modelo general:** `position_specializations` — cualquier cargo puede tener N especializaciones (también aplica a médico→especialidad, analista→área); la asignación referencia una opcionalmente (`assignments.specialization_id`). Editable desde el admin de cargos (CRUD + importar/exportar).

**Fuentes:** lista del sponsor (IDANZ, 2026-09-27). **Secciones que lo consumen:** asignaciones (M1a), organigrama y reportes por disciplina, nómina (si la especialización tiene régimen salarial propio).

## 4. `data/ve/tipos-personal.json` — Tipos de personal

**Qué contiene:** 30 tipos de personal que combinan la nomenclatura APN (obrero fijo/contratado, administrativo/técnico/profesional fijo y contratado, **Alto Nivel**, **Libre Nombramiento y Remoción**, confianza, docente fijo/contratado/interino, militar FANB) con las clasificaciones de la LOTTT (permanente, determinado, obra, eventual, estacional, ocasional, tiempo parcial, confianza, teletrabajo) y las **relaciones no laborales** (aprendiz-beca, pasante, honorarios, consultor). Cada tipo lleva `relacion_laboral`: los no laborales **no generan prestaciones ni parafiscales** — decisión de dominio crítica para la nómina.

**Fuentes:** Decreto N° 6.055 (Gaceta 38.921), Ley del Estatuto de la Función Pública (Art. 20), Manual Descriptivo de Cargos APN, LOTTT y tabuladores APN (detalle en `_meta.fuentes`).

**Secciones que lo consumen:** `contracts` (M1a — selector obligatorio al contratar), filtros y reglas (`rule_sets` por tipo/convención), nómina (aplica tabulador APN; excluye no laborales), reportes por tipo de personal.

### 4.1 `data/ve/tipos-documento.json` — Tipos de documento probatorio del expediente

**Qué contiene:** 11 tipos de documento con **metadatos específicos por tipo** (regionalizacion §8): Identidad (cédula, RIF), Académico (títulos de Bachiller / T.S.U. / Universitario / Especialización / Maestría / Doctorado con *título obtenido, institución, año de graduación, cédula universitaria, N° de acta*), Cursos (certificados con *nombre del curso, horas, institución, emisión y vencimiento*), y Médico/SST (cert médico pre-empleo LOPCYMAT Art. 56 con *institución, médico, resultado, vence*; Notificación de Riesgos "Derecho a Saber" bloqueante). **Motor de requeridos:** cédula + certificado médico + Derecho a Saber obligatorios para todos; el título exigido se **deriva del `gradoInstruccion`** del trabajador (BACH→Bachiller, TSU→T.S.U., PROF→Universitario, ESPEC/MGS/DOCT→posgrado).

**Estado: IMPLEMENTADO en el demo** (M1a): API de adjuntos con metadatos + sección "Documentos Probatorios" del expediente con badges Obligatorio/Opcional, validación magic bytes JPG/PDF y formularios dinámicos por tipo. Falta: `employee_documents`/`document_types` como tablas reales en PostgreSQL (M1a producción) y vencimientos con alertas.

## 5. `data/piloto-idanz/` — Datos de la instalación piloto

### 5.1 Organigrama

**Qué contiene:** `organigrama.json` — borrador de las unidades organizativas del piloto (instituto deportivo estadal): Presidencia, Vicepresidencia, 13 Direcciones (Administración, Administración y Finanzas, Alto Rendimiento, Bienes Públicos, Ciencias Médicas, Ciencias Médicas Aplicadas al Deporte, Comunicación Social, Deporte Popular, Deporte Sectorial, Informática, Infraestructura, Planificación y Presupuesto, Recursos Humanos, Seguridad), Departamentos (Compras, Contabilidad, Tesorería — bajo Dirección de Administración), Deporte Estudiantil (bajo Deporte Sectorial) y programa Comunidad Indígena–Cantaura (bajo Deporte Popular). 24 unidades con padres registrados solo donde el lote lo indicó explícitamente; `_meta.pendientes_confirmar` lista las dudas (coexistencia de Administración vs Administración y Finanzas, Ciencias Médicas vs Aplicadas al Deporte, adscripción de las Direcciones).

**Naturaleza:** datos de instalación (marca blanca), no dataset genérico — el seed del piloto los carga en `org_units`/`org_unit_types`. Los cualificadores del lote se resolvieron: "(comisión de servicio)" → condición de la asignación del responsable; "(dirección de administración)" → unidad padre; "(comunidad indígena - cantaura)" → sección dependiente.

### 5.2 Tabla salarial administrativa — **MONTOS CARGADOS**

**Qué contiene:** `tabla-salarial-administrativa.json` — **84 filas con montos**: los 8 grupos APN × 7 niveles (BI 130–141 … PIII 305–316, coincidentes con la Tabla 3 nacional) **más 4 grupos legacy adicionales** MI/MII/EI/EII (montos planos 251/257 para niveles I–V; VI–VII en 0,00 = no aplicable; significado por confirmar: ¿Médico/Especialista?). La referencia nacional quedó como campo de cotejo por grupo. Pendientes: vigencia de la tabla y confirmación de MI/MII/EI/EII.

### 5.3 Tabla salarial de obreros

**Qué contiene:** `tabla-salarial-obreros.json` — **10 grados (GRD 01–10) con rango MIN–MÁX cada uno = 20 filas**, montos pendientes, con la referencia nacional APN precargada (Tabla 3.1: GRD 01 130–132 … GRD 10 217–219) y las categorías por grado (no calificados 1–4, calificados 5–8, supervisores 9–10). A diferencia de los administrativos (monto fijo por grupo-nivel), el rango se modela con `salary_scales.tipo_monto ('fijo','min','max')`.

### 5.4 Tabla salarial de Alto Nivel / rangos jerárquicos

**Qué contiene:** `tabla-salarial-alto-nivel.json` — dos tablas del legacy **con unidades por confirmar**: (A) sueldo + **% jerárquico** (MINISTRO 31,36 / 60% … COORDINADOR 23,80 / 30%); (B) sueldo sin % (447 → 348). PRESIDENTE = MÁXIMA AUTORIDAD (mismo monto). Pendiente: moneda/unidad de cada tabla y la fórmula del % jerárquico.

### 5.5 Primas (dataset genérico `data/ve/primas.json`)

**Qué contiene:** prima de **antigüedad** (24 tramos: 0% año 0 → 1% año 1 → 6,20% año 6 → … → **tope 30% desde el año 23** — coincide con la Tabla 1 APN), prima de **profesionalización** (BACH 0%, TSU 20%, PROF 25%, ESPEC 30%, MGS 35%, DOCT 40% — Tabla 2 APN), y montos fijos: **prima por hijos Bs 12,50** y **bono alimenticio Bs 45,00**. Doble fuente: legacy del sponsor + documento APN oficial. Consumidores: `packages/domain` (fórmulas de nómina M2a) y `rate_tables`.

### 5.6 Situaciones del trabajador (legacy)

**Qué contiene:** `situaciones-trabajador.json` — 19 situaciones administrativas del vocabulario legacy de la institución (ACTIVO, AVERIGUACIÓN ADMINISTRATIVA, ENCARGADURÍA, COMISIÓN DE SERVICIO, DESIGNADO, TRANSFERIDO, VACACIONES, PRE Y POST (PARTO), PERMISO, REPOSO MÉDICO, REPOSO MÉDICO CONTINUO, ABANDONO, AUSENTE, DESTITUIDO, FALLECIDO, FIN DE CONTRATO, LICENCIA SINDICAL, RENUNCIA, SE DESCONOCE + marcador CARGO A CREAR). Resolución por entidad: 16 son situaciones reales (catálogo `employee_situations` que sustituye el enum `employee_status`; las temporales se **sincronizan automáticamente** desde solicitudes aprobadas, las de egreso disparan offboarding, y "SE DESCONOCE" es estado de migración para la cola de revisión de la carga masiva); ENCARGADURÍA/COMISIÓN DE SERVICIO/DESIGNADO son condiciones de asignación (compatibilidad legacy); CARGO A CREAR es marcador del nomenclador (`positions.por_crear`). Pendiente: reglas de nómina/asistencia por situación (paramétricas).

### 5.7 Condiciones laborales (constancias)

**Qué contiene:** `condiciones-laborales.json` — 8 rótulos del legacy para constancias de trabajo y otras áreas: ADMINISTRATIVO CONTRATADO/FIJO, ALTO NIVEL, ENTRENADOR CONTRATADO, OBRERO CONTRATADO/FIJO, SALUD CONTRATADO/FIJO. Cada condición **mapea a un tipo de personal** (la constancia imprime la etiqueta exacta; el modelo `labor_conditions` la resuelve por FK). Del lote se crearon 3 tipos de personal nuevos: Personal de Salud Fijo (Carrera), Personal de Salud Contratado y Entrenador Deportivo Contratado (37 tipos en total). Pendiente confirmar si existe ENTRENADOR FIJO en la práctica.

## 6. Datasets planificados

| Dataset | Ruta futura | Hito | Fuente prevista |
|---|---|---|---|
| Prefijos y longitudes de cédula/RIF | `data/ve/identificadores.json` | M0 | Catálogo de trabajo **NO verificado** contra SENIAT; la app valida prefijo y longitud y **no** el dígito verificador (ADR-0012) |
| Territorio VE: estados/municipios/parroquias | `data/ve/territorio.json` | M1a | geoBoundaries `gbOpen/VEN/ADM1+ADM2` (receta en `geo/docs/territorios-venezuela.md`, activo local) + `referencia-municipios.json` de IDANZ (Anzoátegui, 21 municipios con parroquias) |
| Feriados VE (nacionales + móviles) | `data/ve/feriados.json` | M1b | Ley orgánica + computación eclesiástica de Pascua; locales por instalación (BD) |
| Especificación de RIF (prefijos, longitud del cuerpo, algoritmo del dígito verificador) | `data/ve/rif.json` | M1a | SENIAT — **pendiente de verificación**; ver `regionalizacion-venezuela.md` §1.1 |
| Tipos de documento / licencias conducción / otros catálogos | `data/ve/*.json` | según hito | Gacetas correspondientes |

## Convenciones

- Todo dataset lleva `_meta` con: fuente (URL), fecha de consulta, método de verificación y política de actualización.
- **`data/ve/` está versionado en git por diseño** (los seeds se generan a partir de estos archivos). El `.gitignore` solo excluye los datos locales de ejecución (`data/local/`, `data/tmp/`); si alguna vez se añade un patrón que vuelva a ignorar `data/`, este catálogo deja de ser cierto.
- Los seeds citan el dataset y su fecha; los reportes que dependan de un dato de referencia deben poder trazar de qué versión vino (si cambia la vigencia, nueva entrada en `rate_tables`/seed, no mutación).
- Prohibido commitear datos personales: solo catálogos públicos/de referencia.
