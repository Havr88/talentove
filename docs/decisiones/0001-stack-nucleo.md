# ADR-0001 — Stack del núcleo: Node/TypeScript + Express + HTMX + Lit + Materialize

**Estado:** Aceptada (2026-09-26) · **Contexto:** ver `plan-general.md` §3

## Decisión

Núcleo único en TypeScript: Express.js (servidor SSR), HTMX (interacción server-driven), Lit (web components), DataTables+jQuery (tablas), Materialize CSS (base visual), PostgreSQL (única BD). Fórmulas legales en `packages/domain` como funciones puras.

## Razones

- La lista tecnológica del sponsor proviene del portal Patria (jQuery+Materialize+DataTables): adoptarla conserva el look-and-feel objetivo y simplifica replicar patrones.
- Un solo lenguaje reduce el costo de mantenimiento y de instaladores (self-hosted por terceros).
- SSR + HTMX evita el estado de cliente duplicado; el modelo de nodos/admin (formularios, tablas, workflows) encaja en hypermedia.

## Alternativas descartadas

- **Remix/React**: mayor ecocistema UI, pero introduce estado de cliente y deja fuera HTMX/Lit/DataTables del núcleo.
- **Phoenix (Elixir)**: productividad alta, pero segundo stack (mantenimiento, contratación, on-prem).
- **Play (JVM), RedwoodJS, Sapper (deprecado), Mithril**: ver `plan-general.md` §3.

## Consecuencias

- jQuery queda como dependencia de DataTables y componentes Materialize, no como capa de aplicación (eso es HTMX/Lit).
- Obligación de mantener disciplina SSR: sin llamadas a APIs JSON en el cliente salvo endpoints expresos.
