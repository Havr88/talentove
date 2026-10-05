# Módulos y hitos — especificación (v2)

> Estado: **v2.2 — aprobado por el sponsor 2026-09-26**; decisiones abiertas registradas y M2 dividido en M2a/M2b (2026-09-27) (estructura M1a/M1b/M2/M3/M4). Referencias "(Patria)" = patrón copiado de `analisis-patria.md`; "(activo local)" = recurso de `activos-reutilizables.md`. Los módulos se abren como issues al iniciar su hito.

## M0 — Fundación

**Entregables:** entorno verificado (Node ≥20, PostgreSQL 16; Docker en servidor de pruebas — no hay Docker local), repo con CI (lint+typecheck+tests+audit; plantilla base `geo/.github`), esqueleto `apps/server` (Express+Nunjucks+HTMX+Materialize+DataTables) y `packages/domain`, migraciones, auth+RBAC con sesiones en PG, **wizard de primera instalación**, theming por CSS variables, shell UI completo estilo Patria (navbar+acordeón+rail+footer+PWA), docker-compose, guía de instalación en español, y portación del primer módulo de dominio testado: **tasas Bs/USD** (de `sistema_caja_bimoneda`, activo local).

**Criterios de aceptación:** instalación limpia en <15 min; wizard genera superadmin+empresa+branding; login/logout/2FA-TOTP opcional; tema cambia en vivo; CI en verde; suite de tasas con cobertura ≥95%.

## M1a — Expediente + Estructura organizacional + carga masiva

**Expediente del trabajador:**
- Datos personales con validadores VE (cédula, RIF con dígito verificador, teléfonos, correos, dirección con estados/municipios/parroquias)
- Contratos (tipo, ingreso, salario Bs/USD, jornada, cargo, sede, **tipo de personal** — catálogo de 30 tipos: obrero/administrativo/profesional fijo o contratado, Alto Nivel, LNR, docente, LOTTT por duración, becas/honorarios — con flag `relacion_laboral` que excluye a no laborales de prestaciones/parafiscales), cuentas bancarias (PAGO_MOVIL/ZELLE…)
- **Contratación legal:** redacción de contratos a tiempo determinado/indeterminado, **firma por duplicado** (una copia para el trabajador — Art. 59 LOTTT) con registro de entrega, y **libros legales digitales** generados de los datos reales (libro de contratos de trabajo, registro de ingreso de trabajadores, **libro de vacaciones**, libro de reclamaciones) con numeración correlativa, historial de emisiones y versión imprimible/firmable
- **Documentos con metadatos específicos por tipo** — catálogo `document_types` con campos propios (fecha de emisión, fecha de vencimiento y específicos: **título obtenido, nivel académico, año de graduación, nombre del curso, horas, institución, médico/clínica, clase de licencia**…), estados pendiente/aprobado/rechazado (Patria: tablas de workflow), **requisitos obligatorios por ley** (LOTTT/LOPCYMAT/IVSS — catálogo en `regionalizacion-venezuela.md` §8) y **alertas de vencimiento**
- **Cargas familiares y beneficiarios** (CRUD + confirmación en 2 pasos — Patria: Familia)
- **Incorporación por token** (Patria: "Agregar por Hash")
- **Checklist de completitud** (Patria: "Protegido") con capacidades desbloqueables

**Estructura organizacional (módulo A):**
- Unidades con **tipo configurable** (Dirección/Gerencia/Coordinación/Departamento/Unidad/Almacén), jerarquía, sede, responsable
- **Asignaciones con vigencia** (empleado↔unidad+cargo+flag responsable); **múltiples asignaciones simultáneas**: titular en su unidad y prestado a otra en **comisión de servicio** por tiempo determinado (`condicion: 'comision_de_servicio'`); organigrama en árbol (componente Lit); vista "empleados a cargo" por coordinador
- **Gestión del catálogo de cargos (totalmente editable):** sección de administración con **editar, agregar, eliminar, importar y exportar** (Excel/CSV/JSON) cargos, cada uno con **descripción y características** (manual descriptivo: propósito, funciones, requisitos mínimos — nivel académico, experiencia, competencias); **especializaciones por cargo** (ej.: Entrenador Deportivo → 44 disciplinas deportivas con bandera `adaptada`; patrón general `position_specializations` reutilizable); **niveles de recorrido en números romanos (I–VII, convención Tabla 3 APN)**; seed de 176 denominaciones venezolanas (`data/ve/cargos.json`: curación general por ISCO-08 + lotes institucionales del sponsor; convenciones: niveles en números romanos, género neutro en el cargo, sedes entre paréntesis → locations) con política de re-seed sin sobrescritura; búsqueda para asignación rápida; el sufijo **"(e)" de encargado es una condición de la asignación** (`assignments.condicion`: titular/encargado/interino/suplente), no un cargo distinto
- Terminología orgánica editable por instalación (marca blanca)

**Carga masiva (módulo J):** importación de empleados, estructura y salarios desde Excel/CSV con validación zod, previsualización, reporte de errores por fila, modo dry-run.

**Búsqueda global** de trabajadores por cédula/nombre/cargo.

**Criterios de aceptación:** organigrama navegable y editable; importación de 100 empleados sintéticos sin errores y con reporte de errores legible; token de incorporación genera expediente pre-cargado; checklist de completitud del expediente basado en los requisitos legales del catálogo de documentos, con alerta al vencerse un documento.

## M1b — Portal del trabajador + Motor de solicitudes + Portal del coordinador

**Motor de solicitudes (módulo B):**
- Catálogo de tipos **configurable por instalación**: formulario JSON → formularios HTMX dinámicos, cadena de aprobación con resolutores (jefe directo desde la org, coordinador de unidad, rol RRHH, usuario fijo), SLA, adjuntos, flag de incidencia en nómina
- Tipos M1b:
  - **Vacaciones:** solicitud de días con **cálculo automático de disfrute** (saldo disponible según LOTTT 15+1→30, contados en días hábiles contra el calendario de feriados, periodo propuesto y advertencias de solapamiento con el equipo) y flujo **solicitud → aprobación del jefe directo → RRHH**
  - **Horas extra y días feriados laborados:** el trabajador **solicita/notifica/indica** las horas extra y los días feriados o de descanso trabajados (o el coordinador los registra por él), con aprobación del jefe directo; los recargos LOTTT paramétricos (extra diurna +50%, nocturno +30%, feriado/descanso — verificar Art. 190 en Gaceta) se calculan y pagan en nómina desde M2a
  - **Permisos:** remunerados/no remunerados (personal, estudio, sindical, nacimiento de hijo, matrimonio, fallecimiento de familiar) con duraciones paramétricas
  - **Reposos médicos avalados por el IVSS:** registro con adjunto/referencia del reposo y su **aval IVSS**; los días de incapacidad no cuentan como ausencia y quedan disponibles para las reglas de subsidio IVSS (patrono vs IVSS — paramétricas, a verificar)
  - **Licencias:** maternidad (18 semanas: 6 antes + 12 después), paternidad, luto — duraciones paramétricas según LOTTT (Arts. 213 y ss.)
  - **Constancias** (auto-servicio PDF), **actualización de datos** (cambios al expediente requieren aprobación), **reclamos/peticiones**, **pases/movimientos** (sin efecto salarial en M1b)
- Estados: borrador → enviada → en revisión → aprobada/rechazada/devuelta/cancelada → completada; **vistas por estado estilo Patria** (tablas pending/waiting/rejected)
- Bandeja del coordinador: aprobar/rechazar/devolver con comentario; **delegados** en vacaciones; reasignación automática al cambiar responsable de unidad
- **Calendario de feriados VE paramétrico** (nacionales + locales) para días hábiles
- Notificaciones: rail derecho estilo Patria + correo; timeline por solicitud

**Portal del trabajador:** panel con comunicados (scroll infinito HTMX), rail de notificaciones/pendientes, historial de accesos, perfil por secciones, carnet digital con QR.

**Portal del coordinador (módulo K):** dashboard de pendientes de aprobación, equipo a cargo, vacaciones del equipo, asistencia del día, aprobaciones rápidas desde el rail.

**Criterios de aceptación:** flujo completo empleado→jefe→RRHH de una solicitud de vacaciones con saldo correcto y cálculo de disfrute; reposo médico registrado con aval IVSS que no penaliza asistencia; reporte de horas extra/feriado laborado aprobado por el jefe y visible para nómina; delegación funcional; constancia PDF generada; E2E Playwright del flujo.

## M2a — Nómina venezolana

> **Por qué nómina va primero:** es el módulo por el que se paga el producto, y **no depende del
> módulo de asistencia**. Las horas extra y los días feriados laborados llegan ya aprobados desde
> el motor de solicitudes de M1b (`overtime_requests`), así que M2a puede calcular recargos sin
> tener cuadrantes ni biométricos. Eso elimina la dependencia circular entre asistencia y nómina y
> permite entregar valor antes. M2b después automatiza la fuente de esas horas.

**Alcance:** conceptos configurables con **flags de incidencia** (ADR-0009), fórmulas LOTTT
(vacaciones, bono vacacional, utilidades, prestaciones garantía+complemento+intereses,
liquidación), parafiscales paramétricos (IVSS/RPE/FAOV/INCES), dualidad Bs/USD con histórico,
períodos con cierre y confirmación en 2 pasos, **anticipos con límite paramétrico** (Patria: Adelanto
de Fondos), recibos PDF, tabla mensual histórica (Patria: Estadísticas), y el **calendario de
registro mensual y depósito trimestral de la Garantía de Prestaciones Sociales (Art. 142 LOTTT)**.
Incluye cestaticket/beneficio de alimentación (frecuencia configurable: mensual o fraccionada) y
control del libro de vacaciones con pago oportuno del bono vacacional.

**Parámetros legales:** verificación de los valores de `regionalizacion-venezuela.md` §2 contra
Gaceta Oficial y carga por UI con vigencia y fuente. Es el entregable de M2a que más valor tiene
para el cliente y el que más depende de investigación, no de código.

**Movimientos con efecto salarial:** transferencias/cambios de cargo con fecha efectiva que
generan el cambio de salario en nómina; historial inmutable.

**Archivos de cotización:** IVSS / FAOV-BANAVIH / INCES por período (los de **pago** van en M2b,
porque dependen del layout bancario).

**Criterios de aceptación:** quincena de prueba completa con recibos consistentes y auditoría;
cada renglón explica cómo se calculó (ADR-0009); **calibración de fórmulas validada con un
contador**; ≥95% de cobertura en `packages/domain`; parámetros legales verificados y con fuente
registrada.

## M2b — Asistencia extendida + integraciones bancarias + reportes

**Asistencia extendida (módulo C):** cuadrantes semanal/mensual por unidad (turnos rotativos,
cruces de medianoche, TZ Caracas), **intercambio de turnos** con aprobación, marcaciones
multi-fuente (web, QR, **importación de relojes biométricos tipo ZKTeco**), y **cierre mensual
con revisiones** auditable (patrón `month_closes`). El cierre pasa a ser la fuente de horas
extra, recargos nocturnos y feriados laborados que M2a consume: a partir de aquí la Attendance
deja de depender de la solicitud manual.

**Integraciones (módulo I, núcleo):** archivos bancarios de pago de nómina (**adaptador
paramétrico por banco**, validado con el banco del piloto) y export contable (asientos dual
Bs/USD, referencia: doble entrada de `sistema_caja_bimoneda`).

**Reportes básicos (módulo H):** headcount, ausentismo, costo de nómina y patronal; exportaciones
CSV/Excel/PDF.

**Criterios de aceptación:** asistencia biométrica importada y reflejada en el cierre; el cierre
alimenta la quincena de M2a con recargos sin doble conteo; **archivo bancario generado y validado
con el banco del piloto**; relatórios de ausentismo y costo consistentes con la nómina del período.

## Nota sobre el alcance de M2 (antes uno solo)

M2 se dividió en **M2a** (nómina) y **M2b** (asistencia, integraciones y reportes) porque son
alcances independientes y de riesgo distinto: M2a tiene el riesgo legal y de exactitud del
cálculo; M2b tiene el riesgo de integración con terceros (bancos, relojes biométricos) y es
fácilmente postergable sin que la nómina deje de funcionar.

## M3 — Talento: ATS, ciclo de vida, SST, activos

- **ATS:** vacantes (interna + link público), postulaciones con token, pipeline kanban, **entrevistas con máquina de estados** (Reservada→Confirmada→Atendida→Cancelada — referencia: docs de `appointments_analysis`)
- **Onboarding (F):** checklist de ingreso por cargo (documentos, unidad, equipos, accesos, inducción con firma), expediente pre-cargado desde el ATS, y la **Notificación de Riesgos ("Derecho a Saber", LOPCYMAT) como puerta obligatoria**: el trabajador no puede iniciar funciones sin firmar el reconocimiento de los riesgos de su puesto
- **Offboarding (G):** tipos de egreso, entrevista y encuesta de salida, checklist de devoluciones (bloquea liquidación según regla configurable), y emisión de los **documentos de egreso obligatorios: constancia de trabajo (LOTTT) y Forma 14-100 del IVSS (Constancia de Egreso)**
- **Relaciones laborales y clima:** atención de quejas y mediación de conflictos, **gestión de notificaciones/reclamos de la Inspectoría del Trabajo con plazos y responsables**, afiliaciones sindicales y **convención colectiva aplicable** (reglas configurables por convención), y encuestas de clima
- **Desempeño:** plantillas configurables por metas y **modelos de competencias** para medir rendimiento e identificar potencial; ciclo por período
- **Retención:** administración de los **beneficios del paquete integral de compensación no obligatorios** (salud privada, bonos de productividad en divisas, transporte, comedor) por trabajador/grupo, y reporte de **rotación de personal calificado** como métrica de seguimiento
- **Encuestas internas** (Patria: Encuestas): clima laboral y de un clic; **comités y afiliaciones**: comité SST (LOPCYMAT), comité de alimentación, sindicato
- **Capacitación:** cursos, certificados, **planes de formación vinculados a la cuota y programas del INCES** (técnicos y habilidades blandas); horas acumuladas
- **SST (D):** registro e investigación de accidentes/enfermedades ocupacionales con reporte IVSS/INPSASEL, entregas de **EPP** con firma y reposición, exámenes médicos con agendamiento y recordatorios, estadísticas por unidad
- **Activos asignados (E):** custodia de equipos/uniformes con acta, check-in/out y QR (patrón assettag-qr), vinculado al offboarding

**Criterios de aceptación:** candidato → contrato → onboarding completo sin doble captura; egreso con devoluciones y liquidación disparada; acta de entrega de activos firmada (firma canvas).

## M4 — Extensión (opcional, a priorizar con el sponsor)

- **Caja de ahorro (L):** aportes, préstamos con avales y **tabla de amortización** (brecha confirmada: construir en `packages/domain`), deducción en nómina
- **Reconocimientos (M):** diplomas/reconocimientos internos PDF con membrete (Patria: "Logros")
- Tienda de beneficios (Ecwid embebido; Jumpseller alternativa) · **Firma electrónica** de documentos · **API pública + webhooks** · módulo de contenido público (o Publii) · **régimen sector público completo** (tabuladores, INCES 1%, NPC 9%) + **SIGEP** · **canal ético de denuncias** (Patria: Bloqueos y Denuncias)

---

## Observaciones del sponsor

> Espacio para tus ediciones manuales: ajustes de alcance, prioridades, vocabulario y requisitos que surjan de la revisión.

### Decisiones: estado

Registradas en la revisión documental del 2026-09-27. Las tres de impacto arquitectónico
quedaron resueltas en ADRs ([índice](decisiones/README.md)); las de negocio siguen abiertas.

| # | Decisión | Estado | Impacto si se aplaza |
|---|---|---|---|
| 1 | **Contrato de fórmulas de nómina** | ✅ **Resuelta** — [ADR-0009](decisiones/0009-formulas-nomina.md): `formula_key` (cerrado en el código) + `params jsonb` validado con zod, `breakdown` y `appliedRuleIds` por renglón, versión de fórmula grabada en `payroll_items`. **Ninguna expresión ejecutable desde la BD.** | cerrada |
| 2 | **Licencia (ADR-0005)** | ⏳ **abierta con recomendación**: análisis de 6 opciones escrito; se recomienda **AGPL-3.0-only**, con Apache-2.0 como repliegue si el sector público excluye el copyleft fuerte | Bloquea la publicación del repo en GitHub. Aclarado que **no está forzada por los activos locales** (se re-implementa, no se copia) |
| 3 | **Sesiones y RBAC** | ✅ **Resuelta** — [ADR-0007](decisiones/0007-sesiones-rbac.md): token opaco de 256 bits guardado **como hash**, un solo secreto maestro con derivación HKDF por contexto, códigos de rol y permiso en el código y asignación en datos, y la cédula como identidad (no autenticación) | cerrada |
| 4 | **Driver de almacenamiento** | ✅ **Resuelta** — [ADR-0008](decisiones/0008-storage-driver.md): interfaz por **clave opaca generada** (path traversal imposible por construcción), descarga siempre por endpoint autenticado, MIME detectado por contenido, cifrado en reposo responsabilidad del volumen | cerrada |
| 5 | **RIF**: conjunto de prefijos, longitud del cuerpo y algoritmo del dígito verificador sin verificar contra SENIAT (ver `regionalizacion-venezuela.md` §1.1) | abierta | Bloquea el validador de RIF del expediente; la fórmula ya quedó parametrizada para no bloquear el trabajo |
| 6 | **Alcance de M2** | ✅ **Resuelta** — el sponsor decide dividir: **M2a** nómina venezolana (con sus archivos de cotización) y **M2b** asistencia extendida + integraciones bancarias + reportes. M2a no depende de asistencia: consume las horas extra ya aprobadas del motor de solicitudes de M1b | cerrada |
| 7 | **Rendimiento esperado** | ✅ **Resuelta** — el sponsor confirma **< 100 usuarios concurrentes** por instalación (2026-09-27); objetivos derivados en `arquitectura.md` §9 (5.000 trabajadores, latencias, carga masiva y tiempo de cierre) | cerrada |

### Pendientes de las páginas Patria por aportar

`analisis-patria.md` §7 sigue esperando: `/perfil/laboral/`, `/perfil/carnet/`, `/encuestas/`,
`/perfil/seguridad/`, `/perfil/configuracion/` y la página de login.
