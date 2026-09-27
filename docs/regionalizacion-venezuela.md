# Regionalización Venezuela — reglas y parámetros

> Estado: v0.2 (2026-09-27). Principio rector: **todo valor legal es dato, no código** — vive en `rate_tables`/`rule_sets` con vigencia y fuente, y se verifica en Gaceta Oficial al implementar cada fórmula.

## 1. Formatos y validadores (es-VE)

| Elemento | Regla |
|---|---|
| Cédula | `V`/`E` + 6–8 dígitos, se muestra `V-12.345.678`; input con máscara |
| RIF | Prefijo + cuerpo + **dígito verificador**, con separadores `J-12345678-9`. **La especificación completa (prefijos admitidos, longitud del cuerpo, algoritmo del dígito verificador) es dato, no código**: vive en `rule_sets` (`RIF_PREFIJOS`, `RIF_LONGITUD_CUERPO`, `RIF_ALGORITMO_DV`) y en el dataset previsto `data/ve/rif.json` (ver `datasets.md` §4), y el validador de `packages/domain` la recibe como parámetro. Ver §1.1 para el estado de verificación. |
| Moneda | Bs con 2 decimales, coma decimal y punto de miles: `Bs 155.000,00`; USD: `$1.234,56` (o formato del tenant) |
| Fechas | `dd/mm/aaaa` en UI; ISO-8601 en BD |
| Teléfono | `+58 412-1234567` (celulares 04xx) |
| Tiempo | `TZ=America/Caracas` (VET, UTC-4, sin horario de verano) |
| Geografía | Seed de **24 unidades de primer nivel** (23 estados + Distrito Capital) con municipios y parroquias. Las **Dependencias Federales** (islas) se manejan aparte: no son unidades de primer nivel ni municipios; ver §1.2 |

### 1.1 RIF — estado de verificación (⚠️ abierto)

Lo que está **confirmado**: la estructura del identificador (prefijo de tipo + cuerpo numérico + dígito verificador, con el dígito verificador derivado del cuerpo) y que para personas naturales el RIF se articula sobre la cédula.

Lo que **NO** está verificado contra fuente oficial (SENIAT) y por tanto **no se documenta como cifra fija**:

- El **conjunto completo de prefijos válidos**. Hay discrepancia entre fuentes: los catálogos locales manejan `V, E, J, G, P` y el proyecto `sistema_caja_bimoneda` añade `C`. No se ha resuelto si `C` es un prefijo vigente o una convención interna de ese proyecto.
- La **longitud del cuerpo**: no es constante (las cédulas pueden tener 6, 7 u 8 dígitos y los RIF jurídicos 8). Fijar "8 dígitos" como regla general sería incorrecto.
- El **algoritmo exacto del dígito verificador** (ponderaciones y módulo).

**Consecuencia de diseño (coherente con el principio rector):** hasta cerrar la verificación, el validador de `packages/domain` implementa el algoritmo como **función pura parametrizada** con la especificación inyectada desde `rule_sets`; los tests usan la especificación como fixture. Cuando se verifique contra el validador oficial, se añade la entrada al seed con su fuente y fecha, sin tocar la fórmula. La tarea está en el checklist de §9.

### 1.2 Geografía — 24 unidades de primer nivel vs. 25 de geoBoundaries

La divergencia entre "24 entidades" (§1) y "25 unidades ADM1" (`activos-reutilizables.md` §1, activo `geo`) **no es un error del dataset**: geoBoundaries incluye en `ADM1` una unidad para las **Dependencias Federales**, que la división político-territorial venezolana no reconoce como estado ni como unidad de primer nivel.

**Decisión:** el seed territorial usa **24 unidades ADM1 oficiales** (23 estados + Distrito Capital). Las Dependencias Federales se cargan en una categoría aparte, útil solo para direccionamiento de sedes costeras, y **no** habilita la selección de estado/municipio/parroquia en los flujos de RRHH (expediente, carga masiva). La receta de `geo` debe dejar constancia del descarte al filtrar `ADM1` al construir el seed, para que la diferencia quede justificada en la fuente.

## 2. Parámetros legales — valores iniciales investigados (2026-09)

> ⚠️ Cifras de partida documentadas con fuentes no oficiales; **obligatorio verificar en Gaceta Oficial/organismo al implementar** y registrar la fuente en `rate_tables`.

| Parámetro | Valor investigado | Notas |
|---|---|---|
| IVSS — SSO trabajador | **4%** | Base: salario normal, con tope |
| IVSS — SSO patrono | **9%** (riesgo bajo) / 10% medio / 11% alto | Clase de riesgo de la empresa (configurable por `company`) |
| IVSS — tope | 10 salarios mínimos urbanos | El salario mínimo puede estar desactualizado vs. salarios reales → el tope debe ser parametrizable por monto |
| RPE (paro forzoso) | 0,5% trabajador / **2%** patrono | Se entera con el IVSS |
| FAOV / BANAVIH | 1% trabajador / **2%** patrono | Base salario normal; se acredita en cuenta individual BANAVIH |
| INCES | **2%** nómina patrono (privadas) / 1% (entes públicos) | + **0,5%** adicional sobre utilidades pagadas |
| NPC (sector público) | 9% patrono | Contribución especial de pensiones — solo régimen público |
| Unidad Tributaria (UT) | **Bs 43** (reajuste jun-2025) | Reajustes frecuentes por inflación → historial obligatorio |

Costo patronal aproximado (privado): ~15–17% + 0,5% sobre utilidades.

Fuentes consultadas (no oficiales, para calibrar defaults): sistematemis.com (retenciones y aportes patronales 2026), hipotecas.com.ve (guía FAOV/IVSS/INCES), runrun.es (reajuste UT). La verificación contra Gaceta Oficial es tarea explícita de M2.

## 3. Fórmulas LOTTT (base del módulo de nómina, M2)

Implementadas como **funciones puras en `packages/domain`** con todos los parámetros inyectados (testables, cobertura ≥95%):

| Concepto | Regla (LOTTT 2012, vigente) |
|---|---|
| Jornada | Diurna máx. 8 h/día y 44 h/semana (Art. 174); nocturna 7 h; límites y recargos de extras/feriados (Arts. 177–190), recargo extra diurna +50% |
| Vacaciones | 15 días por el primer año + 1 día adicional por cada año siguiente, tope 30 (Art. 136) |
| Bono vacacional | 15 días mínimo + 1 por año de servicio, tope 30 (Art. 192) — pagadero al disfrutar y proporcional al egresar |
| Utilidades | Mínimo 30 días; hasta 60 si >50 trabajadores e ingresos >250.000 UT (Art. 131) |
| Garantía de prestaciones | Depósito mensual equivalente a 15 días de salario (Art. 142.1) |
| Complemento de prestaciones | Diferencia entre el promedio de 2 meses de salario por año y la garantía (Art. 142.2) |
| Intereses sobre prestaciones | Tasa activa BCV (Art. 143) — histórica por período |
| Liquidación | Prestaciones + días de vacaciones/bono vacacional proporcional + lo adeudado (Arts. 141–146, 125) |
| Recargos (extras/feriados) | Hora extra diurna +50%; trabajo nocturno +30%; recargo por trabajo en feriado/descanso semanal (Arts. 177–190, **verificar Art. 190 en Gaceta al implementar**) — todos paramétricos en `rule_sets` |
| Contratos y garantía | Contratos a tiempo determinado/obra: **por escrito y por duplicado, una copia para el trabajador (Art. 59 LOTTT)**; registro mensual de la garantía de prestaciones y **depósito trimestral** (Art. 142); libros legales de la empresa (contratos, ingreso, vacaciones, reclamaciones) |
| Licencias y reposos | Licencias con goce de sueldo: maternidad (18 semanas: 6 antes + 12 después), paternidad, luto, matrimonio, nacimiento de hijo (Arts. 213 y ss.); **reposos médicos con aval IVSS** — duraciones y reglas de subsidio (días pagados por patrono vs IVSS) paramétricas y a verificar |

## 4. Dualidad monetaria Bs/USD

- El salario se define en Bs, USD o **ambos** (monto USD anclado).
- Cada transacción monetaria captura la **tasa BCV del día** en `fx_rate` (histórico en `rate_tables`); nunca se recalcula hacia atrás.
- Reportes y consolidados muestran ambas monedas (patrón multi-fila del Monedero de Patria).
- Montos: `numeric` siempre; redondeos solo al presentar.

## 5. Bandera sector público / privado

`companies.sector` selecciona el `rule_set` aplicable. Cada parámetro se almacena como **un registro por sector** (la tabla ya tiene columna `sector`), por lo que un mismo parámetro con valor distinto por sector se resuelve por Lookup, no guardando dos valores en un mismo registro. Ejemplo:

| `clave` | Registro para `sector='privado'` | Registro para `sector='publico'` |
|---|---|---|
| `INCES_NOMINA` | `0.02` | `0.01` |
| `NPC_PATRONO` | (ausente → no aplica) | `0.09` |

| Aspecto | Privado (implementa primero) | Público (bandera desde diseño, implementa después) |
|---|---|---|
| INCES | 2% | 1% |
| Prestaciones | Régimen LOTTT general | Regímenes especiales (Art. 519 y ss.); tabuladores |
| Salarios | Libre | Tabuladores por nivel (`salary_scales`) |
| Expediente | Documentos estándar | Requisitos adicionales configurables |

**Tipos de personal (APN):** la clasificación de la carrera funcionarial la rige el **Decreto N° 6.055 (Gaceta 38.921)** y la [Ley del Estatuto de la Función Pública](https://venezuela.justia.com/federales/leyes/ley-del-estatuto-de-la-funcion-publica/gdoc) (Art. 20: LNR ocupa cargos de alto nivel o de confianza). Tramos salariales: Alto Nivel (I–V), carrera (BI–PIII, TI–TII) y obrero (G1–G10). Catálogo completo de 30 tipos —incluidas las clasificaciones de la LOTTT por duración y las relaciones no laborales— en `data/ve/tipos-personal.json`; el flag `relacion_laboral` decide si hay prestaciones/parafiscales. Sector educativo: convenciones colectivas propias (docente, administrativo, obrero).

## 5.1 Tabuladores APN — referencia oficial documentada (2026-09-26)

Fuente: documento oficial **"Proceso de Ajuste del Sistema de Remuneración de la Administración Pública, Convenciones Colectivas, Tablas Especiales y Empresas Estratégicas"** (PDF alojado en `mindefensa.gob.ve`, carpeta de subida may-2025; **sin número de Gaceta en el texto** — vigencia exacta por confirmar con ONAPRE/Gaceta al implementar).

Puntos clave del documento:

- **Salarización de bonos:** el salario base incorpora el bono complementario de estabilización y protección del ingreso, bono de alimentación y transporte, "máxima eficiencia" y otros bonos complementarios.
- **Cestaticket Socialista: Bs 45,00**.
- **Conceptos fijados en Bs 12,50** (donde existieran): prima por hijos, becas (hijos y trabajadores), contribución/ayuda por discapacidad, día de la madre/padre/niño, bonos navideños y de juguetes, ayuda por nacimiento y matrimonio.
- **Prima de antigüedad** (% sobre sueldo, por años de servicio): 1–5 años: 1%–5% anual; año 6: 6,2%; sube +1,4 p.p. por año hasta 20 años (26%); 21: 27,8%; 22: 29,6%; **23 o más: 30%**.
- **Prima de profesionalización:** TSU 20% · Profesional 25% · Especialista 30% · Maestría 35% · Doctor 40%.
- **Evaluación de desempeño:** migración de valor fijo a metodología de evaluación (sectorial) como condición del estímulo.

**Tabla 3 — Sueldos mensuales funcionarios APN (Bs):**

| Grupo | Nivel I | II | III | IV | V | VI | VII |
|---|---|---|---|---|---|---|---|
| Bachilleres I | 130 | 132 | 134 | 135 | 137 | 139 | 141 |
| Bachilleres II | 148 | 150 | 152 | 154 | 155 | 157 | 159 |
| Bachilleres III | 166 | 168 | 170 | 172 | 174 | 176 | 177 |
| Técnicos I | 192 | 194 | 196 | 197 | 199 | 201 | 203 |
| Técnicos II | 217 | 219 | 221 | 223 | 225 | 226 | 228 |
| Profesionales I | 246 | 248 | 250 | 252 | 254 | 256 | 257 |
| Profesionales II | 276 | 277 | 279 | 281 | 283 | 285 | 287 |
| Profesionales III | 305 | 307 | 308 | 310 | 312 | 314 | 316 |

**Tabla 3.1 — Obreros APN (Bs, mínimo–máximo por grado):** grados 1–4 (no calificados): 130–132, 140–142, 149–152, 159–161; grados 5–8 (calificados): 169–171, 178–181, 188–190, 198–200; grados 9–10 (supervisores): 207–210, 217–219.

### 5.2 Contexto macro (2026) y consecuencia de diseño

- El **salario mínimo formal** continúa en **Bs 130** (mar-2022, sin decreto posterior localizado).
- El **ingreso mínimo integral** se elevó a un equivalente de **$240/mes** (anuncio 30-abr-2026), materializado vía **bonos** (≈ $200 Bono de Guerra + $40 Bono de Alimentación) que **no inciden en prestaciones sociales**.
- El Min-Trabajo anunció (may-2026) **nuevas tablas salariales por sectores** (educación, salud, cuerpos policiales, FANB, educación superior); a la fecha (sep-2026) **no se localizó su publicación en Gaceta Oficial**.
- Marco normativo base: Decreto N° 3.480 (2018, Escala General de Sueldos de Funcionarios Públicos de Carrera), Decreto N° 3.479 (tabulador de obreros de la APN) y **Decreto N° 6.055** (Sistema de Clasificación de Cargos de la Carrera Funcionarial — base de la nomenclatura de cargos APN; los clasificadores de ONAPRE son documentos, no datasets: curación manual prevista en M4, semilla editable en `data/ve/cargos.json`).

**Consecuencia de diseño:** en el sector público el ingreso efectivo = tabulador + primas + bonos, y varios bonos **no inciden** en prestaciones/parafiscales. Por eso `payroll_concepts` lleva **flags de incidencia** (ver modelo-datos.md) y `salary_scales` se carga con vigencia y fuente; el sistema nunca asume que el tabulador es el ingreso total ni calcula prestaciones sobre conceptos no salariales.

## 6. Calendario de feriados y formatos bancarios

- **Feriados paramétricos** (tabla `holidays`): nacionales fijos (1-ene, 19-abr, 1-may, 24-jun, 5-jul, 24-jul, 12-oct, 24-dic, 31-dic…) y móviles religiosos (Carnaval, Semana Santa — computados de Pascua), más **locales por instalación** (feriados estatales/municipales propios). El cálculo de vacaciones/permisos en días hábiles usa este calendario.
- **Formatos bancarios de pago de nómina** (M2): adaptador **paramétrico por banco** (layout delimitado/ancho fijo, campos: cédula/RIF, cuenta, monto Bs, referencia, lote). Los layouts se cargan como plantillas versionadas — un banco nuevo no requiere código. Los bancos válidos (emisor/destino) se validan contra el **dataset de bancos venezolanos** (`data/ve/bancos.json`, códigos SUDEBAN de 4 dígitos — ver `datasets.md`).
- Archivos de cotización (IVSS/FAOV/INCES) y export contable: mismo enfoque de adaptadores paramétricos.

## 7. Comprobantes y documentos legales

- Recibo de pago con conceptos, retenciones y aportes (pdfmake), y su equivalente en USD si aplica.
- **Constancia de trabajo** (emisión gratuita a petición y al egreso — LOTTT) y **Forma 14-100 del IVSS (Constancia de Egreso)** como documentos de egreso obligatorios.
- Fórmulas de ARC/planillas fiscales: por confirmar con contador público y norma vigente (tarea de M2 — evitar suposiciones).

## 8. Expediente laboral — base legal y catálogo de documentos

La conformación del expediente laboral es **requisito obligatorio** regulado por la **LOTTT** (deber de registro e inscripción de cada trabajador por parte del patrono — texto literal por verificar en Gaceta, el número de artículo varía según la versión), la **LOPCYMAT** (Art. 56 y Reglamento Arts. 27–28: exámenes médicos ocupacionales **pre-empleo, periódicos y de egreso** a cargo del patrono) y las exigencias del **IVSS** (inscripción patronal y de asegurados/beneficiarios, declaración de salarios vía SICOSS, carpetas médicas). En SST aplica además el **RANEO** (Registro, Declaración y Notificación de Accidentes de Trabajo y Enfermedades Ocupacionales). El sector público añade requisitos de ingreso propios (certificado de vida y residencia, declaraciones juradas — a configurar con el régimen público, M4).

**Principio de diseño:** cada documento se describe con los **metadatos propios de su tipo** (no un blob genérico): fecha de emisión, fecha de vencimiento (si aplica), institución emisora y campos específicos. El catálogo (`document_types`) define esos campos por tipo y alimenta el checklist de completitud y las alertas de vencimiento.

| Sección | Documento | Metadatos específicos (además de emisión/vencimiento) |
|---|---|---|
| Identidad | Cédula de identidad | número, municipio de emisión |
| Identidad | Pasaporte | número, país emisor |
| Identidad | RIF | número, fecha de emisión |
| Identidad | Licencia de conducir | número, **clase** (1/2/3/4/5), vencimiento |
| Académico | Título (bachiller/TSU/universitario) | **título obtenido**, **nivel académico** (bachiller, TSU, licenciado, especialista, maestría, doctorado), **año de graduación**, institución, número de cédula universitaria |
| Académico | Certificaciones y cursos | **nombre del curso**, horas/duración, institución, fecha; vencimiento opcional (certificaciones recertificables) |
| Laboral | Contrato y anexos | fecha de ingreso, cargo, salario, tipo (ya en `contracts` — el documento es el respaldo **firmado por duplicado, Art. 59 LOTTT**, con registro de entrega de la copia al trabajador) |
| Laboral | Cartas (aceptación, renuncia, promoción) | fecha, referencia |
| Laboral | Antecedentes / certificaciones de ingreso | fecha de emisión, organismo |
| SST (LOPCYMAT) | **Notificación de Riesgos ("Derecho a Saber")** | puesto, riesgos notificados, **firma obligatoria antes de iniciar funciones** (ítem bloqueante del onboarding) |
| Médico (LOPCYMAT) | Certificado médico pre-empleo | institución/CDR, médico, **resultado** (apto/apto con observaciones/no apto) |
| Médico (LOPCYMAT) | Examen médico periódico / de egreso | vencimiento anual según norma, institución, médico |
| Médico | Carnet de vacunación | vacunas, fechas |
| Médico | Certificado CONAPDIS (discapacidad) | número, vigencia; alimenta cuota de inclusión (5% — corresponsabilidad legal) |
| Familia | Partidas de nacimiento (cargas) | familiar vinculado, fecha de nacimiento |
| Familia | Acta de matrimonio / certificado discapacidad de familiar | familiar vinculado, vigencia |
| SST | Constancia de inducción SST | fecha, duración; alimenta horas de capacitación SST |
| Banca | (datos de cuenta — no es documento) | ver `bank_accounts` |

**Alertas de cumplimiento:** vencimientos próximos (certificado médico, licencia, certificaciones) y **requisitos faltantes según ley/sector** (`document_requirements`) → notificaciones al trabajador y a RRHH (rail estilo Patria).

## 9. Pendientes de verificación (checklist M2)

- [ ] Valores vigentes de UT, salario mínimo y tope IVSS en Gaceta Oficial (al implementar)
- [ ] Tarifas IVSS por clase de riesgo y procedimiento de enteramiento
- [ ] Algoritmo dígito verificador RIF contra validador oficial del SENIAT — **incluye resolver tres puntos abiertos de §1.1**: conjunto completo de prefijos (¿`C` es válido o convención interna de `sistema_caja_bimoneda`?), longitud del cuerpo por tipo de contribuyente, y ponderaciones/módulo del algoritmo
- [ ] División territorial oficial de primer nivel: confirmar las 24 unidades ADM1 y la forma de tratar las Dependencias Federales (§1.2)
- [ ] Formato exacto de ARC y comprobantes exigidos en la práctica contable actual
- [ ] Regímenes especiales del sector público (alcance mínimo viable)
- [ ] Publicación en Gaceta de las nuevas tablas por sectores anunciadas en may-2026 (montos y vigencia)
- [ ] Confirmar en Gaceta/ONAPRE la vigencia exacta del documento de ajuste APN de §5.1 y su proceso de salarización de bonos
- [ ] Texto literal en Gaceta de la LOTTT sobre el registro/inscripción del trabajador (número de artículo según versión) y de la LOPCYMAT Art. 56 + Reglamento (Arts. 27–28) sobre exámenes médicos
- [ ] Requisitos vigentes del IVSS (inscripción, declaración de salarios/SICOSS, subsidios de reposo) y del RANEO para el expediente SST
