# Plan general — TalentoVe

> Estado: **v0.3 — revisión documental aplicada** (2026-09-27). Este documento consolida las decisiones tomadas y el plan maestro; los detalles viven en los documentos enlazados.

## 1. Visión

Una plataforma de RRHH/talento humano que cualquier empresa venezolana —pública o privada— descarga de GitHub, instala en su propio servidor y personaliza como propia (marca blanca). El portal del trabajador usa los patrones de interacción del portal [Patria](https://persona.patria.org.ve/) para que cualquier usuario venezolano lo use sin capacitación, y toda la lógica legal (LOTTT, parafiscales, dualidad monetaria) es **paramétrica** y actualizable sin tocar código.

## 2. Decisiones confirmadas con el sponsor

| # | Decisión | Detalle |
|---|---|---|
| 1 | Stack núcleo | Node/TypeScript + Express.js + HTMX + Lit + DataTables/jQuery + Materialize CSS (ADR-0001) |
| 2 | Modelo de entrega | **Una instalación independiente por empresa**; distribución vía GitHub; Docker Compose o manual (ADR-0002) |
| 3 | MVP | Expediente del trabajador + portal del empleado (M1) |
| 4 | Sector público | Bandera en el modelo de datos desde el inicio; solo se implementa el régimen privado primero |
| 5 | UI de referencia | Patrones del portal Patria como sistema de diseño (ADR-0003) |
| 6 | Simplificación de infra | PostgreSQL como única dependencia fuerte; colas con pg-boss (ADR-0004) |
| 7 | Licencia | **AGPL-3.0-only** — ADR-0005 |

## 3. Mapeo del stack (origen: lista tecnológica del sponsor)

La lista original del sponsor proviene del stack real del portal Patria. Resolución:

**Adoptados (núcleo):** Express.js (servidor), HTMX (interfaz server-driven: fragmentos, formularios, scroll infinito), Lit (web components para widgets con JS real), DataTables + jQuery 3.7 (tablas con búsqueda/export), Materialize CSS (base visual + theming por CSS variables).

**Adoptados opcionales (hitos posteriores):** Publii (micrositio público de carreras, opcional), Ecwid (tienda de beneficios embebida, M4; Jumpseller como alternativa).

**Descartados:** Sapper (deprecado), RedwoodJS (pivotó a RedwoodSDK), Remix (superado por decisión #1), Phoenix (segundo stack/lenguaje), Play Framework (JVM), Mithril (redundante con Lit+HTMX), Page.js (obsoleto), Hammer.js (fuera de alcance), Magnolia/Pulse/Zenario (CMS externos que rompen el monolito — ADR-0006), Broadleaf (sobreingeniería frente a Ecwid embebido).

## 4. Alcance funcional

Detalle completo en [modulos-y-hitos.md](modulos-y-hitos.md):

- **M0 — Fundación:** entorno, repo+CI, esqueleto Express+Nunjucks+HTMX+Materialize, auth+RBAC, wizard de primera instalación, theming por CSS variables, shell UI estilo Patria, docker-compose, y primer módulo de dominio testado (tasas Bs/USD).
- **M1a — Expediente + Estructura organizacional:** expediente con validadores VE y tokens de incorporación, unidades organizativas configurables con asignaciones vigentes y organigrama, carga masiva Excel/CSV, búsqueda global.
- **M1b — Portal + Motor de solicitudes:** portal del trabajador, motor de solicitudes configurable (vacaciones, permisos, constancias, actualización de datos, reclamos, pases) con cadenas de aprobación jefe→coordinación→RRHH, portal del coordinador, feriados VE paramétricos.
- **M2a — Nómina Venezuelan:** nómina completa (LOTTT, parafiscales, dualidad Bs/USD, anticipos, liquidación), movimientos con efecto salarial, recibos y tabla histórica, archivos de cotización de parafiscales, verificación de los parámetros legales contra Gaceta Oficial. No depende del módulo de asistencia: las horas extra llegan aprobadas desde el motor de solicitudes de M1b.
- **M2b — Asistencia extendida + integraciones + reportes:** cuadrantes/turnos/intercambios/marcaciones biométricas con cierre mensual auditable que alimenta la nómina, archivos bancarios de pago, export contable, reportes básicos.
- **M3 — Talento y ciclo de vida:** ATS con entrevistas, onboarding, offboarding, desempeño, capacitación, SST (accidentes, EPP, exámenes), activos asignados con custodia QR, encuestas y comités.
- **M4 — Extensión (opcional):** caja de ahorro con amortización, reconocimientos, tienda de beneficios, firma electrónica, API pública, contenido público, régimen sector público completo + SIGEP, canal ético.

## 5. Calidad y seguridad

- TDD con Vitest (RED→GREEN→REFACTOR); cobertura ≥80% global, **≥95% en `packages/domain`** (fórmulas de nómina).
- E2E con Playwright en flujos críticos: login, solicitud de vacaciones, corrida de nómina.
- Zod en todos los bordes de entrada; envelope uniforme `{ success, data?, error?, meta? }`; repositorios; archivos ≤400 líneas.
- Seguridad: argon2id, sesiones httpOnly, CSRF en todos los POST, rate limiting, helmet, `npm audit` en CI, backups `pg_dump` documentados, minimización de datos personales. Auditoría inmutable de acciones sensibles.
- Revisión de seguridad (skill `security-review`) antes de cada release, con la lista de verificación de [`seguridad.md`](seguridad.md) §9.

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Parámetros legales volátiles (tasas, UT, salarios mínimos) | Tablas de tasas/rule_sets con vigencia y fuente; verificación en Gaceta Oficial al implementar cada fórmula |
| Inflación y dualidad monetaria | `numeric` (nunca float), histórico de tasas, cálculos anclados a la fecha del período |
| Alcance enorme | Hitos entregables; MVP con valor real antes de nómina |
| Instaladores no técnicos | Wizard guiado, docker-compose, docs paso a paso en español |
| Datos personales en el desarrollo | Prohibido commitear datos reales; fixtures sintéticos (ver AGENTS.md) |

## 7. Siguientes pasos

1. **Resolver las 7 decisiones abiertas** registradas en `modulos-y-hitos.md` § Observaciones del sponsor. Las tres primeras son previas a escribir código: contrato de fórmulas de nómina, licencia (ADR-0005) y modelo de sesión/RBAC.
2. El sponsor hará ediciones y observaciones manuales sobre los docs (sección "Observaciones del sponsor" de `modulos-y-hitos.md`).
3. Integrar las páginas Patria restantes que aporte el sponsor en [`analisis-patria.md`](analisis-patria.md) §7.
4. **M0:** scaffolding de `apps/server` + `packages/domain`, migraciones, CI, primer arranque local. Requiere verificar los parámetros legales vigentes en Gaceta Oficial (checklist en [`regionalizacion-venezuela.md`](regionalizacion-venezuela.md) §9).
