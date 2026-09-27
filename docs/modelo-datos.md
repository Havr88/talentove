# Modelo de datos núcleo — TalentoVe

> Estado: v0.2 (2026-09-27). Esquema a nivel de diseño; el SQL vivo vive en las migraciones de `apps/server` (node-pg-migrate).

## Convenciones

- PK: `uuid` (generadas en app). `created_at`/`updated_at` con zona horaria (`timestamptz`).
- Soft-delete: `deleted_at timestamptz null` en entidades sensibles.
- Dinero: `numeric(20,2)` + `currency` (`'VES' | 'USD'`) + `fx_rate numeric(20,8)` capturada al momento de cada transacción monetaria (dualidad Bs/USD).
- Todo parámetro legal vive en `rate_tables`/`rule_sets` con vigencia y fuente — **jamás hardcodeado**.
- `audit_log` append-only registra acciones sensibles (quién/qué/cuándo/antes-después).

## Organización y estructura

| Tabla | Propósito | Columnas clave |
|---|---|---|
| `companies` | Entidades legales del grupo (RIF propio; una instalación puede tener varias, p.ej. un holding) | `rif`, `razon_social`, `sector ('publico'\|'privado')`, `activa` |
| `locations` | Sedes/centros de trabajo | `company_id`, `estado`, `municipio`, `parroquia`, `direccion` |
| `org_unit_types` | Tipos de unidad **configurables** (terminología editable por instalación) | `name ('direccion','gerencia','coordinacion','departamento','unidad','almacen',…)`, `nivel_jerarquico` |
| `org_units` | Unidades organizativas jerárquicas (**sustituyen a `departments`**: no existe tabla `departments`; todo el modelo usa `org_unit_id`) | `parent_id`, `type_id`, `name`, `location_id`, `head_assignment_id?` |
| `positions` | Catálogo de cargos **totalmente editable** (seed de `data/ve/cargos.json`; CRUD completo en admin — crear/editar/activar-desactivar/importar; el re-seed jamás sobrescribe ediciones) | `codigo?`, `name`, `categoria`, `grupo_isco` (1–9 OIT), `aplica_sector ('ambos','publico','privado')`, `nivel_tabulador_apn?` (BI–PIII, Obrero G1-G4), `salary_min`, `salary_max`, `salary_currency ('VES','USD')`, `salary_vigente_desde`, `salary_fuente`?, `activo` — el rango salarial es **referencia de mercado con vigencia y fuente**, no un valor legal: para montos con fuerza legal (tabuladores) usar `salary_scales` |
| `assignments` | **Asignación con vigencia** empleado↔unidad+cargo (histórico completo) | `employee_id`, `org_unit_id`, `position_id`, `desde`, `hasta?`, `es_responsable` |
| `staff_movements` | Movimientos de personal (transferencia, cambio de cargo/sede) con workflow | `employee_id`, `origen/detino (unit+position)`, `fecha_efectiva`, `estado`, `request_id?`, `efecto_salarial` |

## Personas

| Tabla | Propósito | Columnas clave |
|---|---|---|
| `employees` | El trabajador | `cedula_tipo ('V'\|'E')`, `cedula_numero` (único), `rif`, `nombres`, `apellidos`, `fecha_nacimiento`, `sexo`, `estado_civil`, `direccion`, `employee_status ('activo','reposo','vacaciones','suspendido','retirado')` |
| `personnel_types` | **Tipos de personal** (catálogo editable, seed de `data/ve/tipos-personal.json`: obrero fijo/contratado, administrativo fijo/contratado, técnico, profesional, Alto Nivel, LNR, confianza, docente, LOTTT por duración, becas/honorarios…) | `nombre`, `grupo`, `vinculo ('indeterminado','determinado','obra','eventual','estacional','ocasional','parcial','honorarios','beca','militar')`, `sector`, **`relacion_laboral`** (False = sin prestaciones ni parafiscales: becas/pasantes/honorarios), `base_legal`, `tabulador_apn?` |
| `contracts` | Contratos / relación laboral | `employee_id`, `company_id`, `location_id`, `org_unit_id` (unidad de inicio; los cambios posteriores viven en `assignments`/`staff_movements`, **no** aquí), `position_id`, `personnel_type_id` (tipo de personal), `tipo ('indeterminado','determinado','obra_labor')`, `fecha_ingreso`, `fecha_fin`, `salario_base`, `currency`, `jornada_horas` |
| `employee_contacts` | Cargas familiares y beneficiarios (patrón "Familia" de Patria) | `employee_id`, `cedula`, `nombres`, `apellidos`, `parentesco`, `estado ('pendiente','aprobado','rechazado')` |
| `document_types` | **Catálogo de tipos de documento del expediente**, con metadatos específicos por tipo | `codigo`, `nombre`, `seccion ('identidad','academico','laboral','medico','familia','sst','banca')`, `requiere_vencimiento`, `metadata_schema jsonb` (campos propios del tipo: titulo_obtenido, nivel_academico, anio_graduacion, nombre_curso, horas, institucion, medico, clinica, clase_licencia…), `base_legal`, `aplica_sector ('ambos','publico','privado')` |
| `employee_documents` | Instancia de documento del expediente con metadatos según su tipo | `employee_id`, `document_type_id`, `fecha_emision`, `fecha_vencimiento?` (alertas de vencimiento), `metadata jsonb` (validada contra el schema del tipo), `file_id`, `estado ('pendiente','aprobado','rechazado')`, `revisado_por`, `comentario` |
| `document_requirements` | Requisitos documentales **obligatorios por ley/sector** que alimentan el checklist de completitud | `company_id?`, `document_type_id`, `obligatorio`, `momento ('ingreso','permanencia','egreso')` |
| `bank_accounts` | Cuentas para pago de nómina | `employee_id`, `financial_institution_id` (código SUDEBAN — dataset `data/ve/bancos.json`), `tipo ('corriente','ahorro')`, `numero` (20 dígitos, enmascarado; validado: 4 primeros = código de banco) |
| `financial_institutions` | Instituciones financieras (seed del dataset `data/ve/bancos.json`) | `codigo` (4 dígitos, PK natural), `nombre`, `rif`, `sector`, `activa` |
| `users` | Accesos al sistema | `employee_id?` (null para admin externo), `email`, `password_hash (argon2id)`, `totp_secret?`, `ultimo_acceso` |
| `roles` / `user_roles` | RBAC | `role ('superadmin','admin_rrhh','aprobador','empleado','auditor')` |
| `sessions` | Sesiones activas. Solo el **hash SHA-256** del token (ADR-0007) | `user_id`, `token_hash`, `expires_at`, `last_seen_at`, `ip`, `user_agent` |
| `onboarding_tokens` | Incorporación self-service por token (patrón "por Hash" de Patria) | `token_hash`, `propósito`, `expira_el`, `usado_el` |

## Motor de solicitudes del trabajador (M1b)

| Tabla | Propósito | Columnas clave |
|---|---|---|
| `request_types` | Catálogo configurable por instalación | `codigo`, `nombre`, `form_schema jsonb`, `approval_chain jsonb` (resolutores: jefe_directo/coordinador/rol/usuario), `sla_horas`, `adjuntos`, `incide_nomina` |
| `requests` | Solicitud genérica de cualquier tipo | `employee_id`, `type_id`, `payload jsonb`, `estado ('borrador','enviada','en_revision','aprobada','rechazada','devuelta','cancelada','completada')`, `paso_actual`, `sla_vence_el` |
| `request_steps` | Pasos de aprobación (timeline inmutable) | `request_id`, `orden`, `resolver`, `resuelto_por`, `accion ('aprobar','rechazar','devolver')`, `comentario` |
| `request_attachments` | Adjuntos de la solicitud | `request_id`, `file_id` |
| `delegations` | Delegación de aprobaciones (coordinador ausente) | `delegado_por`, `delegado_a`, `desde`, `hasta`, `org_unit_id?` |
| `holidays` | Calendario de feriados paramétrico | `fecha`, `nombre`, `ambito ('nacional','local')`, `location_id?` |
| `leave_types` / `leave_balances` / `leave_requests` | Vacaciones, permisos, **reposos médicos (aval IVSS)** y **licencias**, integrados al motor | `leave_types.subtipo ('vacaciones','permiso','reposo_medico','licencia_maternidad','licencia_paternidad','luto',…)`, `dias_default` paramétrico; `leave_requests.ivss_referencia?` (adjunto/aval del reposo), `dias_incapacidad`; saldos por año con fórmula LOTTT |

## Tiempo y asistencia extendida (M1b/M2b)

| Tabla | Propósito | Columnas clave |
|---|---|---|
| `shift_types` | Tipos de turno (rotativos, cruces de medianoche) | `name`, `hora_inicio`, `hora_fin`, `crosses_midnight`, `duration_hours` |
| `schedule_plans` | Cuadrantes semanales/mensuales por unidad | `org_unit_id`, `semana`, `estado` |
| `shift_assignments` | Asignación turno por trabajador/fecha | `employee_id`, `shift_type_id`, `fecha`, `origen`, `estado`, `swap_id?` |
| `shift_swaps` | Intercambio de turnos con aprobación del coordinador | `pide`, `acepta`, `estado`, `request_id?` |
| `attendance_marks` | Marcaciones multi-fuente | `employee_id`, `fecha`, `tipo ('entrada','salida')`, `origen ('web','qr','biometrico','manual')`, `device_id?` |
| `attendance_closes` (+ `revisions`) | Cierre mensual auditable con revisiones (patrón `month_closes`) | `org_unit_id`, `mes`, `estado`, `hash_cadena` |
| `biometric_imports` | Importación desde relojes biométricos (ZKTeco) | `archivo`, `device_id`, `registros`, `errores` |
| `overtime_requests` | **Horas extra y días feriados/descanso laborados**: reporte/solicitud del trabajador o registro del coordinador, aprobación del jefe | `employee_id`, `fecha`, `tipo ('extra_diurna','extra_nocturna','feriado_laborado','descanso_laborado')`, `horas`, `request_id?`; recargos LOTTT paramétricos aplicados en nómina (M2a) |

## Nómina (M2a)

| Tabla | Propósito |
|---|---|
| `payroll_periods` | Períodos (quincenal/mensual) con cierre: `estado ('abierto','calculado','cerrado')` |
| `payroll_concepts` | Catálogo configurable: asignaciones y deducciones. La fórmula se referencia por **`formula_key` cerrado en el código + `params jsonb` validado con zod**, nunca por expresión ejecutable (ADR-0009) + **flags de incidencia**: `incide_prestaciones`, `incide_utilidades`, `incide_bono_vacacional`, `incide_parafiscales` — críticos en sector público, donde bonos como el de Guerra/Alimentación **no inciden** en prestaciones |
| `payroll_runs` | Corrida por período/companía + snapshot de tasas usadas |
| `payroll_items` | Renglones por empleado/concepto del período, con `formula_key`+`formula_version`+`params`+`applied_rule_ids`+`fx_rate` usados: el recibo es reproducible (ADR-0009) |
| `payroll_accumulators` | Acumuladores para utilidades, prestaciones (garantía + complemento), intereses, utilidades pagadas (base INCES 0,5%) |
| `anticipos` | Anticipos de salario con límite paramétrico (patrón "Adelanto de Fondos": % del promedio de N meses) y saldo negativo en consolidado |
| `settlements` | Liquidación de beneficios al retiro (detalle completo) |
| `receipts` | Recibos de pago emitidos (PDF generado con pdfmake) |

## Parámetros legales (transversal)

| Tabla | Propósito | Columnas clave |
|---|---|---|
| `rate_tables` | Valores monetarios/porcentuales con vigencia | `tipo ('UT','BCV_USD','IVSS_SSO_PATRONO','IVSS_TOPE_SMU','FAOV_TRABAJADOR',…)`, `valor numeric`, `vigente_desde`, `vigente_hasta?`, `fuente` (Gaceta/circular) |
| `rule_sets` | Reglas por sector. **Un registro = un sector + una clave + un valor** (nunca dos valores en el mismo registro) | `sector ('publico'\|'privado')`, `clave`, `valor jsonb`, `vigente_desde`, `vigente_hasta?`, `fuente` |
| `salary_scales` | Tabuladores (sector público) | `rule_set_id`, `nivel`, `monto`, `currency`, `vigente_desde`, `fuente` |

## Talento y ciclo de vida (M3)

`vacancies` (vacantes + página pública), `applications` (postulaciones con pipeline), `interviews` (máquina de estados Reservada→Confirmada→Atendida→Cancelada con motivo/autor), `evaluations` + `evaluation_templates` (desempeño), `trainings` + `training_attendance` (capacitación, horas INCES), `committees` + `committee_members` (comités: SST, alimentación, sindicato).

**SST:** `sst_accidents` (accidente/enfermedad ocupacional: descripción, causas, testigos, medidas, reporte IVSS/INPSASEL), `epp_deliveries` (entrega de equipos de protección con firma y reposición por vencimiento), `medical_exams` (pre-empleo/periódico/egreso con agendamiento).

**Activos asignados:** `assets` (equipos/uniformes con QR), `asset_assignments` (custodia con acta, check-in/check-out, firma canvas), vinculado al egreso (bloqueo de liquidación configurable).

**Onboarding/Offboarding:** `onboarding_checklists` + `checklist_items` (ingreso por cargo, con la **Notificación de Riesgos/Derecho a Saber** como ítem bloqueante), `exit_processes` (tipo de egreso, entrevista, encuesta, estado de liquidación, **emisión de Forma 14-100 IVSS y constancia de trabajo**).

**Relaciones laborales y retención (M3):** `labor_authority_notices` (notificaciones/citaciones/reclamos de la Inspectoría del Trabajo: recibida_el, plazo, estado, responsable), `collective_agreements` (convención colectiva aplicable: vigencia, conceptos adicionales — referenciable desde `rule_sets`), `benefit_programs` + `employee_benefits` (beneficios del paquete de retención no obligatorios: salud privada, bono de productividad en divisas, transporte, comedor — por trabajador o grupo).

**Libros legales (M1a):** `legal_register_issues` — emisiones de libros legales digitales generados de los datos reales (libro de contratos de trabajo con firma en duplicado Art. 59, registro de ingreso, libro de vacaciones, libro de reclamaciones): `tipo`, `company_id`, `periodo`, `pdf`, `hash`, `emitido_el` (los libros son **vistas imprimibles con numeración correlativa**, no duplican datos).

## Integraciones y extensiones (M2b/M4)

| Tabla | Propósito |
|---|---|
| `bank_payment_files` | Archivos bancarios de pago de nómina (adaptador paramétrico por banco: layout, estado, totales) |
| `gov_export_files` | Archivos de cotización IVSS / FAOV-BANAVIH / INCES generados por período |
| `accounting_exports` | Export contable de nómina (asientos dual Bs/USD) |
| `savings_accounts` / `savings_loans` / `savings_installments` | Caja de ahorro: aportes, préstamos con avales y **tabla de amortización** (fórmula en `packages/domain`) |
| `recognitions` | Reconocimientos internos con PDF de membrete |
| `import_batches` | Cargas masivas (entidad, archivo, dry-run, errores por fila) |

## Comunicación y configuración

| Tabla | Propósito |
|---|---|
| `notifications` | Notificaciones in-app (rail derecho estilo Patria: color/tipo/acción) |
| `announcements` | Comunicados internos (panel del trabajador, scroll infinito) |
| `banners` | Slots de comunicación del rail (marca blanca) |
| `surveys` + `survey_responses` | Encuestas internas de un clic (siempre POST) |
| `settings` | Branding, terminología, módulos activados, SMTP de la instalación (key/value jsonb) |
| `files` | Metadatos de documentos subidos: `key` opaca, `original_name`, `content_type_detectado`, `size`, `sha256`, `subido_por` (ADR-0008) |
| `audit_log` | Append-only: `user_id`, `accion`, `tabla`, `registro_id`, `antes jsonb`, `después jsonb` |
