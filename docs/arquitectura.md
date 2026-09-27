# Arquitectura — TalentoVe

> Estado: v0.2 (2026-09-27). Complemento de `plan-general.md` y `analisis-patria.md`. Los requisitos no funcionales (§9) son objetivos de diseño pendientes de confirmar por el sponsor.

## 1. Visión general

**Monolito modular en TypeScript, self-hosted, una instalación = una empresa.** Sin multi-tenancy SaaS, sin microservicios, sin Redis, sin dependencias cloud obligatorias. Requisitos duros: instalable con Node+PostgreSQL, datos de los trabajadores en la empresa, marca blanca por configuración.

## 2. Estructura del repo (pnpm workspaces)

```
talento-ve/
├── apps/
│   └── server/                  # Express + Nunjucks + HTMX (única app ejecutable)
│       └── src/
│           ├── core/            # config (zod fail-fast), db pool, sesiones,
│           │                    # auth/RBAC, csrf, audit, i18n, theming
│           ├── features/        # UN directorio por módulo funcional
│           │   └── employees/   # p.ej. expediente
│           │       ├── routes/  # express router + validación zod
│           │       ├── domain/  # reglas de negocio de la feature
│           │       └── repo/    # acceso a datos (patrón repositorio)
│           ├── jobs/            # pg-boss: nómina batch, vencimientos, correos
│           ├── views/           # Nunjucks: layouts/, components/, <feature>/
│           └── public/          # assets: css/, js/ (por página), icons/, manifest
├── packages/
│   ├── domain/                  # fórmulas puras: nómina, LOTTT, validadores VE
│   │                            # (sin BD ni framework; cobertura ≥95%)
│   └── ui/                      # componentes Lit (inputs con máscara, confirm-modal,
│                                # money-display, qr-badge…)
├── docker/                      # Dockerfile, docker-compose.yml, entrypoint
├── data/ve/                     # datasets de referencia versionados (seed)
│                                #   bancos.json, cargos.json, tipos-personal.json
├── .github/workflows/           # CI: lint, typecheck, tests, audit
├── docs/
└── AGENTS.md
```

Reglas estructurales (ver `AGENTS.md`): archivos ≤400 líneas, feature-first (no por tipo técnico), funciones <50 líneas, anidación ≤4 niveles.

## 3. Backend

- **Express.js** con routers por feature; middleware central: sesiones, CSRF, rate limiting, helmet, audit.
- **Envelope uniforme** en endpoints JSON: `{ success, data?, error?, meta? }`. Los endpoints de UI devuelven HTML (páginas o fragmentos HTMX).
- **Validación zod** en todo borde de entrada (body, query, params, archivos, env al arranque).
- **Patrón repositorio**: la lógica de negocio nunca consulta SQL directo; repos por feature con `find/findById/create/update/delete`.
- **pg-boss** para colas sobre la misma PostgreSQL (ADR-0004): corrida de nómina, recordatorios, alertas de vencimiento de documentos, correos. Sin Redis.
- **pdfmake** para recibos de pago, constancias y comprobantes (PDF puro en Node, sin Chromium — clave para instalaciones ligeras).
- **Archivos/documentos**: driver de almacenamiento configurable — disco local por defecto; S3/MinIO opcional. Nunca en la BD. Se accede por **clave opaca generada** y la descarga pasa siempre por un endpoint autenticado (ADR-0008).
- **Migraciones**: node-pg-migrate, SQL versionado en el repo.
- **Dinero**: PostgreSQL `numeric(20,2)`; tasas de cambio `numeric(20,8)`. Jamás float.

## 4. Frontend (SSR + mejora progresiva)

- **Nunjucks** para SSR (sintaxis tipo Jinja, ideal para replicar el shell Patria).
- **HTMX 2** para interacción: fragmentos, modales de confirmación, scroll infinito (`hx-trigger="revealed"`), formularios inline. Sin SPA, sin estado de cliente.
- **Lit** para widgets con JS real: inputs con máscara (cédula/RIF/money), selector de fecha es-VE, QR del carnet, preview de branding, gráficos simples.
- **DataTables + jQuery**: wrapper global con defaults en español (spinner Materialize, `sortCellsTop`, responsive `data-priority`); server-side POST para tablas grandes (nómina, estadísticas).
- **Materialize CSS 1.x** como base visual, con **CSS variables por tenant** (ver `marca-blanca.md`).
- **PWA**: manifest + iconos generados del logo del tenant + theme-color.
- **Sesión inactiva**: aviso configurable (default 8 min) + logout (default 10) + heartbeat; espejo del patrón Patria.
- **Accesibilidad WCAG AA** (mejora explícita sobre el patrón Patria; ver `analisis-patria.md` §6).

## 5. Autenticación y autorización

- Sesiones cookie `httpOnly`/`SameSite=Lax` con store en PostgreSQL: token opaco de 256 bits **guardado como hash**, un solo secreto maestro del que se derivan por HKDF el firmador de sesión y el de CSRF (ADR-0007).
- Contraseñas **argon2id**; 2FA TOTP opcional por usuario.
- **RBAC**: roles de instalación: `superadmin` (dueño de la instalación), `admin_rrhh`, `aprobador` (jefaturas), `empleado`, `auditor` (solo lectura de reportes/audit). Los códigos de rol y permiso viven en el código; la asignación es dato (ADR-0007).
- Empleado se autoidentifica por cédula en la UI (patrón Patria).
- Auditoría **append-only** (`audit_log`): quién, qué, cuándo, antes/después — para acciones sensibles (nómina, expediente, configuración).
- Soft-delete (`deleted_at`) en entidades sensibles; nunca borrado físico de nómina.

## 6. Configuración

- **Env** (`.env`): infraestructura (BD, sesión, SMTP, storage) — validación zod fail-fast al arrancar.
- **Settings en BD** (`settings`): branding, terminología, módulos activados, reglas por sector, parámetros legales. Editables por UI (wizard + admin).
- Secretos: solo en env; jamás en BD ni repo (`AGENTS.md`).

## 7. Testing y CI

- **Vitest**: unit (packages/domain ≥95%, resto ≥80%) + integración (Supertest contra rutas/BD de prueba).
- **Playwright**: E2E de flujos críticos (login, solicitud de vacaciones, corrida de nómina, wizard de instalación).
- Fixtures **sintéticos** siempre (nunca datos reales — ver AGENTS.md).
- **GitHub Actions**: lint + typecheck + tests + `npm audit` + build; releases con imágenes Docker versionadas.

## 8. Despliegue

- **Docker Compose** (recomendado): `app` + `postgres`; volúmenes para datos y documentos.
- **Manual**: Node ≥20 + PostgreSQL 16 + `pnpm build` + migraciones + systemd.
- Actualizaciones por tags de GitHub con changelog; migraciones idempotentes y reversibles.
- Backups: `pg_dump` programado (script incluido) + copia del directorio de documentos.

## 9. Requisitos no funcionales

Fijan el orden de magnitud para decidir tablas server-side vs. cliente, límites de carga masiva
y capacidad de hardware. Son **objetivos de diseño**, no compromisos medidos: se validarán con
las primeras instalaciones piloto.

**Confirmado por el sponsor (2026-09-27): menos de 100 usuarios concurrentes por instalación.**
Ese techo es la restricción que manda, y es holgadamente alcanzable con un monolito SSR en
Node: el cuello de botella real serán las consultas a PostgreSQL, no el idioma. El resto de los
objetivos se derivan de él.

| Área | Objetivo |
|---|---|
| Escala por instalación | Hasta **5.000 trabajadores** y **< 100 usuarios concurrentes** por instalación (confirmado por el sponsor) |
| Latencia de pantalla | p95 < 400 ms en listados paginados; < 800 ms en búsquedas con filtros |
| Carga masiva | Hasta **10.000 filas** por archivo, ejecución en segundo plano (pg-boss) con reporte de errores descargable; modo dry-run obligatorio |
| Cierre de nómina | Quincena de 5.000 trabajadores en **< 60 min**; el cálculo es puro (`packages/domain`) y por lotes, con progreso visible |
| PDFs | Recibo de nómina generado en < 2 s; la generación es síncrona en Node, sin Chromium |
| Memoria | El proceso de Node debe sostenerse con **< 1 GB RSS** en operación normal (motivo: servidores de 2 GB) |
| Tamaño de página | El servidor renderiza hasta **500 filas** sin paginación; más allá, DataTables server-side |
| Uploads | Tope por archivo configurable (`STORAGE_MAX_FILE_BYTES`, 10 MB por defecto) y validación de tipo MIME por lista blanca |
| Restauración | Un backup `pg_dump` + directorio de documentos restaura la instalación en **< 2 h** |
| Accesibilidad | WCAG AA en todos los flujos; el incumplimiento es un bug, no una excepción |

**Qué deja descartado el techo de 100 usuarios concurrentes:**

- **No** hace falta caché distribuida, ni CDN, ni réplicas de lectura: no hay justificación para
  esa complejidad en una instalación con un servidor de 2 GB.
- **Sí** importa el aislamiento: si veinte usuarios abren a la vez la corrida de nómina, la
  instalación no debe volverse inusable. De ahí que la corrida vaya por `pg-boss` y el cálculo
  sea por lotes, sin bloquear la interfaz.
- **La lista de módulos activados** por instalación (`settings`) debe asumir rendimiento
  aceptable con todos ellos encendidos: no se presupone que el cliente desactivará módulos
  "para que vaya rápido".

**Implicaciones de diseño:** lo anterior es lo que justifica (a) `numeric` en BD y funciones
puras de dominio en vez de cálculos en SQL, (b) cierres de nómina por lotes y no en una
transacción única, y (c) `pg-boss` para todo trabajo largo en vez de requests HTTP síncronas.

## 10. Seguridad (checklist pre-commit, ver AGENTS.md y docs/seguridad.md)

Argon2id · sesiones httpOnly · CSRF en todo POST · rate limiting en login y endpoints públicos · helmet · zod en todos los bordes · sin secretos en repo · errores sin filtrar internos · SQL siempre parametrizado · revisión `security-review` antes de cada release.
