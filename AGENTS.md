# AGENTS.md — Convenciones del repo talento-ve

Instrucciones para desarrolladores (humanos y asistentes IA) que trabajen en este repositorio.

## Idioma

- **UI y strings de usuario:** español de Venezuela (es-VE), con terminología configurable ("Trabajador/Colaborador/Personal").
- **Código e identificadores:** inglés (variables, funciones, tablas, rutas). **Documentación y commits:** español.

## Stack (ver docs/decisiones/0001)

Node ≥20 · TypeScript · Express.js · Nunjucks · HTMX 2 · Lit · DataTables+jQuery · Materialize CSS 1.x · PostgreSQL 16 · node-pg-migrate · pg-boss · pdfmake · zod · Vitest · Playwright.

## Patrones obligatorios

- **Feature-first:** `apps/server/src/features/<modulo>/{routes,domain,repo}`; nada de organizar por tipo técnico.
- **Envelope JSON:** `{ success, data?, error?, meta? }` en todo endpoint JSON; errores tipados, nunca `throw` silencioso ni errores crudos al cliente.
- **Repositorio:** la lógica de negocio no escribe SQL; pasa por repos. SQL siempre parametrizado.
- **Zod en todo borde:** body/query/params, archivos, `process.env` al arranque (fail-fast).
- **Inmutabilidad:** sin mutar inputs ni estado compartido; arrays/objetos nuevos (spread).
- **Tamaños:** archivos ≤400 líneas, funciones <50, anidación ≤4.
- **Sin `console.log`**: logger estructurado con contexto.
- **Sin secretos ni datos reales en el repo**: fixtures sintéticos siempre (nombres/cédulas generadas); el análisis de Patria usa capturas redactadas.

## Regla de dominio (crítica)

Toda fórmula de nómina/LOTTT/parafiscales vive en `packages/domain` como **función pura con parámetros inyectados**. Prohibido: hardcodear tasas, porcentajes, topes o valores de UT/BCV. Cualquier valor legal entra por parámetro y se registra con fuente y vigencia (`rate_tables`/`rule_sets`).

## Dinero y fechas

Dinero: `numeric(20,2)` en BD, string/BigInt en dominio si hace falta precisión — **jamás float**. Fechas: `timestamptz`; TZ por defecto `America/Caracas`; UI `dd/mm/aaaa`.

## Testing (TDD)

RED → GREEN → REFACTOR. Cobertura: ≥80% global, **≥95% en `packages/domain`**. E2E Playwright para flujos críticos. Prohibido debilitar un test para que pase (arreglar la implementación, salvo que el test esté mal).

## UI (ver docs/analisis-patria.md)

Replicar patrones Patria (shell §3, mecanismos §4) con la implementación modernizada del ADR-0003: HTMX para fragmentos, Lit para widgets, accesibilidad WCAG AA, cambios de estado por POST+CSRF, español por defecto en DataTables.

## Licencia

- **AGPL-3.0-only** ([ADR-0005](docs/decisiones/0005-licencia.md), decided 2026-09-27). Cualquier contribución se publica bajo la misma licencia.
- **Re-implementar, no copiar**, el código de activos externos AGPL: copiar obligaría a AGPL a quien lo use. Los *datos* y los datasets públicos son libres. Ver `docs/activos-reutilizables.md` §5.
- Si el proyecto acepta contribuciones externas, hay que firmar un **CLA** antes del primer commit aceptado, para conservar la opción de una doble licencia.

## Git

- Commits: `<type>: <descripción>` — tipos: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.
- Trabajo en incrementos pequeños y verificables; CI verde antes de mergear.
- Antes de cada commit con superficie sensible: revisión de seguridad (skill `security-review`), sin secretos, sin datos personales.
