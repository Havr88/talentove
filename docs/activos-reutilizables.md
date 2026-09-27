# Activos reutilizables en el entorno local — propuesta de incorporación

> Estado: v1.0 (2026-09-26). Resultado del análisis de ~30 proyectos/activos de `/home/havr` (3 exploraciones en paralelo). Objetivo: qué aprovechar de los proyectos existentes para acelerar TalentoVe, con su ruta exacta y veredicto.

## 1. Incorporaciones prioritarias (top 8)

| # | Activo | Ruta | Veredicto | Beneficio para TalentoVe |
|---|---|---|---|---|
| 1 | **Servicio de tasas Bs/USD** con histórico y fuente | `sistema_caja_bimoneda/server_ts/src/services/rateService.ts` + `database.ts` (Exchange 5+zod) | [COPIAR-DOMINIO] | Sincronización BCV vía `ve.dolarapi.com` con fallback, tasa MANUAL por admin, tabla `exchange_rates` con `source ∈ {BCV, MANUAL, API}` — es exactamente `rate_tables` del modelo; portar a PostgreSQL |
| 2 | **Calculadora fiscal pura** (IVA 16/8/exento + IGTF 3%) | `omni_pos_app/lib/core/fiscal/tax_calculator.dart` + `tax_rule.dart` (MIT) | [COPIAR-DOMINIO] | Paradigma idéntico al exigido en AGENTS.md (función pura, params inyectados, `TaxBreakdown`); portar Dart→TS a `packages/domain` |
| 3 | **Schema bimoneda + validación de doc VE** | `sistema_caja_bimoneda/server_ts/src/database.ts` (doc_type `V/E/J/G/C` + UNIQUE, `bank_accounts` con PAGO_MOVIL/ZELLE, doble entrada en ambas monedas en `accountingService.ts`) | [COPIAR-DOMINIO] | Base para `bank_accounts`, recibos y la contabilidad interna de nómina; el CHECK de tipos de documento es la mejor base del validador VE |
| 4 | **Modelo de asistencia/turnos** (DDL de referencia) | `asistencias-mejoras/packages/database/src/schema/ddl.ts` (322 líneas SQL: workers, shift_types, schedule_plans, shift_assignments, incidents, **month_closes+revisions**, audit_chain) + `apps/web/src/lib/shifts.ts` (TZ Caracas) | [ADAPTAR-PATRÓN] | Diseño maduro del módulo asistencia (M1); el patrón `month_closes` con revisiones audita el cierre mensual — trasladable al **cierre de nómina**. ⚠️ AGPL: re-implementar, no copiar archivos (ver §5) |
| 5 | **Datos territoriales Anzoátegui** (21 municipios + parroquias + población) | `idanz-futuros-olimpicos-2026/client/data/referencia-municipios.json` + `/home/havr/municipios` + cascada `client/js/data/zonas/zona_*.json` | [SEED-DATOS] | Seed directo de `locations`/territorio (datos, no código AGPL); empezar por Anzoátegui y completar Venezuela con la fuente del punto 6 |
| 6 | **Receta dataset geográfico completo VE** | `geo/docs/territorios-venezuela.md` (25 unidades ADM1 verificadas; fuente geoBoundaries `gbOpen/VEN/ADM1+ADM2`) | [SEED-DATOS] | Especificación para generar el seed completo estados→municipios→parroquias (incluye advertencias: no hardcodear bboxes, auditar Dependencias Federales) |
| 7 | **Scanner QR + impresión de carnets + firma canvas** | `assettag-qr/public/js/scanner.js` (BarcodeDetector+getUserMedia), `print.js` (grillas A4 y térmica 58/80 mm), `signature.js` (MIT) | [COPIAR-COMPONENTE] | Marcación por QR del carnet (M1), impresión de carnets del trabajador, firma táctil para recepción de documentos |
| 8 | **Sistema de notificaciones 3 capas** (Toast/Modal/InputPrompt) | `molaris-notifications-guide.md` + implementación `molaris/src/components/UI/` (MIT) | [COPIAR-PATRÓN] | Portar a Lit como componente del shell (reemplaza `custom-toast.js` de Patria); API `Toast.success(...)`, dedup, z-index por capa |

## 2. Patrones de plataforma (segunda línea)

| Activo | Ruta | Veredicto | Uso |
|---|---|---|---|
| Flujo **comprobante → aprobación admin** (zod → dominio → notificación push → panel) | `rifas-platform/apps/web/app/api/payments/route.ts` | [ADAPTAR-PATRÓN] | Esqueleto del workflow de aprobaciones RRHH (vacaciones, documentos, postulaciones ATS) |
| **Auth por sesión cookie + roles** | `rifas-platform/apps/web/lib/auth.ts` (jose, roles, `requireUser`) | [ADAPTAR-PATRÓN] | Referencia para sesiones RBAC (nuestra decisión final es sesiones PG, comparar implementación) |
| **Web Push VAPID** (cliente + servidor) | `idanz.../client/js/modules/notification-manager.js`, `rifas-platform/apps/web/lib/push.ts`, `lan-transfer-suite/apps/server/src/push/vapid.ts` | [ADAPTAR] | Notificaciones del portal del trabajador instalado como PWA |
| **i18n zero-dependency** es/en/pt | `novaplay-portal/shared/js/i18n/i18n.js` | [ADAPTAR] | Base del módulo i18n (es-VE default) sin dependencias |
| **Máquina de estados de citas** (Reservada→Confirmada→Atendida→Cancelada con motivo/autor) | `appointments_analysis/docs/04_MODELO_DATOS_Y_ALGORITMO_HORARIOS.md` y `05_GUIA_UI_UX_Y_FLUJOS_USUARIO.md` | [SOLO-REFERENCIA] | Mapeo directo a entrevistas del ATS (candidato↔entrevistador) |
| **Brand tokens centralizados + audit-logger forense** | `gas/gas_anzoategui_suite/packages/branding/brand.config.js`, `packages/audit-logger/` | [ADAPTAR-PATRÓN] | Refuerzo para `marca-blanca.md` y `audit_log` (IP, UA, huella) |
| **Créditos con abonos parciales** | `omni_pos_app/lib/features/credit_accounts/` (MIT) | [ADAPTAR-PATRÓN] | Modelo de anticipos/salarios pendientes (M2a) — sin interés; falta construir amortización |
| **Runbook dominio .gob.ve** (NIC.VE, DNSSEC, Cloudflare) | `/home/havr/dominio gob.ve.md` | [SOLO-REFERENCIA] | Anexar como guía de despliegue institucional en `docs/instalacion.md` si hay clientes públicos |

## 3. Tooling y plantillas de docs

- **everything-claude-code** (`/home/havr/everything-claude-code`): las skills `tdd-workflow`, `verification-loop`, `security-review`, `backend-patterns` **ya están disponibles como skills de ZCode** en esta máquina; para nivel repo, fusionar `rules/` (coding-style, testing, security, git-workflow) dentro del `AGENTS.md` de talento-ve y adaptar `hooks/hooks.json` (guards PreToolUse). No trae plantillas de GitHub Actions.
- **CI template**: único workflow existente en el home: `geo/.github/workflows/verify-sources.yml` (cron+dispatch) — plantilla base para nuestro CI, más plantillas `PULL_REQUEST_TEMPLATE.md`/`ISSUE_TEMPLATE/` de `geo`.
- **Estructura documental**: `BingoSocial/README.md` + `docs/DOCUMENTACION.md` (objetivos/no-objetivos, roadmap por fases) — patrón ya aplicado en nuestros docs; mantener el estilo.

## 4. Brechas confirmadas (construir de cero)

El análisis confirmó que **no existen** en el entorno local: validadores de cédula/RIF con dígito verificador, fórmulas de nómina/LOTTT, amortización de préstamos con interés, y datasets completos de municipios/parroquias de toda Venezuela (solo Anzoátegui). Todas ya estaban en el plan (`packages/domain`, M1–M2a); se valida el esfuerzo.

## 5. Advertencias de licencia y privacidad (obligatorias antes de copiar)

| Fuente | Licencia | Regla de incorporación |
|---|---|---|
| `sistema_caja_bimoneda`, `rifas-platform`, `novaplay-portal`, `sistema_pos`, `app_gestion_prestamo`, `gas suite` | Sin licencia (proyectos propios locales) | Reutilizable al ser autoría propia; fijar licencia si se portan archivos completos |
| `omni_pos_app`, `molaris`, `assettag-qr` | **MIT** | Copiables con atribución |
| `asistencias-mejoras`, `idanz-futuros-olimpicos-2026`, `geo` | **AGPL-3** | **Datos/JSON: libres. Código: solo como referencia de diseño** — re-implementar; copiar código obligaría a AGPL en TalentoVe (decisión ligada a ADR-0005: si se elige AGPL-3, la restricción desaparece) |
| `/home/havr/vivienda/`, `asistencias-mejoras/docs/pasantia-ubtjr/`, `CIRCUITO EDUCATIVO ESTADO ANZOATEGUI sx.xlsx`, `historial` | — | Contienen datos personales/sensibles: **excluir de TalentoVe** |
| `11`, `22`, `aaaa`, `ejemplos`, `PRUEBAS`, `comuda`, `idanz` (archivos sueltos) | — | **Credenciales en texto plano**: nunca copiar al repo; se recomienda rotarlas |

## 6. Plan de incorporación propuesto

- **M0:** fusionar reglas de `everything-claude-code` en `AGENTS.md`; crear CI a partir de la plantilla de `geo`; (si el sponsor aprueba) portar `rateService`+schema bimoneda a los primeros módulos de `packages/domain` (tasas) con tests Vitest.
- **M1:** seed territorial Anzoátegui (IDANZ+municipios) y generación del dataset nacional vía geoBoundaries; portar scanner/impresión QR (assettag, MIT); notificaciones 3 capas (molaris, MIT) como componente Lit; modelo de asistencia re-implementado tomando el DDL de `asistencias-mejoras` como referencia.
- **M2a:** calculadora fiscal (omni) y doble entrada bimoneda (bimoneda) a `packages/domain`; patrón de abonos/créditos para anticipos.
- **M2b:** modelo de asistencia re-implementado con el cierre mensual y revisiones (patrón `month_closes`) como cierre de asistencia.
- **M3:** máquina de estados de entrevistas (appointments docs) para el ATS.
