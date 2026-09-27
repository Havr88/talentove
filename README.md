# TalentoVe *(nombre de trabajo)*

Plataforma web de **gestión de recursos humanos y talento humano** para Venezuela: **auto-alojada** (una instalación independiente por empresa), **marca blanca** completa y adaptable a empresas **públicas y privadas**.

> 🚧 **Estado: fase de definición y documentación** (previa al hito M0). La documentación en [`docs/`](docs/) es la fuente de verdad y se edita continuamente con el sponsor. El código del servidor llega con M0.

## Principios del proyecto

1. **Self-hosted y sencillo de instalar**: descargable de GitHub, Docker Compose o instalación manual; los datos de los trabajadores quedan en la empresa (soberanía de datos).
2. **Marca blanca real**: logo, paleta, tipografía, terminología ("Trabajador"/"Colaborador"/"Personal"), dominios, módulos activables y pie legal configurables por instalación.
3. **Venezuela al centro**: LOTTT, parafiscales (IVSS, FAOV/BANAVIH, INCES, RPE), dualidad Bs/USD, cédula/RIF, sector público como bandera configurable — todo **paramétrico**, nunca hardcodeado.
4. **Familiaridad de uso**: el portal del trabajador replica los patrones de interacción del portal Patria (analizados en [`docs/analisis-patria.md`](docs/analisis-patria.md)), que millones de venezolanos ya conocen.

## Módulos previstos (resumen — detalle en [modulos-y-hitos](docs/modulos-y-hitos.md))

| Hito | Módulos |
|---|---|
| M0 | Fundación: repo, CI, esqueleto Express+HTMX, auth/RBAC, wizard de instalación, theming, Docker, tasas Bs/USD |
| M1a | Expediente del trabajador + estructura organizacional (unidades/coordinaciones, asignaciones, organigrama) + carga masiva |
| M1b | Portal del trabajador + motor de solicitudes (vacaciones, permisos, trámites) + portal del coordinador |
| M2 | Nómina venezolana completa + asistencia extendida (cuadrantes, biométricos) + integraciones bancarias/parafiscales + reportes |
| M3 | ATS + onboarding/offboarding + desempeño + capacitación + SST + activos asignados |
| M4 (opcional) | Caja de ahorro + reconocimientos + tienda de beneficios + firma electrónica + API + régimen público + SIGEP |

## Stack

Node.js ≥20 (TypeScript) · Express.js · HTMX · Lit · DataTables + jQuery 3.7 · Materialize CSS · PostgreSQL 16 (+ pg-boss para colas) · pdfmake · Vitest/Supertest/Playwright.

Razones y alternativas descartadas en [`docs/decisiones/0001-stack-nucleo.md`](docs/decisiones/0001-stack-nucleo.md).

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/plan-general.md`](docs/plan-general.md) | Plan maestro: decisiones, alcance, hitos, riesgos |
| [`docs/analisis-patria.md`](docs/analisis-patria.md) | Sistema de diseño de referencia (patrones del portal Patria) |
| [`docs/arquitectura.md`](docs/arquitectura.md) | Arquitectura técnica, estructura del repo, patrones |
| [`docs/modelo-datos.md`](docs/modelo-datos.md) | Modelo de datos núcleo |
| [`docs/regionalizacion-venezuela.md`](docs/regionalizacion-venezuela.md) | Reglas y parámetros legales de Venezuela |
| [`docs/modulos-y-hitos.md`](docs/modulos-y-hitos.md) | Especificación breve por módulo y criterios de aceptación |
| [`docs/marca-blanca.md`](docs/marca-blanca.md) | Mecanismo de marca blanca y theming |
| [`docs/seguridad.md`](docs/seguridad.md) | Modelo de amenazas por superficie, controles obligatorios y lista de verificación pre-release |
| [`docs/instalacion.md`](docs/instalacion.md) | Guía de instalación (borrador, se completa en M0) |
| [`docs/decisiones/`](docs/decisiones/) | Decisiones de arquitectura (ADRs), con [índice y estado](docs/decisiones/README.md) |
| [`docs/activos-reutilizables.md`](docs/activos-reutilizables.md) | Inventario de activos aprovechables de los proyectos locales |
| [`docs/datasets.md`](docs/datasets.md) | Datasets de referencia versionados (bancos VE, territorio, feriados) |
| [`AGENTS.md`](AGENTS.md) | Convenciones para desarrollo (humanos y asistentes IA) |

## Licencia

**Pendiente de decisión** antes de publicar en GitHub (propuesta: AGPL-3). Ver [`docs/decisiones/0005-licencia.md`](docs/decisiones/0005-licencia.md).

## Nombre

"TalentoVe" es **provisional**; el nombre definitivo se decide antes de publicar el repo.
