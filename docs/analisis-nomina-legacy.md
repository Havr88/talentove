# Análisis de la nómina legacy — estructura del libro de cálculo

> Estado: v0.1 (2026-09-27). Fuente: encabezados de las 6 hojas del libro de nómina legacy aportados por el sponsor. **El archivo con fórmulas (sin datos) llegará en una próxima interacción** — este documento se ampliará con el análisis de fórmulas (precioso para calibrar `packages/domain`).

## 1. Las 6 hojas = 6 poblaciones de nómina

| Hoja | Población | Particularidades |
|---|---|---|
| ALTO NIVEL Y DIRECCIÓN | AN/dirección | Única con **Aporte Patronal** en hoja; Bono de Jerarquía ×3 variantes; Compensatorio LNR; Asignación de Carrera; RIF + cuenta bancaria |
| NOMINA PERSONAL ADMINISTRATIVO FIJO | Administrativo fijo | Deducción **Sindicato 1%**; % evaluativo → Prima ODI |
| OBREROS FIJOS | Obrero fijo | Feriados **trabajados y NO trabajados por Convención Colectiva**; separa Meses Institución (SUELDO) vs (VACACIONES) |
| NOMINA DEL PERSONAL ADMINISTRATIVO CONTRATADO | Administrativo contratado | Fechas de primer/último contrato; **vacaciones por continuidad (2023)** con mes programado |
| OBREROS CONTRATADOS | Obrero contratado | Igual que obreros fijos + fechas de contrato |
| NOMINA DEL PERSONAL ENTRENADORES CONTRATADOS | Entrenadores contratados | **DISCIPLINA** (especialización), datos de contacto (dirección, zona, teléfono), observaciones, **Contratos en Archivo** (verificación documental) |

La estructura por filas confirma el diseño de TalentoVe: un solo motor de nómina filtrado por `personnel_type` (condición laboral), no 6 hojas independientes.

## 2. Estructura común por bloques (independiente de la hoja)

1. **Identificación:** Nº, NAC (nacionalidad = prefijo de cédula), ESTATUS DEL CARGO, cédula, RIF, cuenta banco, **TABULADOR SALARIAL** (grupo-nivel: PI-IV, GRD-05…), nombres, CARGO, UBICACIÓN (unidad).
2. **Datos personales:** fecha de nacimiento, edad, **GRD INSTR** (grado de instrucción → prima profesionalización), **Nro Hijos**, **Nro Hijos Excepcionales** (→ prima por hijos excepcionales; en nuestro modelo deriva de cargas familiares con certificado CONAPDIS).
3. **Antigüedad MULTI-BASE** (hallazgo mayor): coexisten *Fecha de Ingreso Adm Pública*, *Fecha de Ingreso Institución* (y variantes: Nómina AN, Fijo Institución, Primer Contrato, Último Contrato), *Años Total Serv Adm Pública*, *Años Antecedentes*, *Años/Meses en Institución* — y en obreros/contratados **bases distintas para SUELDO vs VACACIONES** ("Meses Institución (SUELDO)" / "(VACACIONES)"; contratados: "FECHA PARA VACACIONES tomando continuidad del 2023" + "MES PARA VACACIONES").
4. **Insumos de tiempo** (input manual en el legacy; en TalentoVe llegan del motor de solicitudes/asistencia): Bono Nocturno, Horas Extra Diurnas/Nocturnas (**en DÍAS** como input y **CÁLCULO** como monto — el patrón input/cálculo del legacy desaparece con nuestro motor), Sábados, Domingos, **Feriados Trabajados y NO Trabajados por Convención Colectiva**.
5. **Salario:** SUELDO MENSUAL (desde `salary_scales` por tabulador), PERIODO A PAGAR, DIAS A PAGAR, SUELDO QUINCENAL (± deducciones).
6. **Asignaciones (conceptos):** Compensatorio por Años de Servicio (mensual, quincenal y **quincenal "para Antigüedad"**), Prima de Antigüedad, Prima por Hijos, **Prima por Hijos Excepcionales**, Prima Profesional, **% PRIMA DE EVALUACIÓN → PRIMA ODI Evaluación de Desempeño**, **Bono de Jerarquía (mensual / quincenal / quincenal "para incidencia")**, Asignación de Carrera (AN), Compensatorio LNR.
7. **Totales:** Total Asignación Sueldos + Primas, Total Asignación Quincenal, Total Sobretiempo (obreros).
8. **Deducciones:** **S.S.O 4%**, **P.I.E 0,5%** (paro forzoso/empleo = nuestro RPE), **L.P.H 1%** (Ley de Política Habitacional = nuestro FAOV), **Sindicato 1%**, Otras Deducciones, Total, Total a Pagar Quincena.
9. **Aporte patronal** (solo visible en hoja AN): **S.S.O 9%, P.I.E 2%, L.P.H 2%** — porcentajes idénticos a nuestra `rate_tables` (IVSS 9%, RPE 2%, FAOV 2%). Las otras hojas seguramente lo calculan aparte (resumen patronal).

## 3. Conceptos NUEVOS detectados (no estaban en el plan)

| Concepto | Naturaleza | Preguntas para el archivo de fórmulas |
|---|---|---|
| **Compensatorio por Años de Servicio** | Asignación mensual/quincenal, distinta de la prima de antigüedad | ¿Fórmula? ¿Incide en prestaciones? ¿Por qué existe la variante "para Antigüedad"? |
| **Bono de Jerarquía** | Asignación ×3 variantes (mensual, quincenal, quincenal "para incidencia") | El patrón "para incidencia" confirma que el legacy separa el pago del concepto de la base que incide en prestaciones — ¿es el % jerárquico de la tabla AN aplicado sobre qué base? |
| **Prima ODI Evaluación de Desempeño** | Asignación por % evaluativo | ¿Qué es ODI? ¿Escala del %? ¿Frecuencia de la evaluación? |
| **Bono Nocturno** | Asignación | ¿Fijo por turno nocturno o por horas? |
| **Deducción Sindicato 1%** | Deducción | ¿Aplica solo a afiliados? ¿Se maneja por convenio? |
| **Prima por Hijos Excepcionales** | Asignación fija | ¿Monto igual a prima por hijos (12,50) o distinto? |
| **Feriados NO trabajados pagados por Convención Colectiva** | Asignación | ¿Qué convención aplica? (confirma `collective_agreements` → `rule_sets`) |
| **Asignación de Carrera / Compensatorio LNR** (AN) | Asignaciones propias del tramo | ¿Fórmulas y bases de incidencia? |
| **Doble base de antigüedad** | Dominio | ¿Qué base usa cada cálculo (sueldo, vacaciones, antigüedad)? ¿Regla de continuidad 2023 para contratados? |

## 4. Mapeo al modelo TalentoVe

- **`employees`**: añade `fecha_ingreso_apn?` (adm. pública, distinta del ingreso a la institución) y `anios_reconocidos?` (antigüedad reconocida por convenios). NAC ya vive en `cedula_tipo` (V/E). Hijos excepcionales se **deriva** de `employee_contacts` con certificado CONAPDIS (no se captura como número suelto).
- **`contracts`**: las fechas de primer/último contrato de los contratados ya viven en el histórico de contratos; el ingreso a la institución es `contracts.fecha_ingreso`.
- **`payroll_concepts` (seed del piloto, M2a)**: el inventario de §3 define el catálogo inicial — compensatorio años de servicio, bono de jerarquía (con sus 3 variantes), prima ODI, bono nocturno, primas de hijos (normal/excepcional), prima de antigüedad, prima profesionalización, feriados conv. colectiva, más deducciones (SSO/PIE/LPH/sindicato) y aporte patronal (SSO/PIE/LPH). **Esperar el archivo de fórmulas** para cerrar fórmulas y flags de incidencia.
- **Patrón input→cálculo**: las columnas "DIAS" (input) vs "CALCULO" (monto) del legacy se sustituyen por `overtime_requests` aprobadas + cálculo en `packages/domain` — elimina el error humano de doble digitación.
- **Resumen patronal**: si el legacy lo lleva aparte, en TalentoVe es un reporte del período (`payroll_runs` → totales por aporte), no una hoja más.

## 5. Pendientes para el análisis con el archivo de fórmulas

- [ ] Fórmula y bases de incidencia del Compensatorio por Años de Servicio (y variante "para Antigüedad")
- [ ] Fórmula del Bono de Jerarquía (base del % jerárquico; por qué 3 variantes)
- [ ] Prima ODI: escala, frecuencia y quién la carga
- [ ] Bono nocturno: fórmula
- [ ] Regla de continuidad de vacaciones 2023 para contratados
- [ ] Convención colectiva aplicable a obreros (feriados no trabajados)
- [ ] Confirmar unidades de la tabla AN (sueldo 31,36 vs 447) y grupos MI/MII/EI/EII
- [ ] ¿Las otras hojas calculan aporte patronal aparte? ¿Dónde?

---

# Análisis del archivo con fórmulas (v0.2 — 2026-09-27)

Fuente: `ejemplo.xls` (13 hojas: TblSalariales + 12 nóminas). Datos vaciados por el sponsor (los #VALUE! se esperan); análisis de fórmulas, constantes manuales y errores.

## 6. La hoja TblSalariales = `rate_tables` + catálogos (ya todo mapea)

PrmAntg (años→%, 0–30 tope 23) · RANGO/SUELDO AN (447→348) · códigos ADMIN (BI-I…PIII-VII) · OBRERO GRD (01-10 MIN/MAX) · matriz NIVELES (montos) · TABLA OBRERAS con categorías (no calificados/calificados/supervisor) · PRM×HJOS 12,50 · BNO ALIMENTICIO 45 · GRD DE INSTRUCC (BACH 0%…DOCT 40%) · DEPENDENCIA (+MINISTERIO) · **SALARIO MÍNIMO 130** · **catálogo ESTATUS con bandera A/S** (A=activo cobra; **S=no cobra**: AVERIGUACIÓN ADM, ABANDONO, AUSENTE, DESTITUIDO, FALLECIDO, FIN DE CONTRATO, RENUNCIA, SE DESCONOCE, CARGO A CREAR son S) — responde la pregunta de qué situaciones cobran. **Rangos con nombre** usados: `TblStatus, TblSal_Lnr, TblSal_Adm, TblSal_Obr, RngObr, PrmAntg, PrmAntg_Salud, PrmHjos, PorcInstruc, PorcJerarquia, NSemApt`.

## 7. Fórmulas decodificadas (especificación de facto para `packages/domain`)

| Concepto | Fórmula legacy (ALTO NIVEL, fila tipo) | Lectura |
|---|---|---|
| Sueldo quincenal | `ROUND(AB/30*AC,2)` | **mensual ÷ 30 × días a pagar** (no ÷2; AC=Días a Pagar del período) |
| **SALARIO NORMAL (Y)** | `ROUND((AD+AG+AI+AK+AL+AM+AN+AP)*2,2)` | **= (sueldo qna + comp qna + primas + bono jerarq qna) × 2**: el salario normal LOTTT es el total de asignaciones con incidencia, mensualizado |
| Sueldo mensual (Z) | `IF(VLOOKUP(cédula,TblStatus)="A", VLOOKUP(tabulador,TblSal_Lnr), "ӿ")` | **gated por estatus A/S**: S = no cobra |
| Prima antigüedad (AI) | `ROUND((AD+AG+AJ+AL+AM+AP)*VLOOKUP(años,PrmAntg,TRUE),2)` | base de incidencia **excluye la prima profesional** |
| Prima hijos (AJ) | `ROUND((P*PrmHjos)/2*AC,2)` | hijos × 12,50 ÷ 2 × días |
| Prima hijos excepcionales (AL) | `ROUND(AD*35%*Q,2)` | **35% del sueldo quincenal × nro excepcionales** (¡no es 12,50!) |
| Prima evaluación ODI (AM) | `ROUND(AD*12.5%,2)` | 12,5% del sueldo quincenal |
| Prima profesión (AN) | `ROUND((AD+AG+AI+AJ+AL+AM+AP)*VLOOKUP(grd,PorcInstruc),2)` | base **incluye antigüedad** (y la propia base excluye AN) — asimetría con AI |
| Bono jerarquía mensual (AO) | `ROUND([4]TblSalariales!$M$45*VLOOKUP(tab,PorcJerarquia),2)` | ⚠️ **referencia externa a OTRO libro** — el valor base (¿447?) vive fuera |
| Deducción S.S.O. | `ROUND(AD*12/52*4%*NSemApt,2)` | **semanalizado × % × semanas aptas del período** |
| Deducción P.I.E. | `ROUND(AD*12/52*0.5%*NSemApt,2)` | idem 0,5% |
| Deducción L.P.H. | `ROUND(AD*1%,2)` | **sin semanas aptas** (flat sobre quincenal) |
| Aporte patronal | idem SSO/PIE/LPH con 9%/2%/2% | espejo de deducciones |
| Sobretiempo obreros | `ROUND((((AP*2)/30)/8)*Y*1.5*1.3,2)` | valor-hora (sueldo ×2/30/8) × unidades × **1,5 (diurna) × 1,3 (nocturno)** |

**Parámetros por período** (encabezados de cada hoja → `payroll_periods`): Días a Pagar, Días Aporte, **N° Sem. Aporte** (NSemApt — semanas cotizables IVSS), y para pensionados "Pagar Aportes" (S/N).

## 8. Errores y advertencias encontrados (los que sospechabas)

1. **#VALUE! masivos y benignos**: 643 (AN), 2.025 (Admin Fijo), 133 (Jubilados), 324 (Salud), etc. — cascadan de DATEDIF/aritmética sobre celdas vacías al vaciar datos. No son defectos de fórmula en sí.
2. **Fórmulas inconsistentes entre filas (reales)**: Prima de evaluación AN: 40 filas `AD*12,5%` vs 6 filas `(Z*X%)/2` — dos criterios distintos. P.I.E.: 24 filas sobre AD vs 2 sobre AB. JUBILADOS: 1 fila usa base distinta y otra usa `PrmAntg_Salud` (tabla de antigüedad de salud) — el legacy mezcla tablas por fila.
3. **Fudge factors ±0,01** en JUBILADOS (AD17 `…-0.01`, AD26 `…+0.01`): ajuste manual para "cuadrar" centavos — en TalentoVe lo resuelve el redondeo formal de `packages/domain`.
4. **Referencia externa `[4]TblSalariales!$M$45`** en el Bono de Jerarquía: la tabla del bono vive en **otro libro** — pedir ese archivo o el valor.
5. **ADMINIST. FIJO: prima de antigüedad rota en TODAS las filas** (AF: `#VALUE!` ×184) — la fórmula existe pero referencia celdas hoy vacías; verificar contra la hoja con datos.
6. **AE (Admin Fijo) = `ROUND(AD/2)`** mientras AN usa `/30×días` — dos criterios de quincenalización conviviendo; confirmar cuál es el correcto por tipo de personal.

## 9. Celdas escritas a mano (inventario, excluye bloques de firmas)

| Dónde | Qué | Lectura |
|---|---|---|
| AN!AF (Compensatorio LNR Mensual) | **48/48 celdas manuales** | concepto 100% manual en el legacy → en TalentoVe será `payroll_concepts` con carga por período |
| AN!AH/AK/AQ | 17/19/4 overrides con 0 | patrón "copiar fórmula y pisar a mano" — desaparece con conceptos paramétricos |
| AN fila 16 | AN=180,58 · AO=590,66 · AP=295,33 | resultado manual de prima profesión/jerarquía de un trabajador |
| AN!O18=30 (¡edad!), R44/R52=0, AT14=0 | datos pisados | riesgo de obsolescencia (la edad no se actualiza sola) |
| ADMIN Fijo: AD (184), AX (164), AG (180) | Días a Pagar y deducciones/compensatorios por fila | inputs manuales → en TalentoVe: parámetros del período + conceptos |
| ADMIN CONTRATADO: AH (85), AK (84), P (`+1`/`-1` años) | primas manuales y ajustes de años | los ajustes de años son antigüedad reconocida → `employees.anios_reconocidos` |
| ENTRENADORES: AL (145), AO (146) | columnas mayormente manuales | identificar qué concepto es al validar con datos |
| JUBILADOS: X/Y/Z/AA (~25 c/u) | montos manuales por fila | pensionados calculados a mano |
| Firmas (todas las hojas) | ELABORADO/REVISADO/APROBADO POR (5 funcionarios: Directora (E) de Talento Humano, Coordinador del Área de Nómina, Analista de Personal IV, Coordinadora del Área de Administración, Coordinador del Área Técnica — nombres redactados) | en TalentoVe: auditoría + firma electrónica, no bloques en la hoja |

## 10. Impacto en el modelo (actualizaciones aplicadas)

- `payroll_periods`: parámetros `dias_a_pagar`, `dias_aporte`, `semanas_apte` (NSemApt), `pagar_aportes` (pensionados).
- `packages/domain` (M2a): las fórmulas de §7 son la especificación a testear — con las preguntas de §5 del análisis previo aún abiertas (compensatorio, jerarquía, ODI).
- Nuevos conceptos confirmados en el legacy: **Prima Escalafón por Acta Convenio** (SALUD FIJO), Compensatorio por Años de Servicio (LNR), patrón de "quincenal para incidencia".
- Toda la lógica de estatus A/S del legacy = nuestro `employee_situations.afecta_nomina` (la bandera S del legacy confirma qué situaciones suspenden el pago).

## 11. La telaraña de vínculos externos (2026-09-27)

El Bono de Jerarquía (`ALTO NIVEL!AO`) referencia `[4]TblSalariales!$M$45` — **un archivo externo**, resuelto del paquete xlsx:

- **Libro:** `2° QUINCENA AGOSTO 2025 ALTO NIVEL - PAGADO.xlsx` (en `C:\Users\pc\Desktop\PERSONAL 2025\NOMINAS 2025\08 AGOSTO\ALTO NIVEL\`)
- **Celda:** hoja `TblSalariales`, **M45 = 492,22** (valor cacheado en el archivo) — la **base del Bono de Jerarquía**: bono = 492,22 × % jerárquico del rango (30–60%).

**El libro encadena a 24 archivos externos**: nóminas de quincenas anteriores (julio/agosto 2025 de AN, obreros, contratados, salud, entrenadores, jubilados, incapacitados, pensionados) repartidas en escritorios de **varias PCs distintas** (`Users/pc`, `Users/indra`, `Users/ARCHIVO`, `Users/EQUIPO-1`), carpetas compartidas, **Descargas y Temp** (módulos de corrección `ModReac2021_V06.FixAportes.xlsx`, `V9.AdicJubPens.xlsx`, `V081.AdicStatus.xlsx` — uno recibido por correo de la Gobernación), y un archivo dedicado al bono (`BONO DE JERARQUIA 2°Q AGOSTO 2025 ALTO NIVEL.xlsx`).

**Consecuencia de diseño:** la nómina de una quincena depende de las quincenas anteriores por referencias entre archivos — si un archivo se mueve, renombra o está en la PC equivocada, la nómina se rompe (explica los 0,00 y errores). TalentoVe sustituye la cadena por `rate_tables` con vigencia + **snapshot de tasas por corrida** (`payroll_runs` ya lo contempla): cada quincena es autónoma y reproducible.

## 12. Moneda confirmada (2026-09-27)

El sponsor confirmó: **todos los valores monetarios del libro están en bolívares (VES)** — incluida la base del Bono de Jerarquía (M45 = **Bs 492,22**), las tablas administrativas (BI 130…PIII 316), obreros (GRD 130–219), primas fijas (hijos Bs 12,50; alimenticio Bs 45) y las dos tablas de Alto Nivel. Queda abierto únicamente: la **relación entre las dos tablas AN** (tabla A: sueldos 31,36–23,80 Bs vs tabla B: 447–348 Bs — distintos conceptos o momentos) y la fórmula exacta del % jerárquico sobre M45. Nota de contexto: el tabulador formal en Bs es de monto reducido (fenómeno conocido del sector público venezolano, donde el ingreso efectivo incluye bonos no salariales pagados fuera de esta nómina — ver `regionalizacion-venezuela.md` §5.2 y los flags de incidencia de `payroll_concepts`).
